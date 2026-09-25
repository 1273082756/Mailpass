import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, AtSign, ChevronRight, CircleAlert, Copy, Inbox, LoaderCircle, Mail, PanelLeft, Paperclip, Plus, Search, Trash2, X } from 'lucide-react'
import type { MessageDetail as MailMessageDetail, MessageSummary, ToastState, Notify } from './lib'
import { API, cn, copyText, formatDate, PAGE_SIZE, REFRESH_INTERVALS, readStorage, senderInfo, writeStorage } from './lib'
import { useInbox } from './useInbox'
import AddressDialog from './components/AddressDialog'
import Login from './components/Login'
import MessageDetail from './components/MessageDetail'
import Sidebar from './components/Sidebar'
import RefreshControl from './components/RefreshControl'
import { Avatar, Dialog, EmptyState, IconButton, LoadingState, ThemeButton, Toast } from './components/ui'

export default function App() {
  const [accessKey, setAccessKey] = useState<string>(() => readStorage('sessionStorage', 'tempmail-access-key'))
  const [dark, setDark] = useState(() => readStorage('localStorage', 'tempmail-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') === 'dark')
  const [siteName, setSiteName] = useState('Mailpass')
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17191d' : '#f5f6f8')
    writeStorage('localStorage', 'tempmail-theme', dark ? 'dark' : 'light')
  }, [dark])
  useEffect(() => {
    fetch(`${API}/health`).then((response) => response.ok ? response.json() : null).then((payload) => {
      if (payload?.site_name) setSiteName(payload.site_name)
    }).catch(() => undefined)
  }, [])
  useEffect(() => { document.title = siteName }, [siteName])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  const notify: Notify = useCallback((message: string, error = false) => {
    window.clearTimeout(toastTimer.current)
    setToast({ message, error })
    toastTimer.current = window.setTimeout(() => setToast(null), 3500)
  }, [])
  const onLogout = useCallback(() => { writeStorage('sessionStorage', 'tempmail-access-key', null); setAccessKey('') }, [])
  const onAuthenticated = useCallback((key: string, remember: boolean) => { writeStorage('sessionStorage', 'tempmail-access-key', key); writeStorage('localStorage', 'tempmail-remember-key', remember ? key : null); setAccessKey(key) }, [])
  const onToggleTheme = () => setDark((value) => !value)
  return <>{accessKey ? <Workspace accessKey={accessKey} onLogout={onLogout} dark={dark} onToggleTheme={onToggleTheme} notify={notify} siteName={siteName} /> : <Login onAuthenticated={onAuthenticated} dark={dark} onToggleTheme={onToggleTheme} siteName={siteName} />}<Toast toast={toast} /></>
}

