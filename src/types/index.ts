export type Group = {
  id: string
  code: string
  name: string
  targetDays: number
  minMinutes: number
}

export type Member = {
  id: string
  groupId: string
  name: string
  emoji: string
  startWeight: number | null
  targetWeight: number | null
  showWeight: boolean
}

export type Checkin = {
  id: string
  memberId: string
  date: string // YYYY-MM-DD
  exercise: string | null
  minutes: number | null
  note: string | null
  isMakeup: boolean
}

export type Weight = {
  id: string
  memberId: string
  date: string // YYYY-MM-DD
  kg: number
}

/** 排行榜数据：只有减重百分比是公开的，未公开体重的人 latestKg 为 null */
export type Progress = {
  memberId: string
  latestKg: number | null
  lossPct: number | null
  latestDate: string | null
}

export type NewGroup = {
  name: string
  targetDays: number
  minMinutes: number
}

export type CheckinInput = {
  memberId: string
  date: string
  exercise?: string | null
  minutes?: number | null
  note?: string | null
  isMakeup?: boolean
}

export const EXERCISES = ['跑步', '快走', '力量', '骑行', '游泳', '球类', '其他'] as const
