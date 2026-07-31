import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Checkin, Member, Group, Progress } from '../types'
import * as db from './db'
import { addDays, today } from './date'
import { rememberGroup } from './identity'

/** 拉多少天的打卡记录：够算连续天数和月统计，数据量对几个人来说可以忽略 */
const HISTORY_DAYS = 120

export type GroupData = {
  group: Group | null
  members: Member[]
  checkins: Checkin[]
  progress: Map<string, Progress>
  loading: boolean
  notFound: boolean
  error: string | null
  reload: () => void
  setError: (msg: string | null) => void
  /** 打卡后先本地更新再回源，避免等网络那 200ms 让「盖章」显得没反应 */
  setCheckins: Dispatch<SetStateAction<Checkin[]>>
}

export function useGroupData(code: string): GroupData {
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [progressList, setProgressList] = useState<Progress[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstLoad = useRef(true)

  const load = useCallback(async () => {
    try {
      const g = await db.getGroup(code)
      if (!g) {
        setNotFound(true)
        return
      }
      setGroup(g)
      rememberGroup({ code: g.code, name: g.name })

      const ms = await db.listMembers(code, g.id)
      setMembers(ms)

      const [cs, ps] = await Promise.all([
        db.listCheckins(
          code,
          ms.map((m) => m.id),
          addDays(today(), -HISTORY_DAYS),
        ),
        db.listProgress(code, g.id),
      ])
      setCheckins(cs)
      setProgressList(ps)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
      firstLoad.current = false
    }
  }, [code])

  useEffect(() => {
    void load()
  }, [load])

  // 切回页面时静默刷新一次，这样看到的是朋友刚打的卡，而不是几小时前的快照
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'visible' && !firstLoad.current) void load()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [load])

  const progress = useMemo(
    () => new Map(progressList.map((p) => [p.memberId, p])),
    [progressList],
  )

  const reload = useCallback(() => {
    void load()
  }, [load])

  return {
    group,
    members,
    checkins,
    progress,
    loading,
    notFound,
    error,
    reload,
    setError,
    setCheckins,
  }
}
