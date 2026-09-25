import { useEffect, useId, useRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Check, CircleAlert, Inbox, LoaderCircle, Mail, Moon, Sun, X } from 'lucide-react'
import { cn, senderInfo } from '../lib'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { label: string; children: ReactNode }
export function IconButton({ label, children, className, type = 'button', ...props }: IconButtonProps) {
  return <button type={type} className={cn('icon-button', className)} aria-label={label} title={label} {...props}>{children}</button>
}

export function Brand({ compact = false, name = 'Mailpass' }: { compact?: boolean; name?: string }) {
  return <div className="brand"><span className="brand-icon"><Mail size={21} strokeWidth={1.7} /></span>{!compact && <span className="brand-name" title={name}>{name}<span>RECEIVE-ONLY MAIL</span></span>}</div>
}

export function ThemeButton({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return <IconButton label={dark ? '切换浅色模式' : '切换深色模式'} onClick={onToggle}>{dark ? <Sun size={18} /> : <Moon size={18} />}</IconButton>
}

export function Avatar({ sender, large = false }: { sender: string; large?: boolean }) {
  const { name } = senderInfo(sender)
  const tone = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 5
  return <span aria-hidden="true" className={cn('avatar', `avatar-${tone}`, large && 'avatar-large')}>{name.slice(0, /^[a-z]/i.test(name) ? 2 : 1).toUpperCase()}</span>
}

export function EmptyState({ filtered, onReset, onCreate }: { filtered: boolean; onReset: () => void; onCreate: () => void }) {
  return <div className="empty-state"><div className="empty-illustration"><Inbox size={32} strokeWidth={1.3} /><span /></div><h3>{filtered ? '没有找到相关邮件' : '一切就绪，静候来信'}</h3><p>{filtered ? '试试其他关键词，或清除当前筛选条件。' : '使用任意收件地址，第一封邮件会自动出现在这里。'}</p><button className="button button-secondary" onClick={filtered ? onReset : onCreate}>{filtered ? '清除筛选' : '新建收件地址'}</button></div>
}

export function LoadingState({ label = '正在加载邮件' }: { label?: string }) {
  return <div className="loading-state" role="status"><LoaderCircle className="spin" size={22} /><span>{label}</span></div>
}

export function Toast({ toast }: { toast: { message: string; error?: boolean } | null }) {
  return <div className="toast-region" aria-live="polite" aria-atomic="true">{toast && <div className={cn('toast', toast.error && 'toast-error')}>{toast.error ? <CircleAlert size={17} /> : <Check size={17} />}<span>{toast.message}</span></div>}</div>
}

interface DialogProps { title: string; children: ReactNode; onClose: () => void; className?: string }
export function Dialog({ title, children, onClose, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    if (!dialog) return
    dialog.showModal()
    return () => { if (dialog.open) dialog.close(); if (previous instanceof HTMLElement) previous.focus() }
  }, [])
  return <dialog ref={ref} className={cn('dialog', className)} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); closeRef.current() }} onClick={(event) => {
    if (event.target !== event.currentTarget) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeRef.current()
  }}><div className="dialog-heading"><h2 id={titleId}>{title}</h2><IconButton label="关闭弹窗" onClick={onClose}><X size={18} /></IconButton></div>{children}</dialog>
}
