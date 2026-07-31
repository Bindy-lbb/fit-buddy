import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5180 },
  // 静态和入口页现在同源（EdgeOne Pages 一起托管），相对路径就够用，
  // 不用再像 Supabase Storage 那次一样写死绝对地址。
  base: './',
})
