// 自动生成，不要手改 —— 改 index.html 的来源，重新跑 npm run gen:edge-function
// 只做一件事：把构建好的 index.html 用正确的 Content-Type 吐出来。
const HTML = "<!doctype html>\n<html lang=\"zh-CN\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, viewport-fit=cover\" />\n    <meta name=\"theme-color\" content=\"#F2EDE3\" media=\"(prefers-color-scheme: light)\" />\n    <meta name=\"theme-color\" content=\"#121110\" media=\"(prefers-color-scheme: dark)\" />\n    <title>打卡墙 · FitBuddy</title>\n    <script type=\"module\" crossorigin src=\"https://vsvtrwxcuvsugkggjhqn.supabase.co/storage/v1/object/public/app/assets/index-DBWJjbDf.js\"></script>\n    <link rel=\"stylesheet\" crossorigin href=\"https://vsvtrwxcuvsugkggjhqn.supabase.co/storage/v1/object/public/app/assets/index-C-LX5dHp.css\">\n  </head>\n  <body>\n    <div id=\"root\"></div>\n  </body>\n</html>\n"

Deno.serve(() => {
  return new Response(HTML, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  })
})
