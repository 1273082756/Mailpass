import { AtSign, ChevronRight, Circle, Globe2, Inbox, LogOut, Mail, ShieldCheck } from 'lucide-react'
import type { InboxData } from '../lib'
import { cn } from '../lib'
import { Brand, IconButton, ThemeButton } from './ui'

interface SidebarProps { data: InboxData; address: string; unreadOnly: boolean; onNavigate: (address?: string, unreadOnly?: boolean) => void; onLogout: () => void; dark: boolean; onToggleTheme: () => void }
export default function Sidebar({ data, address, unreadOnly, onNavigate, onLogout, dark, onToggleTheme }: SidebarProps) {
  return <div className="sidebar-content">
    <div className="sidebar-brand"><Brand /></div>
    <div className="workspace-label"><span className="workspace-avatar">白</span><div><strong>我的工作空间</strong><span>个人邮箱管理</span></div><ShieldCheck size={16} /></div>
    <div className="sidebar-section-label">工作空间</div>
    <nav className="sidebar-nav" aria-label="邮箱导航">
      <button className={cn('nav-item', !address && !unreadOnly && 'active')} aria-current={!address && !unreadOnly ? 'page' : undefined} onClick={() => onNavigate('', false)}><Inbox size={18} /><span>全部邮件</span><span className="nav-count">{data.allTotal}</span></button>
      <button className={cn('nav-item', unreadOnly && 'active')} aria-current={unreadOnly ? 'page' : undefined} onClick={() => onNavigate('', true)}><Mail size={18} /><span>未读邮件</span>{data.unread > 0 && <span className="nav-count">{data.unread}</span>}</button>
    </nav>
    <div className="sidebar-section-label address-label"><span>收件地址</span><span>{data.addresses.length}</span></div>
    <nav className="address-list" aria-label="按收件地址筛选">
      {data.addresses.length ? data.addresses.map((item) => <button key={item.address} className={cn('address-item', address === item.address && 'active')} title={item.address} aria-current={address === item.address ? 'page' : undefined} onClick={() => onNavigate(item.address, false)}><AtSign size={16} /><span className="address-item-text"><strong>{item.address.split('@')[0]}</strong><span>@{item.address.split('@')[1]}</span></span>{item.unread > 0 ? <span className="address-count">{item.unread}</span> : <ChevronRight size={13} className="address-chevron" />}</button>) : <p className="sidebar-empty">收到来信后，地址会<br />自动整理在这里。</p>}
    </nav>
    <div className="sidebar-bottom">
      <div className="domain-panel"><div><Globe2 size={15} /><span>接收域名</span><span className={cn('status-dot', !data.config.smtp_enabled && 'status-muted')} /></div>{data.config.domains?.map((domain) => <span className="domain-name" key={domain}>{domain}</span>)}{!data.config.domains?.length && <span className="domain-name">等待连接…</span>}<p><Circle size={5} fill="currentColor" />任意地址，无需预先创建</p></div>
      <div className="sidebar-account"><span className="account-avatar">M</span><div><strong>Mailpass</strong><span>Personal inbox</span></div><ThemeButton dark={dark} onToggle={onToggleTheme} /><IconButton label="退出登录" onClick={onLogout}><LogOut size={16} /></IconButton></div>
    </div>
  </div>
}
