/**
 * 演示模式的数据层：没配 Supabase 时用 localStorage 兜底。
 * 目的是让人立刻看到界面长什么样，不是给几个朋友真用的 —— 数据不出这台设备。
 * 接口签名与 db.ts 中的 Supabase 实现一一对应。
 */
import type { Checkin, CheckinInput, Group, Member, NewGroup, Progress, Weight } from '../types'
import { addDays, today } from './date'
import { lossPct } from './stats'

const STORE = 'fitbuddy:demo'

type Store = {
  groups: Group[]
  members: Member[]
  checkins: Checkin[]
  weights: Weight[]
}

const empty = (): Store => ({ groups: [], members: [], checkins: [], weights: [] })

function read(): Store {
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as Partial<Store>
    return {
      groups: parsed.groups ?? [],
      members: parsed.members ?? [],
      checkins: parsed.checkins ?? [],
      weights: parsed.weights ?? [],
    }
  } catch {
    return empty()
  }
}

function write(s: Store) {
  localStorage.setItem(STORE, JSON.stringify(s))
}

const id = () => crypto.randomUUID()

export async function createGroup(code: string, input: NewGroup): Promise<Group> {
  const s = read()
  const group: Group = {
    id: id(),
    code: code.toUpperCase(),
    name: input.name,
    targetDays: input.targetDays,
    minMinutes: input.minMinutes,
  }
  s.groups.push(group)
  seedFriends(s, group)
  write(s)
  return group
}

export async function getGroup(code: string): Promise<Group | null> {
  return read().groups.find((g) => g.code === code.toUpperCase()) ?? null
}

export async function listMembers(groupId: string): Promise<Member[]> {
  return read().members.filter((m) => m.groupId === groupId)
}

export async function createMember(input: {
  groupId: string
  name: string
  emoji: string
}): Promise<Member> {
  const s = read()
  const member: Member = {
    id: id(),
    groupId: input.groupId,
    name: input.name,
    emoji: input.emoji,
    startWeight: null,
    targetWeight: null,
    showWeight: false,
  }
  s.members.push(member)
  write(s)
  return member
}

export async function updateMember(memberId: string, patch: Partial<Member>): Promise<Member> {
  const s = read()
  const m = s.members.find((x) => x.id === memberId)
  if (!m) throw new Error('成员不存在')
  Object.assign(m, patch)
  write(s)
  return m
}

export async function listCheckins(memberIds: string[], since: string): Promise<Checkin[]> {
  const ids = new Set(memberIds)
  return read().checkins.filter((c) => ids.has(c.memberId) && c.date >= since)
}

export async function upsertCheckin(input: CheckinInput): Promise<Checkin> {
  const s = read()
  const existing = s.checkins.find((c) => c.memberId === input.memberId && c.date === input.date)
  if (existing) {
    if (input.exercise !== undefined) existing.exercise = input.exercise ?? null
    if (input.minutes !== undefined) existing.minutes = input.minutes ?? null
    if (input.note !== undefined) existing.note = input.note ?? null
    write(s)
    return existing
  }
  const created: Checkin = {
    id: id(),
    memberId: input.memberId,
    date: input.date,
    exercise: input.exercise ?? null,
    minutes: input.minutes ?? null,
    note: input.note ?? null,
    isMakeup: input.isMakeup ?? false,
  }
  s.checkins.push(created)
  write(s)
  return created
}

export async function deleteCheckin(checkinId: string): Promise<void> {
  const s = read()
  s.checkins = s.checkins.filter((c) => c.id !== checkinId)
  write(s)
}

export async function listWeights(memberId: string): Promise<Weight[]> {
  return read()
    .weights.filter((w) => w.memberId === memberId)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function upsertWeight(memberId: string, date: string, kg: number): Promise<Weight> {
  const s = read()
  const existing = s.weights.find((w) => w.memberId === memberId && w.date === date)
  if (existing) {
    existing.kg = kg
    write(s)
    return existing
  }
  const created: Weight = { id: id(), memberId, date, kg }
  s.weights.push(created)
  write(s)
  return created
}

export async function listProgress(groupId: string): Promise<Progress[]> {
  const s = read()
  return s.members
    .filter((m) => m.groupId === groupId)
    .map((m) => {
      const latest = s.weights
        .filter((w) => w.memberId === m.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0]
      return {
        memberId: m.id,
        latestKg: m.showWeight ? (latest?.kg ?? null) : null,
        lossPct: lossPct(m.startWeight, latest?.kg ?? null),
        latestDate: latest?.date ?? null,
      }
    })
}

// ---------- 演示数据 ----------

/** 演示模式下放三位示例成员，否则打卡墙是空的，看不出设计意图 */
function seedFriends(s: Store, group: Group) {
  const friends = [
    { name: '小雨', emoji: '🐬', start: 62, gap: 1, drop: 2.4, show: true },
    { name: '阿哲', emoji: '🐺', start: 88, gap: 4, drop: 0.9, show: false },
    { name: 'Kiwi', emoji: '🥝', start: 71.5, gap: 2, drop: 1.8, show: true },
  ]
  const t = today()
  for (const f of friends) {
    const member: Member = {
      id: id(),
      groupId: group.id,
      name: f.name,
      emoji: f.emoji,
      startWeight: f.start,
      targetWeight: Math.round((f.start - 6) * 10) / 10,
      showWeight: f.show,
    }
    s.members.push(member)

    // gap = 每几天打一次卡：1 是天天练，4 是明显在偷懒
    for (let back = 27; back >= 0; back--) {
      if (back % f.gap !== 0) continue
      if (back === 0 && f.gap > 1) continue // 今天先留空，让打卡墙有对比
      const date = addDays(t, -back)
      s.checkins.push({
        id: id(),
        memberId: member.id,
        date,
        exercise: ['跑步', '力量', '骑行', '快走'][back % 4],
        minutes: 30 + (back % 3) * 15,
        note: null,
        isMakeup: false,
      })
    }

    // 体重：四周内线性下降到 start - drop
    for (let week = 0; week < 5; week++) {
      const date = addDays(t, -(28 - week * 7))
      const kg = Math.round((f.start - (f.drop * week) / 4) * 10) / 10
      s.weights.push({ id: id(), memberId: member.id, date, kg })
    }
  }
}
