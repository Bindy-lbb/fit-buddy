// 生成 Supabase Edge Function 的源码：把 dist/index.html 原样吐出来，
// 带正确的 Content-Type: text/html —— Storage 公开桶不允许把 html 当 html 返回
// （官方安全策略，免费版无解），只能用一个函数来发这一个文件。
// JS/CSS/字体不受影响，继续从 Storage 读（vite.config.ts 里已经写死了绝对地址）。
//
// 用法：npm run build && npm run gen:edge-function
// 生成的文件不会自动部署——本项目没有 Supabase 管理层的 access token，
// 把 supabase/functions/app/index.ts 的内容复制进控制台的 Edge Functions 编辑器，
// 记得把「Enforce JWT Verification」关掉（这是给浏览器直接打开的公开页面，不是内部 API）。
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const htmlPath = join(root, 'dist', 'index.html')
const outDir = join(root, 'supabase', 'functions', 'app')
const outFile = join(outDir, 'index.ts')

let html
try {
  html = readFileSync(htmlPath, 'utf8')
} catch {
  console.error('找不到 dist/index.html，先跑 npm run build')
  process.exit(1)
}

const source = `// 自动生成，不要手改 —— 改 index.html 的来源，重新跑 npm run gen:edge-function
// 只做一件事：把构建好的 index.html 用正确的 Content-Type 吐出来。
const HTML = ${JSON.stringify(html)}

Deno.serve(() => {
  return new Response(HTML, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  })
})
`

mkdirSync(outDir, { recursive: true })
writeFileSync(outFile, source, 'utf8')
console.log(`已生成 ${outFile}`)
console.log('把这个文件的内容复制进 Supabase 控制台 → Edge Functions → 新建函数（名字叫 app）的代码编辑器。')
console.log('部署前记得关掉「Enforce JWT Verification」这个开关。')
