import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { atomic, audit, closeDb, id, now, one, run } from '../lib/server/db'
import { passwordHash } from '../lib/server/auth'

try { process.loadEnvFile('.env.local') } catch {}

function generateSecurePassword(length = 20): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*(-_=+)'
  const bytes = randomBytes(length)
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length]
  }
  return password
}

async function main() {
  const rawEmail = process.argv[2] || 'admin@uorzanzibar.co.tz'
  const email = z.string().email().transform(v => v.toLowerCase()).parse(rawEmail)
  const name = process.argv[3] || 'Production Admin'
  const customPassword = process.argv[4]

  const password = customPassword || generateSecurePassword(24)
  const hashed = passwordHash(password)

  await atomic(async () => {
    const existing = await one('SELECT * FROM users WHERE lower(email)=?', email)
    if (existing) {
      await run(
        'UPDATE users SET role=?, password=?, active=1, name=? WHERE id=?',
        'admin',
        hashed,
        name,
        existing.id
      )
      await audit(null, 'admin.password_reset', 'user', existing.id, { email, role: 'admin' })
      console.log(`\nUpdated existing user [${email}] to Admin with new password.`)
    } else {
      const userId = id()
      await run(
        'INSERT INTO users (id, email, name, role, password, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
        userId,
        email,
        name,
        'admin',
        hashed,
        now()
      )
      await audit(null, 'admin.created', 'user', userId, { email, role: 'admin' })
      console.log(`\nCreated new Admin user [${email}].`)
    }
  })

  console.log('====================================================')
  console.log('  PRODUCTION ADMIN CREDENTIALS GENERATED')
  console.log('====================================================')
  console.log(`  Username / Email: ${email}`)
  console.log(`  Password:         ${password}`)
  console.log('====================================================')
  console.log('  Store these credentials securely in your password manager!')
  console.log('====================================================\n')
}

main()
  .catch(error => {
    console.error('Error creating admin user:', error.message)
    process.exitCode = 1
  })
  .finally(closeDb)
