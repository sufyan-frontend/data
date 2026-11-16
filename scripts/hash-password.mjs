#!/usr/bin/env node
/**
 * Prints a password hash for ANP_ADMIN_PASSWORD_HASH (and ADMIN_PASSWORD_HASH).
 *
 *   node scripts/hash-password.mjs "my password"
 *
 * Format: scrypt$<salt hex>$<hash hex> — checked by src/lib/anp-auth.ts.
 */
import { randomBytes, scryptSync } from 'node:crypto'

const password = process.argv[2]
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "<password>"')
  process.exit(1)
}
const salt = randomBytes(16)
const hash = scryptSync(password, salt, 32)
console.log(`scrypt$${salt.toString('hex')}$${hash.toString('hex')}`)
