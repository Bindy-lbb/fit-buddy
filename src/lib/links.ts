/**
 * 邀请链接统一在这里拼，不要在页面里手写 `${location.origin}/g/${code}`。
 * 用 HashRouter 是因为托管在 Supabase Storage 上没有 SPA 重写规则，
 * 深链接必须落在 hash 后面才能保证任何时候都能回到 index.html。
 */
export function groupInviteUrl(code: string): string {
  return `${location.origin}${location.pathname}#/g/${code}`
}
