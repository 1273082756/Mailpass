import { useCallback, useEffect, useRef, useState } from 'react'
import type { InboxData } from './lib'
import { API, DEFAULT_REFRESH_INTERVAL, PAGE_SIZE, REFRESH_INTERVALS, readStorage, writeStorage } from './lib'

interface UseInboxProps { accessKey: string; onLogout: () => void; query: string; address: string; unreadOnly: boolean; page: number }
export function useInbox({ accessKey, onLogout, query, address, unreadOnly, page }: UseInboxProps) {
  const [data, setData] = useState<InboxData>({ items: [], total: 0, unread: 0, allTotal: 0, addresses: [], config: { site_name: 'Mailpass', domains: [], smtp_enabled: false } })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshInterval, setRefreshInterval] = useState(() => {
    const saved = readStorage('localStorage', 'tempmail-refresh-interval')
    return REFRESH_INTERVALS.find((option) => String(option.seconds) === saved)?.seconds ?? DEFAULT_REFRESH_INTERVAL
  })
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  const api = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${API}${path}`, { ...options, headers: { ...(options.body && { 'Content-Type': 'application/json' }), ...options.headers, 'X-Access-Key': accessKey } })
    if (response.status === 401) { onLogout(); throw new Error('访问密钥已失效，请重新登录') }
    if (!response.ok) throw new Error(response.status === 404 ? '这封邮件已不存在' : '请求未完成，请稍后重试')
    return response.json()
  }, [accessKey, onLogout])

  const refresh = useCallback(async (quiet = false) => {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) })
      if (query.trim()) params.set('q', query.trim())
      if (address) params.set('address', address)
      if (unreadOnly) params.set('unread', 'true')
      const options: RequestInit = { signal: controller.signal }
      const [messages, addresses, config, all] = await Promise.all([
        api(`/messages?${params}`, options), api('/addresses', options), api('/config', options),
        query.trim() || address || unreadOnly ? api('/messages?limit=1', options) : Promise.resolve(null),
      ])
      if (controller.signal.aborted) return
      setData({ ...messages, addresses, config, allTotal: all?.total ?? messages.total })
      setError('')
      setLastUpdated(new Date())
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof TypeError ? '无法连接收件箱，请检查网络后重试。' : error instanceof Error ? error.message : '请求未完成，请稍后重试')
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setRefreshing(false) }
    }
  }, [api, query, address, unreadOnly, page])

  useEffect(() => {
    refresh()
    return () => requestRef.current?.abort()
  }, [refresh])

  useEffect(() => {
    writeStorage('localStorage', 'tempmail-refresh-interval', String(refreshInterval))
  }, [refreshInterval])

  useEffect(() => {
    if (!refreshInterval || loading || refreshing) { setNextRefreshAt(null); return }
    const deadline = Date.now() + refreshInterval * 1000
    setNextRefreshAt(deadline)
    let timer: number | undefined
    let started = false
    function tick() {
      window.clearTimeout(timer)
      if (started || document.hidden) return
      const delay = deadline - Date.now()
      if (delay > 0) timer = window.setTimeout(tick, delay)
      else { started = true; void refresh(true) }
    }
    tick()
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [refreshInterval, loading, refreshing, refresh])

  return { ...data, api, refresh, loading, refreshing, error, lastUpdated, refreshInterval, setRefreshInterval, nextRefreshAt }
}
