// 把 dist/ 整个打包产物传到 Supabase Storage，当免费、免备案的静态托管用。
// 用法：npm run build && npm run deploy:storage
//
// 需要 SUPABASE_SERVICE_ROLE_KEY（不是 anon key）：
// 建 bucket、覆盖已存在的文件都要绕过 RLS，anon key 权限不够。
// 这个 key 只应该存在于本地 .env.local（已 gitignore），永远不要提交或分享出去。
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(root, 'dist')
const bucket = 'app'

function loadEnvLocal() {
  const env = {}
  let text
  try {
    text = readFileSync(join(root, '.env.local'), 'utf8')
  } catch {
    console.error('找不到 .env.local，先跑一遍正常的开发配置流程（见 README「接上 Supabase」）')
    process.exit(1)
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/)
    if (m) env[m[1]] = m[2]
  }
  return env
}

const env = loadEnvLocal()
const url = env.VITE_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url) {
  console.error('VITE_SUPABASE_URL 没配，先按 README 接上 Supabase')
  process.exit(1)
}
if (!serviceKey) {
  console.error(
    [
      '.env.local 里缺 SUPABASE_SERVICE_ROLE_KEY。',
      '去 Supabase 控制台 Settings → API，复制 service_role 那个 key（不是 anon/publishable 的那个），',
      '加一行 SUPABASE_SERVICE_ROLE_KEY=xxx 到 .env.local，再跑一次这个脚本。',
      '这个 key 权限很高，只放本地文件里，不要发给任何人、不要贴到聊天里。',
    ].join('\n'),
  )
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

async function ensureBucket() {
  const { data: existing } = await supabase.storage.getBucket(bucket)
  if (existing) {
    console.log(`bucket "${bucket}" 已存在，直接用`)
    return
  }
  const { error } = await supabase.storage.createBucket(bucket, { public: true })
  if (error) throw new Error(`建 bucket 失败: ${error.message}`)
  console.log(`bucket "${bucket}" 已创建（public）`)
}

async function uploadAll() {
  const files = walk(distDir)
  if (files.length === 0) throw new Error('dist/ 是空的，先跑 npm run build')

  for (const filePath of files) {
    const relPath = relative(distDir, filePath).split('\\').join('/')
    const contentType = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream'
    const body = readFileSync(filePath)
    const { error } = await supabase.storage
      .from(bucket)
      .upload(relPath, body, { contentType, upsert: true })
    if (error) throw new Error(`上传 ${relPath} 失败: ${error.message}`)
    console.log(`  ✓ ${relPath}`)
  }
}

const {
  data: { publicUrl },
} = supabase.storage.from(bucket).getPublicUrl('index.html')

console.log('== 部署到 Supabase Storage ==')
await ensureBucket()
await uploadAll()
console.log('\n完成。发这个链接进群：')
console.log(publicUrl)
