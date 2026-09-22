# PostgreSQL migration

The application now uses PostgreSQL through `pg`. `.env.local` contains the actual local connection settings and is ignored by Git. `.env.example` contains placeholders only. SQLite is no longer a runtime dependency.

## Inspection and migration results

The original PostgreSQL database contained 15 tables, including 6 users, 29 products, 6 orders, 10 order items, 4 branches, 4 hotel partners, reviews, chat messages and a separate role/permission system. Its users had no password column, and its orders and inventory did not contain the data required by this app.

All 15 original tables were moved intact to the `legacy` schema, retaining their relationships. No original table was deleted. They are accessible through the administrative database connection, but not the application's restricted role. This was chosen instead of overwriting incompatible records.

The active `public` schema has 25 application tables plus `schema_migrations`:

| Area | Tables |
| --- | --- |
| Accounts | `users`, `sessions`, `tokens`, `rate_limits` |
| Catalogue and inventory | `products`, `batches`, `allocations`, `stock_movements` |
| Orders and payments | `orders`, `order_items`, `order_history`, `payments` |
| Hotel commissions | `hotels`, `commissions`, `payouts`, `payout_items` |
| Operations | `drivers`, `promotions`, `notifications`, `audit`, `expenses`, `settings` |
| Customer data | `addresses`, `favourites`, `support` |

`users`, `products`, `orders` and `order_items` replace incompatible active structures. The other 21 application tables were missing from the previous PostgreSQL schema.

All SQLite records were copied, including the customer's existing password hash and session. Compatible PostgreSQL users and products were imported. The resulting active dataset contains 7 users and 33 products; no active orders or stock batches were invented.

## Records needing reconciliation

- The 6 historical orders and 10 order items remain in `legacy.orders` and `legacy.order_items`. They are not included in the new dashboard's totals. They lack reliable recipient phone numbers, inventory allocations, confirmation codes and payment ledger entries. Their old payment labels are not proof of payment.
- Old stock quantities remain in `legacy.products.stock`. Record verified batches, expiry dates and purchase costs through Inventory before selling those products. Imported products initially have zero available stock.
- Branches, reviews, chats, hotel partners and custom RBAC tables remain in `legacy`; the current application does not implement those old structures. Hotel partners need verified contact/address and commission rules before creating active hotel records.
- Old user roles map as follows: `SUPER_ADMIN` and `ADMIN` → `admin`, `SELLER` → `sales`, `DRIVER` → `delivery`, `CUSTOMER` → `customer`. The old branch scopes/custom permissions are preserved for review, not enforced by this application's fixed role model. Current staff access is shop-wide.
- The 6 imported PostgreSQL users have no password until they complete an invitation/reset flow. No default password was created. Existing SQLite credentials remain valid.

For an imported administrator, generate a one-time password-setup link with:

```powershell
npm.cmd run admin:invite -- administrator@example.com
```

Use the administrator's actual email. This also supports creating a new admin with an unused email. Links expire after one hour.

## Database security and integrity

- The app connects as `nungwi_app`, a login without superuser, role creation, database creation or RLS-bypass privileges. Its generated password is stored only in ignored `.env.local`.
- `DATABASE_ADMIN_URL` is used by migration, integration tests and recovery tools. It is not used by the request-serving database module. In production, supply it only to maintenance jobs.
- Runtime access is limited to the active application tables. The audit log allows SELECT/INSERT, but rejects UPDATE/DELETE. The role cannot create public tables or access legacy data or migration records.
- Public schema creation is revoked from `PUBLIC`.
- Database enums validate user roles, order statuses, payment kinds/methods, allocation states, notification channels/statuses and support statuses.
- Unique indexes enforce case-insensitive emails and existing codes/SKUs/references. Foreign keys, constrained integer flags, positive quantities, stock bounds and order-total checks protect persisted data.
- Money uses BIGINT with JavaScript-safe integer bounds, including aggregate parsing, so totals above PostgreSQL's 32-bit integer limit remain exact.
- Credentials, database files, uploads and backups are excluded from deployment file tracing. Supply runtime environment settings and persistent upload storage on the destination host.
- The app retains its password hashing, hashed session/token storage, request-origin checks and role/ownership authorization. Per-user PostgreSQL RLS was not enabled: all requests use one server role, and user-level authorization is enforced by the server. Database credentials must never be sent to a browser.
- Transaction callbacks share one checked-out connection. A PostgreSQL transaction advisory lock preserves the old serialized-write behavior for inventory, payment/refund, token and outbox operations across app processes. This is a conservative correctness choice; high write throughput may require finer-grained locks later.
- Existing ISO UTC timestamps and JSON strings remain text to preserve API compatibility. Identifiers remain text because legacy product IDs are not UUIDs.

## Maintenance

```powershell
npm.cmd run db:backup
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Backup uses PostgreSQL's consistent `pg_dump` custom format and verifies the archive listing. Set `PG_BIN` if PostgreSQL tools are not on PATH. Restore deliberately requires `RESTORE_DATABASE_URL` pointing to a separate empty database:

```powershell
$env:RESTORE_DATABASE_URL = 'postgresql://postgres:YOUR_PASSWORD@localhost:5432/nungwi_recovery'
npm.cmd run db:restore -- backups/YOUR_BACKUP.dump
```

The target database must already exist; live database replacement is refused. PostgreSQL roles are cluster-level and not contained in the database dump, so provision the `nungwi_app` role first when recovering onto another cluster. Check the recovered data and application permissions before switching connection URLs.

Pre-migration backups are `backups/postgres-before-migration.dump` and `backups/sqlite-before-postgres.sqlite`. The original SQLite database also remains in `data/`. Backups and exports contain sensitive data and are ignored by Git.

For another installation, stop application writers, back up both databases, then export SQLite and run the transactional migration once:

```powershell
python scripts/export-sqlite.py data/nungwi.sqlite backups/sqlite-import.json
npm.cmd run db:migrate -- backups/sqlite-import.json
```

Configure both connection URLs first, with a new dedicated runtime role name. The migration recognizes the inspected legacy schema, refuses conflicting user/product identities or unmapped user roles, and rolls back on errors. Re-running an applied migration makes no data changes. Integration tests create and remove their own randomly named schema; they do not use active application tables.

Implementation references: [node-postgres transactions](https://node-postgres.com/features/transactions) and [PostgreSQL schema privileges](https://www.postgresql.org/docs/current/ddl-schemas.html).

## Verification performed

- All 29 tests passed, including concurrent reservations, transaction rollback, large monetary totals, token redemption, refunds and ownership checks.
- TypeScript and the production build passed. Turbopack still reports dynamic upload-path tracing warnings; private runtime files are explicitly excluded.
- The running catalogue endpoint returned 33 products with numeric prices; unauthenticated order access returned HTTP 401.
- Every exported SQLite row was compared against PostgreSQL and matched.
- The restricted runtime role was verified to reject legacy-table access, public table creation, and audit-log updates.
- A PostgreSQL backup was restored into a separate temporary database and verified to contain 7 active users, 33 active products and all 6 legacy orders. The temporary recovery database was then removed.
