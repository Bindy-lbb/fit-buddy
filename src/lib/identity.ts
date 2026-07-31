/**
 * 身份识别：没有账号体系，「我是谁」存在本机。
 * 换手机或清缓存后重新在成员列表里点一次自己即可，历史数据不丢。
 */

const IDENTITY = (code: string) => `fitbuddy:identity:${code.toUpperCase()}`
const RECENT = 'fitbuddy:recent'

export function getIdentity(code: string): string | null {
  try {
    return localStorage.getItem(IDENTITY(code))
  } catch {
    return null
  }
}

export function setIdentity(code: string, memberId: string) {
  try {
    localStorage.setItem(IDENTITY(code), memberId)
  } catch {
    /* 隐私模式下写不进去，不影响当次使用 */
  }
}

export function clearIdentity(code: string) {
  try {
    localStorage.removeItem(IDENTITY(code))
  } catch {
    /* ignore */
  }
}

export type RecentGroup = { code: string; name: string }

export function getRecentGroups(): RecentGroup[] {
  try {
    const raw = localStorage.getItem(RECENT)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (g): g is RecentGroup =>
        !!g && typeof (g as RecentGroup).code === 'string' && typeof (g as RecentGroup).name === 'string',
    )
  } catch {
    return []
  }
}

export function rememberGroup(group: RecentGroup) {
  try {
    const list = getRecentGroups().filter((g) => g.code !== group.code)
    list.unshift(group)
    localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 5)))
  } catch {
    /* ignore */
  }
}

/** 6 位邀请码，去掉 0/O/1/I 这类容易读错的字符 */
export function makeGroupCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}
