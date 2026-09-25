import { useEffect, useRef, useState } from 'react'
import type { MessageDetail as MailMessageDetail } from '../lib'
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, File, Mail, MailOpen, Paperclip, Trash2, X } from 'lucide-react'
import { formatBytes, formatDate, senderInfo } from '../lib'
import { Avatar, IconButton, LoadingState } from './ui'

interface MessageDetailProps {
  message: MailMessageDetail | null
  loading: boolean
  error: string
  onRetry: () => void
  onClose: () => void
  onDelete: () => void
  onCopy: (value: string) => void
  onToggleRead: () => void
  busy: boolean
  onPrevious?: () => void
  onNext?: () => void
  position: string
}
export default function MessageDetail({ message, loading, error, onRetry, onClose, onDelete, onCopy, onToggleRead, busy, onPrevious, onNext, position }: MessageDetailProps) {
  const [bodyMode, setBodyMode] = useState('html')
  const readerRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    readerRef.current?.focus({ preventScroll: true })
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  const sender = senderInfo(message?.sender || '')
  return <article ref={readerRef} tabIndex={-1} className="reader" aria-label="邮件详情">
    <div className="reader-toolbar"><button className="reader-back" onClick={onClose}><ArrowLeft size={17} /><span>收件箱</span></button><span className="reader-toolbar-label">邮件详情</span><div className="reader-actions"><IconButton label={message?.is_read ? '标为未读' : '标为已读'} disabled={!message || busy} onClick={onToggleRead}>{message?.is_read ? <Mail size={17} /> : <MailOpen size={17} />}</IconButton><IconButton label="删除邮件" className="danger-hover" disabled={!message || busy} onClick={onDelete}><Trash2 size={17} /></IconButton><span className="toolbar-divider" /><IconButton label="上一封邮件" disabled={!onPrevious} onClick={onPrevious}><ChevronLeft size={18} /></IconButton><IconButton label="下一封邮件" disabled={!onNext} onClick={onNext}><ChevronRight size={18} /></IconButton><IconButton label="关闭详情" className="desktop-close" onClick={onClose}><X size={17} /></IconButton></div></div>
    {loading ? <LoadingState /> : error ? <div className="empty-state"><h3>邮件暂时无法打开</h3><p>{error}</p><button className="button button-secondary" onClick={onRetry}>重新加载</button></div> : message && <>
      <div className="reader-scroll"><header className="message-heading"><div className="message-category"><span className="message-category-dot" />收到的邮件<span>{formatBytes(message.raw_size)}</span></div><h2>{message.subject || '(无主题)'}</h2><div className="sender-block"><Avatar sender={message.sender} large /><div className="sender-info"><strong>{sender.name}</strong><span title={sender.address}>{sender.address}</span></div><time dateTime={message.received_at}>{formatDate(message.received_at, true)}</time></div><div className="recipient-line"><span>收件人</span><div>{message.recipients?.map((recipient) => <button key={recipient} onClick={() => onCopy(recipient)} title={`复制 ${recipient}`}>{recipient}<Copy size={12} /></button>)}</div></div></header>
      {message.html_body && <div className="body-mode"><div className="segmented small" aria-label="正文显示方式"><button className={bodyMode === 'html' ? 'selected' : ''} aria-pressed={bodyMode === 'html'} onClick={() => setBodyMode('html')}>原始排版</button><button className={bodyMode === 'text' ? 'selected' : ''} aria-pressed={bodyMode === 'text'} onClick={() => setBodyMode('text')}>纯文本</button></div></div>}
      <div className="mail-body">{message.html_body && bodyMode === 'html' ? <iframe title="邮件正文" sandbox="" referrerPolicy="no-referrer" srcDoc={message.html_body} /> : <pre>{message.text_body || '这封邮件没有可显示的正文。'}</pre>}</div>
      {message.attachments?.length > 0 && <section className="attachments"><h3><Paperclip size={15} />附件 <span>{message.attachments.length}</span></h3><div className="attachment-grid">{message.attachments.map((attachment, index) => <div className="attachment" key={`${attachment.name}-${index}`}><span className="attachment-icon"><File size={21} strokeWidth={1.5} /></span><div><strong title={attachment.name}>{attachment.name}</strong><span>{formatBytes(attachment.size)}</span></div></div>)}</div><p>当前仅保留附件信息，暂不支持下载。</p></section>}
      </div><footer className="reader-footer"><span>所有来信，妥善收录。</span><span>{position}</span></footer>
    </>}
  </article>
}
