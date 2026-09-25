import { useCallback, useEffect, useRef, useState } from 'react'
import type { InboxData } from './lib'
import { API, PAGE_SIZE } from './lib'

interface UseInboxProps { accessKey: string; onLogout: () => void; query: string; address: string; unreadOnly: boolean; page: number }
export function useInbox({ accessKey, onLogout, query, address, unreadOnly, page }: UseInboxProps) {
  const [data, setData] = useState<InboxData>({ items: [], total: 0, unread: 0, allTotal: 0, addresses: [], config: { domains: [], smtp_enabled: false } })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
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
    const timer = window.setInterval(() => { if (!document.hidden) refresh(true) }, 15000)
    return () => { window.clearInterval(timer); requestRef.current?.abort() }
  }, [refresh])

  return { ...data, api, refresh, loading, refreshing, error, lastUpdated }
}
