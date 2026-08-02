// 用法：node scripts/gen-anon-jwt.mjs <jwt-secret> [过期秒数，默认 10 年]
// 输出：anon JWT，作为 VITE_SUPABASE_ANON_KEY；与 PostgREST 的 PGRST_JWT_SECRET 配套
import { createHmac } from 'node:crypto'

const [, , secret = '', expiresIn = String(10 * 365 * 24 * 3600)] = process.argv

if (!secret) {
  console.error('缺少 jwt-secret 参数：node gen-anon-jwt.mjs <secret>')
  process.exit(1)
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const header = b64({ alg: 'HS256', typ: 'JWT' })
const now = Math.floor(Date.now() / 1000)
const payload = b64({ role: 'anon', iat: now, exp: now + Number(expiresIn) })
const sig = createHmac('sha256', secret)
  .update(`${header}.${payload}`)
  .digest('base64url')

console.log(`${header}.${payload}.${sig}`)