interface WorkspaceProps { accessKey: string; onLogout: () => void; dark: boolean; onToggleTheme: () => void; notify: Notify; siteName: string }
function Workspace({ accessKey, onLogout, dark, onToggleTheme, notify, siteName }: WorkspaceProps) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [address, setAddress] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selected, setSelected] = useState<MailMessageDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailVersion, setDetailVersion] = useState(0)
  const [mobileNav, setMobileNav] = useState(false)
  const [addressDialog, setAddressDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<boolean>(false)
  const [busy, setBusy] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const searchRef = useRef(null)
  const data = useInbox({ accessKey, onLogout, query: search, address, unreadOnly, page })
  const refreshRef = useRef(data.refresh)
  refreshRef.current = data.refresh
  const filtered = !!(search || address || unreadOnly)
  const selectedIndex = data.items.findIndex((item) => item.id === selectedId)
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const selectors = '.topbar, .page-heading, .overview, .workspace-footer, .mail-list-pane'
    document.querySelectorAll<HTMLElement>(selectors).forEach((element) => { element.inert = isMobile && selectedId !== null })
    return () => document.querySelectorAll<HTMLElement>(selectors).forEach((element) => { element.inert = false })
  }, [isMobile, selectedId])

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query); setPage(0) }, 250)
    return () => window.clearTimeout(timer)
  }, [query])
  useEffect(() => {
    if (!data.loading && !data.error && page >= totalPages) setPage(totalPages - 1)
  }, [data.loading, data.error, page, totalPages])
  useEffect(() => {
    function keydown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) {
        event.preventDefault(); setSelectedId(null); requestAnimationFrame(() => searchRef.current?.focus())
      }
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setSelectedId(null)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [])
  useEffect(() => {
    if (selectedId === null) { setSelected(null); return }
    const controller = new AbortController()
    setSelected(null); setDetailLoading(true); setDetailError('')
    async function open() {
      try {
        const detail = await data.api(`/messages/${selectedId}`, { signal: controller.signal })
        if (controller.signal.aborted) return
        setSelected(detail); setDetailLoading(false)
        if (!detail.is_read) {
          try {
            await data.api(`/messages/${selectedId}/read`, { method: 'PATCH', body: JSON.stringify({ is_read: true }), signal: controller.signal })
            if (!controller.signal.aborted) { setSelected({ ...detail, is_read: true }); refreshRef.current(true) }
          } catch { if (!controller.signal.aborted) notify('邮件已打开，但未能更新已读状态', true) }
        }
      } catch (error) {
        if (!controller.signal.aborted) { setDetailError(error.message); setDetailLoading(false) }
      }
    }
    open()
    return () => controller.abort()
  }, [selectedId, detailVersion, data.api, notify])

  function navigate(nextAddress = '', nextUnread = false) {
    setAddress(nextAddress); setUnreadOnly(nextUnread); setPage(0); setSelectedId(null); setMobileNav(false)
  }
  function resetFilters() { setQuery(''); setSearch(''); navigate() }
  async function copy(value) {
    try { await copyText(value); notify('收件地址已复制') } catch (error) { notify(error.message, true) }
  }
  async function toggleRead() {
    if (!selected || busy) return
    const message = selected
    setBusy(true)
    try {
      await data.api(`/messages/${message.id}/read`, { method: 'PATCH', body: JSON.stringify({ is_read: !message.is_read }) })
      setSelected((current) => current?.id === message.id ? { ...current, is_read: !message.is_read } : current)
      data.refresh(true); notify(message.is_read ? '已标为未读' : '已标为已读')
    } catch (error) { notify(error.message, true) }
    finally { setBusy(false) }
  }
  async function deleteMessage() {
    if (!selected || busy) return
    setBusy(true)
    try {
      await data.api(`/messages/${selected.id}`, { method: 'DELETE' })
      setDeleteDialog(false); setSelectedId(null); data.refresh(true); notify('邮件已删除')
    } catch (error) { notify(error.message, true) }
    finally { setBusy(false) }
  }
  const sidebarProps = { data, address, unreadOnly, onNavigate: navigate, onLogout, dark, onToggleTheme, siteName }
  const pageTitle = address ? address.split('@')[0] : unreadOnly ? '未读邮件' : '收件箱'

  return <div className="workspace">
    <a className="skip-link" href="#mailbox">跳至邮件列表</a>
    <aside className="sidebar"><Sidebar {...sidebarProps} /></aside>
    <main className="workspace-main">
      <header className="topbar"><div className="breadcrumb"><IconButton label="打开导航" className="mobile-menu" onClick={() => setMobileNav(true)}><PanelLeft size={20} /></IconButton><span className="breadcrumb-home">Workspace</span><ChevronRight className="breadcrumb-chevron" size={14} /><strong>Mail management</strong><span className="private-badge">Private</span></div><div className="topbar-right"><span className="connection-label"><span className={cn('status-dot', (data.error || !data.config.smtp_enabled) && 'status-muted')} />{data.error ? '连接中断' : data.config.smtp_enabled ? '收件服务已启用' : data.lastUpdated ? '收件服务已暂停' : '正在连接'}</span><ThemeButton dark={dark} onToggle={onToggleTheme} /><span className="topbar-avatar" aria-label={`当前工作空间：${siteName}`}>{siteName.slice(0, 1).toUpperCase()}</span></div></header>
      <div className="workspace-body">
        <section className="page-heading"><div><div className="eyebrow">MAIL OVERVIEW</div><h1 title={address || undefined}>{pageTitle}<span className="heading-dot">.</span></h1><p>{address ? address : '每一封来信，尽在掌握。'}</p></div><button className="button button-primary new-address-button" onClick={() => setAddressDialog(true)} disabled={!data.config.domains?.length}><Plus size={17} /><span>新建收件地址</span></button></section>
        <section className="overview" aria-label="邮箱概览"><button className={cn('metric', !address && !unreadOnly && 'metric-active')} onClick={() => navigate()}><span className="metric-icon"><Inbox size={20} strokeWidth={1.6} /></span><span className="metric-info"><span>全部邮件</span><strong>{data.allTotal.toLocaleString()}<small>封</small></strong></span><span className="metric-note">所有来信，统一收录</span><ChevronRight size={15} className="metric-arrow" /></button><button className={cn('metric', unreadOnly && 'metric-active')} onClick={() => navigate('', true)}><span className="metric-icon blue"><Mail size={20} strokeWidth={1.6} /></span><span className="metric-info"><span>未读邮件</span><strong>{data.unread.toLocaleString()}<small>封</small></strong></span><span className="metric-note">{data.unread ? '留一点时间，看看新消息' : '所有来信都已阅览'}</span><ChevronRight size={15} className="metric-arrow" /></button><div className="metric"><span className="metric-icon green"><AtSign size={20} strokeWidth={1.6} /></span><span className="metric-info"><span>收件地址</span><strong>{data.addresses.length.toLocaleString()}<small>个</small></strong></span><span className="metric-note">随用随收，自由命名</span></div></section>
        <section id="mailbox" className={cn('mailbox', selectedId !== null && 'has-selection')} aria-label="收件箱">
          <div className="mail-list-pane"><div className="mailbox-toolbar"><div className="segmented" aria-label="邮件筛选"><button className={!unreadOnly ? 'selected' : ''} aria-pressed={!unreadOnly} onClick={() => { setUnreadOnly(false); setPage(0) }}>全部<span>{address ? data.addresses.find((item) => item.address === address)?.total ?? 0 : data.allTotal}</span></button><button className={unreadOnly ? 'selected' : ''} aria-pressed={unreadOnly} onClick={() => { setUnreadOnly(true); setPage(0) }}>未读<span>{address ? data.addresses.find((item) => item.address === address)?.unread ?? 0 : data.unread}</span></button></div><div className="list-tools"><label className="search-field"><Search size={16} /><input ref={searchRef} value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(null) }} placeholder="搜索邮件…" aria-label="搜索发件人、主题或正文" />{query ? <IconButton label="清除搜索" onClick={() => setQuery('')}><X size={14} /></IconButton> : <kbd>⌘ K</kbd>}</label><RefreshControl interval={data.refreshInterval} nextRefreshAt={data.nextRefreshAt} refreshing={data.refreshing || data.loading} onIntervalChange={data.setRefreshInterval} onRefresh={data.refresh} /></div></div>
          {address && <div className="filter-strip"><AtSign size={13} /><span title={address}>{address}</span><IconButton label="清除地址筛选" onClick={() => navigate('', unreadOnly)}><X size={13} /></IconButton><IconButton label="复制当前地址" onClick={() => copy(address)}><Copy size={13} /></IconButton></div>}
          {data.error && <div className="error-banner" role="alert"><CircleAlert size={16} /><span>{data.error}</span><button onClick={() => data.refresh()}>重试</button></div>}
          <div className="mail-table-header" aria-hidden="true"><span>发件人</span><span>邮件主题</span><span>收件地址</span><span>时间<ArrowDown size={12} /></span></div>
          <div className="mail-list" aria-busy={data.loading}>{data.loading ? <LoadingState /> : data.items.length ? <ul aria-label="邮件列表">{data.items.map((message) => <MessageRow key={message.id} message={message} selected={message.id === selectedId} onClick={() => setSelectedId(message.id)} />)}</ul> : !data.error && <EmptyState filtered={filtered} onReset={resetFilters} onCreate={() => setAddressDialog(true)} />}</div>
          <footer className="list-footer"><span>{data.total ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, data.total)}` : '0'}<span className="footer-muted"> / 共 {data.total} 封</span></span><span className="auto-refresh"><span className={cn('status-dot', (data.error || !data.refreshInterval) && 'status-muted')} />{data.refreshInterval ? `${REFRESH_INTERVALS.find((option) => option.seconds === data.refreshInterval)?.label}自动同步` : '自动同步已关闭'}</span><div className="pagination"><IconButton label="上一页" disabled={page === 0 || data.loading} onClick={() => { setPage(page - 1); setSelectedId(null) }}><ChevronRight className="rotate-180" size={16} /></IconButton><span>{page + 1} / {totalPages}</span><IconButton label="下一页" disabled={page + 1 >= totalPages || data.loading} onClick={() => { setPage(page + 1); setSelectedId(null) }}><ChevronRight size={16} /></IconButton></div></footer>
          </div>
          {selectedId !== null && <MessageDetail key={selectedId} message={selected} loading={detailLoading || (!selected && !detailError)} error={detailError} onRetry={() => setDetailVersion((value) => value + 1)} onClose={() => setSelectedId(null)} onDelete={() => setDeleteDialog(true)} onCopy={copy} onToggleRead={toggleRead} busy={busy} onPrevious={selectedIndex > 0 ? () => setSelectedId(data.items[selectedIndex - 1].id) : undefined} onNext={selectedIndex >= 0 && selectedIndex < data.items.length - 1 ? () => setSelectedId(data.items[selectedIndex + 1].id) : undefined} position={selectedIndex >= 0 ? `本页第 ${selectedIndex + 1} 封` : '已收录'} />}
        </section>
        <footer className="workspace-footer"><span>{siteName}<span className="footer-separator">/</span>Simple receiving, zero noise.</span><span>{data.lastUpdated ? `上次同步 ${data.lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}` : '正在同步…'}</span></footer>
      </div>
    </main>
    {mobileNav && <Dialog title="工作空间" onClose={() => setMobileNav(false)} className="navigation-dialog"><Sidebar {...sidebarProps} /></Dialog>}
    {addressDialog && <AddressDialog domains={data.config.domains || []} onClose={() => setAddressDialog(false)} notify={notify} />}
    {deleteDialog && <Dialog title="删除这封邮件？" onClose={() => { if (!busy) setDeleteDialog(false) }}><div className="delete-icon"><Trash2 size={23} /></div><p className="dialog-description">「{selected?.subject || '(无主题)'}」将被永久删除，此操作无法撤销。</p><div className="dialog-actions"><button className="button button-secondary" onClick={() => setDeleteDialog(false)} disabled={busy}>保留邮件</button><button className="button button-danger" onClick={deleteMessage} disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}确认删除</button></div></Dialog>}
  </div>
}

function MessageRow({ message, selected, onClick }) {
  const sender = senderInfo(message.sender)
  return <li><button className={cn('message-row', !message.is_read && 'is-unread', selected && 'is-selected')} aria-current={selected ? 'true' : undefined} onClick={onClick} aria-label={`${message.is_read ? '' : '未读，'}${sender.name}，${message.subject || '(无主题)'}`}><span className="message-sender"><span className="unread-dot" /><Avatar sender={message.sender} /><span className="sender-name" title={message.sender}>{sender.name}</span></span><span className="message-subject"><span>{message.subject || '(无主题)'}</span>{message.attachments?.length > 0 && <Paperclip size={14} />}</span><span className="message-recipient" title={message.recipients?.join(', ')}>{message.recipients?.[0] || '未知地址'}{message.recipients?.length > 1 && <small>+{message.recipients.length - 1}</small>}</span><time className="message-time" dateTime={message.received_at} title={formatDate(message.received_at, true)}>{formatDate(message.received_at)}</time><ChevronRight className="message-chevron" size={15} /></button></li>
}
