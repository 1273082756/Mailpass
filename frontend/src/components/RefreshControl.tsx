import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Pause, RefreshCw, Timer } from 'lucide-react'
import { cn, DEFAULT_REFRESH_INTERVAL, REFRESH_INTERVALS } from '../lib'

interface RefreshControlProps {
  interval: number
  nextRefreshAt: number | null
  refreshing: boolean
  onIntervalChange: (seconds: number) => void
  onRefresh: (quiet?: boolean) => Promise<void>
}

export default function RefreshControl({ interval, nextRefreshAt, refreshing, onIntervalChange, onRefresh }: RefreshControlProps) {
  const [open, setOpen] = useState(false)
  const [remaining, setRemaining] = useState(interval)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const controlRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const refreshRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const initialFocus = useRef(0)
  const menuId = useId()
  const frequency = REFRESH_INTERVALS.find((option) => option.seconds === interval)?.label

  // Only this control renders each second; the inbox keeps its existing data.
  useEffect(() => {
    if (nextRefreshAt === null) { setRemaining(interval); return }
    const update = () => setRemaining(Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000)))
    update()
    const timer = window.setInterval(update, 250)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [nextRefreshAt, interval])

  useLayoutEffect(() => {
    if (!open) return
    function reposition() {
      const control = controlRef.current?.getBoundingClientRect()
      const menu = menuRef.current?.getBoundingClientRect()
      if (!control || !menu) return
      setPosition({
        left: Math.max(8, Math.min(control.right - menu.width, window.innerWidth - menu.width - 8)),
        top: control.bottom + menu.height + 8 <= window.innerHeight - 8
          ? control.bottom + 8 : Math.max(8, control.top - menu.height - 8),
      })
    }
    reposition()
    optionRefs.current[initialFocus.current]?.focus({ preventScroll: true })
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function dismiss(event: Event) {
      const target = event.target as Node
      if (!controlRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('focusin', dismiss)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('focusin', dismiss)
    }
  }, [open])

  function showMenu(index = REFRESH_INTERVALS.findIndex((option) => option.seconds === interval)) {
    initialFocus.current = Math.max(0, index)
    setOpen(true)
  }

  function closeMenu() {
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }

  function menuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = optionRefs.current.findIndex((option) => option === document.activeElement)
    let next: number | undefined
    if (event.key === 'ArrowDown') next = (index + 1) % REFRESH_INTERVALS.length
    if (event.key === 'ArrowUp') next = (index - 1 + REFRESH_INTERVALS.length) % REFRESH_INTERVALS.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = REFRESH_INTERVALS.length - 1
    if (next !== undefined) { event.preventDefault(); optionRefs.current[next]?.focus() }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu() }
    if (event.key === 'Tab') {
      if (event.shiftKey || !refreshRef.current?.disabled) {
        event.preventDefault()
        ;(event.shiftKey ? triggerRef : refreshRef).current?.focus()
        setOpen(false)
      } else {
        // Resume native tab order from the trigger when refresh is disabled.
        closeMenu()
      }
    }
  }

  const countdown = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
  return <div ref={controlRef} className={cn('refresh-control', open && 'is-open', !interval && 'is-paused')} role="group" aria-label="邮件刷新">
    <button ref={triggerRef} type="button" className="refresh-settings" aria-label={`设置自动刷新频率，当前${interval ? frequency : '已关闭'}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} title={refreshing ? '正在刷新邮件' : interval ? `下次自动刷新：${remaining} 秒后，点击设置频率` : '自动刷新已关闭，点击设置频率'} onClick={() => open ? closeMenu() : showMenu()} onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        showMenu(event.key === 'ArrowUp' ? REFRESH_INTERVALS.length - 1 : undefined)
      }
    }}>
      {interval ? <Timer size={14} strokeWidth={1.7} className="refresh-timer" /> : <Pause size={14} strokeWidth={1.7} />}
      <span className={cn('refresh-countdown', (refreshing || !interval) && 'refresh-label')}>{refreshing ? '刷新中' : interval ? countdown : '已关闭'}</span>
      <ChevronDown size={12} className="refresh-chevron" />
    </button>
    <button ref={refreshRef} type="button" className="refresh-now" aria-label="立即刷新邮件" title="立即刷新邮件" disabled={refreshing} onClick={() => { setOpen(false); void onRefresh(true) }}>
      <RefreshCw size={16} strokeWidth={1.7} className={refreshing ? 'spin' : ''} />
    </button>
    {open && createPortal(<div ref={menuRef} id={menuId} className="refresh-menu" role="menu" aria-label="自动刷新频率" style={position} onKeyDown={menuKeyDown}>
      <div className="refresh-menu-heading" role="presentation">刷新频率<span>自动同步来信</span></div>
      {REFRESH_INTERVALS.map((option, index) => <button key={option.seconds} ref={(element) => { optionRefs.current[index] = element }} type="button" role="menuitemradio" aria-checked={interval === option.seconds} tabIndex={-1} className={cn('refresh-option', interval === option.seconds && 'is-selected', !option.seconds && 'refresh-option-off')} onClick={() => { onIntervalChange(option.seconds); closeMenu() }}>
        <span>{option.label}</span>
        {option.seconds === DEFAULT_REFRESH_INTERVAL && <small>默认</small>}
        <span className="refresh-option-check">{interval === option.seconds && <Check size={14} strokeWidth={2} />}</span>
      </button>)}
    </div>, document.body)}
  </div>
}
