import { readFile } from 'node:fs/promises'
import { Client } from 'pg'

try { process.loadEnvFile('.env.local') } catch {}
const identifier = (value: string) => '"' + value.replaceAll('"', '""') + '"'
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'"

async function subsequentMigrations(client: Client, erpOnly = false, smsOnly = false, catalogueOnly = false) {
  for (const version of catalogueOnly ? ['007_product_workflow'] : smsOnly ? ['006_sms_notifications'] : erpOnly ? ['005_erp_foundation'] : ['002_money_capacity', '003_tanzania_drinks_scanner', '004_master_drinks_catalog', '005_erp_foundation', '006_sms_notifications', '007_product_workflow']) {
    if (!(await client.query('SELECT 1 FROM public.schema_migrations WHERE version=$1', [version])).rowCount) {
      await client.query(await readFile(`migrations/${version}.sql`, 'utf8'))
      if (version === '005_erp_foundation' || version === '006_sms_notifications' || version === '007_product_workflow') {
        const runtimeRole = decodeURIComponent(new URL(process.env.DATABASE_URL!).username)
        if ((await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [runtimeRole])).rowCount) {
          for (const table of version === '007_product_workflow' ? ['drink_categories','product_codes'] : version === '006_sms_notifications' ? ['otp_challenges','sms_campaigns'] : ['suppliers', 'purchase_orders', 'purchase_items', 'purchase_receipts', 'supplier_bills', 'supplier_payments', 'customer_terms', 'customer_invoices', 'finance_reconciliations']) {
            await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.${identifier(table)} TO ${identifier(runtimeRole)}`)
          }
        }
      }
      await client.query('INSERT INTO public.schema_migrations(version) VALUES ($1)', [version])
    }
  }
}

async function main() {
  if (!process.env.DATABASE_ADMIN_URL || !process.env.DATABASE_URL) throw new Error('Set DATABASE_ADMIN_URL and DATABASE_URL in .env.local.')
  const admin = new URL(process.env.DATABASE_ADMIN_URL)
  const runtime = new URL(process.env.DATABASE_URL)
  if (admin.host !== runtime.host || admin.pathname !== runtime.pathname) throw new Error('Admin and app connections must target the same database.')
  admin.searchParams.delete('schema')
  const client = new Client({ connectionString: admin.toString() })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(184733, 2)')
    await client.query('SET LOCAL search_path TO public, pg_catalog')
    await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
    const applied = await client.query("SELECT 1 FROM public.schema_migrations WHERE version='001_postgres'")
    const catalogueOnly = process.argv.includes('--catalogue-only')
    const erpOnly = process.argv.includes('--erp-only')
    const smsOnly = process.argv.includes('--sms-only')
    if ((erpOnly || smsOnly || catalogueOnly) && (!applied.rowCount || !(await client.query("SELECT 1 FROM public.schema_migrations WHERE version='002_money_capacity'")).rowCount)) throw new Error('ERP migration requires the existing 001_postgres and 002_money_capacity migrations.')
    if (applied.rowCount) { await subsequentMigrations(client, erpOnly, smsOnly, catalogueOnly); await client.query('COMMIT'); console.log(smsOnly ? 'SMS schema is up to date.' : erpOnly ? 'ERP schema is up to date.' : 'PostgreSQL schema is up to date.'); return }
    const existing = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'schema_migrations'")
    if (existing.rowCount) {
      const columns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users'")
      if (!columns.rows.some(r => r.column_name === 'nationality') || columns.rows.some(r => r.column_name === 'password')) throw new Error('Unrecognized existing schema. Inspect and back up before adapting this migration.')
      await client.query('CREATE SCHEMA legacy')
      for (const row of existing.rows) await client.query(`ALTER TABLE public.${identifier(row.tablename)} SET SCHEMA legacy`)
      await client.query('REVOKE ALL ON SCHEMA legacy FROM PUBLIC')
      await client.query('REVOKE ALL ON ALL TABLES IN SCHEMA legacy FROM PUBLIC')
    }
    await client.query(await readFile('migrations/001_postgres.sql', 'utf8'))
    await subsequentMigrations(client)
    const source = process.argv[2]
    if (source) {
      // This export is produced from a consistent SQLite backup; no source file is modified.
      const tables = JSON.parse(await readFile(source, 'utf8')) as Record<string, Record<string, unknown>[]>
      const allowed = new Set((await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'schema_migrations'")).rows.map(r => r.tablename))
      for (const [table, rows] of Object.entries(tables)) {
        if (!allowed.has(table) || !Array.isArray(rows)) throw new Error('Unrecognized SQLite export table')
        for (const row of rows) {
          const keys = Object.keys(row)
          await client.query(`INSERT INTO ${identifier(table)} (${keys.map(identifier).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row))
        }
      }
    }
    if (existing.rowCount) {
      // Fail instead of silently merging accounts or overwriting SQLite IDs/SKUs.
      const collisions = await client.query('SELECT 1 FROM legacy.users l JOIN public.users u ON l.id=u.id OR lower(l.email)=lower(u.email) UNION ALL SELECT 1 FROM legacy.products l JOIN public.products p ON l.id=p.id LIMIT 1')
      if (collisions.rowCount) throw new Error('Legacy/SQLite identities overlap. Reconcile the records before importing.')
      const unknownRoles = await client.query("SELECT DISTINCT role FROM legacy.users WHERE role IS NULL OR role NOT IN ('SUPER_ADMIN','ADMIN','SELLER','DRIVER','CUSTOMER')")
      if (unknownRoles.rowCount) throw new Error('Legacy users have unmapped roles; migration stopped without changes.')
      await client.query(`INSERT INTO users (id,email,name,role,created_at)
        SELECT id,lower(email),name,(CASE role WHEN 'SUPER_ADMIN' THEN 'admin' WHEN 'ADMIN' THEN 'admin' WHEN 'SELLER' THEN 'sales' WHEN 'DRIVER' THEN 'delivery' ELSE 'customer' END)::user_role,
        to_char(coalesce(created_at,now() AT TIME ZONE 'UTC'),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM legacy.users`)
      const invalidPrices = await client.query('SELECT 1 FROM legacy.products WHERE price<0 OR price<>trunc(price) OR price>1000000000 LIMIT 1')
      if (invalidPrices.rowCount) throw new Error('Legacy prices require explicit currency/rounding reconciliation.')
      await client.query(`INSERT INTO products (id,name,brand,category,description,image,volume,price,sku,created_at)
        SELECT id,name,brand,category,coalesce(description,''),image,coalesce(size,''),price::integer,'LEGACY-'||id,
        to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM legacy.products`)
    }
    const username = decodeURIComponent(runtime.username)
    if (!/^[a-z_][a-z0-9_]*$/.test(username) || username === decodeURIComponent(admin.username)) throw new Error('Use a separate, restricted runtime role.')
    const role = await client.query('SELECT rolname FROM pg_roles WHERE rolname=$1', [username])
    if (role.rowCount) throw new Error('Runtime role already exists. Review its existing ownership and grants before proceeding.')
    await client.query(`CREATE ROLE ${identifier(username)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD ${literal(decodeURIComponent(runtime.password))}`)
    await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC')
    await client.query(`GRANT CONNECT ON DATABASE ${identifier(decodeURIComponent(admin.pathname.slice(1)))} TO ${identifier(username)}`)
    await client.query(`GRANT USAGE ON SCHEMA public TO ${identifier(username)}`)
    const appTables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('schema_migrations','audit')")
    for (const row of appTables.rows) await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.${identifier(row.tablename)} TO ${identifier(username)}`)
    await client.query(`GRANT SELECT,INSERT ON public.audit TO ${identifier(username)}`)
    await client.query("INSERT INTO schema_migrations(version) VALUES ('001_postgres')")
    await subsequentMigrations(client)
    await client.query('COMMIT')
    console.log('PostgreSQL migration committed. Original tables preserved in legacy; compatible users/products and SQLite data imported. Runtime role created with restricted permissions.')
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { await client.end() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
