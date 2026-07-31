import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Checkin, CheckinInput, Group, Member, NewGroup, Progress, Weight } from '../types'
import * as local from './localDb'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** 没配 Supabase 时进入演示模式：数据只存本机浏览器，朋友之间不共享 */
export const isDemoMode = !URL || !KEY

/**
 * 每个小组一个客户端实例，把邀请码放进请求头。
 * 数据库的 RLS 只放行「请求头里这个码对应的小组」，所以邀请码就是凭证。
 */
const clients = new Map<string, SupabaseClient>()

function client(code: string): SupabaseClient {
  const key = code.toUpperCase()
  let c = clients.get(key)
  if (!c) {
    c = createClient(URL as string, KEY as string, {
      auth: { persistSession: false },
      global: { headers: { 'x-group-code': key } },
    })
    clients.set(key, c)
  }
  return c
}

// ---------- 行映射：snake_case ↔ camelCase 只在这一层转换 ----------

type GroupRow = {
  id: string
  code: string
  name: string
  target_days: number
  min_minutes: number
}
type MemberRow = {
  id: string
  group_id: string
  name: string
  emoji: string
  start_weight: number | string | null
  target_weight: number | string | null
  show_weight: boolean
}
type CheckinRow = {
  id: string
  member_id: string
  date: string
  exercise: string | null
  minutes: number | null
  note: string | null
  is_makeup: boolean
}
type WeightRow = { id: string; member_id: string; date: string; kg: number | string }
type ProgressRow = {
  member_id: string
  latest_kg: number | string | null
  loss_pct: number | string | null
  latest_date: string | null
}

const num = (v: number | string | null): number | null => (v == null ? null : Number(v))

const toGroup = (r: GroupRow): Group => ({
  id: r.id,
  code: r.code,
  name: r.name,
  targetDays: r.target_days,
  minMinutes: r.min_minutes,
})

const toMember = (r: MemberRow): Member => ({
  id: r.id,
  groupId: r.group_id,
  name: r.name,
  emoji: r.emoji,
  startWeight: num(r.start_weight),
  targetWeight: num(r.target_weight),
  showWeight: r.show_weight,
})

const toCheckin = (r: CheckinRow): Checkin => ({
  id: r.id,
  memberId: r.member_id,
  date: r.date,
  exercise: r.exercise,
  minutes: r.minutes,
  note: r.note,
  isMakeup: r.is_makeup,
})

const toWeight = (r: WeightRow): Weight => ({
  id: r.id,
  memberId: r.member_id,
  date: r.date,
  kg: Number(r.kg),
})

const toProgress = (r: ProgressRow): Progress => ({
  memberId: r.member_id,
  latestKg: num(r.latest_kg),
  lossPct: num(r.loss_pct),
  latestDate: r.latest_date,
})

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  if (res.data == null) throw new Error('没有拿到数据')
  return res.data
}

// ---------- 对外 API ----------

export async function createGroup(code: string, input: NewGroup): Promise<Group> {
  if (isDemoMode) return local.createGroup(code, input)
  const data = unwrap(
    await client(code)
      .from('groups')
      .insert({
        code: code.toUpperCase(),
        name: input.name,
        target_days: input.targetDays,
        min_minutes: input.minMinutes,
      })
      .select()
      .single<GroupRow>(),
  )
  return toGroup(data)
}

export async function getGroup(code: string): Promise<Group | null> {
  if (isDemoMode) return local.getGroup(code)
  const { data, error } = await client(code)
    .from('groups')
    .select()
    .eq('code', code.toUpperCase())
    .maybeSingle<GroupRow>()
  if (error) throw new Error(error.message)
  return data ? toGroup(data) : null
}

export async function listMembers(code: string, groupId: string): Promise<Member[]> {
  if (isDemoMode) return local.listMembers(groupId)
  const data = unwrap(
    await client(code)
      .from('members')
      .select()
      .eq('group_id', groupId)
      .order('created_at')
      .returns<MemberRow[]>(),
  )
  return data.map(toMember)
}

export async function createMember(
  code: string,
  input: { groupId: string; name: string; emoji: string },
): Promise<Member> {
  if (isDemoMode) return local.createMember(input)
  const data = unwrap(
    await client(code)
      .from('members')
      .insert({ group_id: input.groupId, name: input.name, emoji: input.emoji })
      .select()
      .single<MemberRow>(),
  )
  return toMember(data)
}

export async function updateMember(
  code: string,
  id: string,
  patch: Partial<Pick<Member, 'name' | 'emoji' | 'startWeight' | 'targetWeight' | 'showWeight'>>,
): Promise<Member> {
  if (isDemoMode) return local.updateMember(id, patch)
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.emoji !== undefined) row.emoji = patch.emoji
  if (patch.startWeight !== undefined) row.start_weight = patch.startWeight
  if (patch.targetWeight !== undefined) row.target_weight = patch.targetWeight
  if (patch.showWeight !== undefined) row.show_weight = patch.showWeight
  const data = unwrap(
    await client(code).from('members').update(row).eq('id', id).select().single<MemberRow>(),
  )
  return toMember(data)
}

export async function listCheckins(
  code: string,
  memberIds: string[],
  since: string,
): Promise<Checkin[]> {
  if (memberIds.length === 0) return []
  if (isDemoMode) return local.listCheckins(memberIds, since)
  const data = unwrap(
    await client(code)
      .from('checkins')
      .select()
      .in('member_id', memberIds)
      .gte('date', since)
      .returns<CheckinRow[]>(),
  )
  return data.map(toCheckin)
}

export async function upsertCheckin(code: string, input: CheckinInput): Promise<Checkin> {
  if (isDemoMode) return local.upsertCheckin(input)
  const data = unwrap(
    await client(code)
      .from('checkins')
      .upsert(
        {
          member_id: input.memberId,
          date: input.date,
          exercise: input.exercise ?? null,
          minutes: input.minutes ?? null,
          note: input.note ?? null,
          is_makeup: input.isMakeup ?? false,
        },
        { onConflict: 'member_id,date' },
      )
      .select()
      .single<CheckinRow>(),
  )
  return toCheckin(data)
}

export async function deleteCheckin(code: string, id: string): Promise<void> {
  if (isDemoMode) return local.deleteCheckin(id)
  const { error } = await client(code).from('checkins').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** 只取某个人的体重明细。别人的体重不进前端，除非对方勾了公开 */
export async function listWeights(code: string, memberId: string): Promise<Weight[]> {
  if (isDemoMode) return local.listWeights(memberId)
  const data = unwrap(
    await client(code)
      .from('weights')
      .select()
      .eq('member_id', memberId)
      .order('date')
      .returns<WeightRow[]>(),
  )
  return data.map(toWeight)
}

export async function upsertWeight(
  code: string,
  memberId: string,
  date: string,
  kg: number,
): Promise<Weight> {
  if (isDemoMode) return local.upsertWeight(memberId, date, kg)
  const data = unwrap(
    await client(code)
      .from('weights')
      .upsert({ member_id: memberId, date, kg }, { onConflict: 'member_id,date' })
      .select()
      .single<WeightRow>(),
  )
  return toWeight(data)
}

/** 排行榜用：只有减重百分比，绝对体重由数据库按 show_weight 决定给不给 */
export async function listProgress(code: string, groupId: string): Promise<Progress[]> {
  if (isDemoMode) return local.listProgress(groupId)
  const data = unwrap(
    await client(code)
      .from('member_progress')
      .select()
      .eq('group_id', groupId)
      .returns<ProgressRow[]>(),
  )
  return data.map(toProgress)
}
