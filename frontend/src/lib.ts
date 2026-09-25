export const API = '/api'
export const PAGE_SIZE = 50
export const DEFAULT_REFRESH_INTERVAL = 15
export const REFRESH_INTERVALS = [
  { seconds: 5, label: '每 5 秒' },
  { seconds: 15, label: '每 15 秒' },
  { seconds: 30, label: '每 30 秒' },
  { seconds: 60, label: '每 1 分钟' },
  { seconds: 300, label: '每 5 分钟' },
  { seconds: 0, label: '关闭自动刷新' },
]
export type StorageName = 'localStorage' | 'sessionStorage'
export type Notify = (message: string, error?: boolean) => void
export interface Attachment { name: string; type?: string; size: number }
export interface MessageSummary {
  id: number
  sender: string
  recipients: string[]
  subject: string
  received_at: string
  is_read: boolean
  attachments: Attachment[]
  raw_size: number
}
export interface MessageDetail extends MessageSummary { text_body: string; html_body: string }
export interface AddressStat { address: string; total: number; unread: number }
export interface MailConfig { site_name: string; domain?: string; domains: string[]; smtp_port?: number; smtp_enabled: boolean }
export interface InboxData { items: MessageSummary[]; total: number; unread: number; allTotal: number; addresses: AddressStat[]; config: MailConfig }
export interface ToastState { message: string; error?: boolean }
export const cn = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ')

export function readStorage(storage: StorageName, key: string, fallback = ''): string {
  try { return window[storage].getItem(key) ?? fallback } catch { return fallback }
}

export function writeStorage(storage: StorageName, key: string, value: string | null): void {
  try {
    if (value === null) window[storage].removeItem(key)
    else window[storage].setItem(key, value)
  } catch { /* The app also works when browser storage is unavailable. */ }
}

export function senderInfo(value = ''): { name: string; address: string } {
  const match = value.match(/^(.*?)\s*<([^>]+)>$/)
  const address = match ? match[2] : value
  const name = (match?.[1] || address.split('@')[0] || '未知发件人').replace(/^"|"$/g, '').trim()
  return { name, address }
}

export function formatDate(value: string, full = false): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  if (full) return date.toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  if (date.toDateString() === new Date().toDateString()) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  return date.toLocaleDateString('zh-CN', { ...(date.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }), month: 'numeric', day: 'numeric' })
}

export function formatBytes(value = 0): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(value); return } catch { /* Try the HTTP-compatible fallback. */ }
  }
  const previous = document.activeElement
  const input = document.createElement('textarea')
  input.value = value
  input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;top:0;left:0'
  // Native modal dialogs make elements outside the dialog inert.
  ;(document.querySelector('dialog[open]') || document.body).append(input)
  input.select()
  const copied = document.execCommand('copy')
  input.remove()
  if (previous instanceof HTMLElement) previous.focus()
  if (!copied) throw new Error('复制失败，请手动选择地址复制')
}
