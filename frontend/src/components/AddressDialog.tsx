import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { copyText } from '../lib'
import type { Notify } from '../lib'
import { Dialog, IconButton } from './ui'

const randomPrefix = () => `hello-${Math.random().toString(36).slice(2, 8)}`

interface AddressDialogProps { domains: string[]; onClose: () => void; notify: Notify }
export default function AddressDialog({ domains, onClose, notify }: AddressDialogProps) {
  const [prefix, setPrefix] = useState(randomPrefix)
  const [domain, setDomain] = useState(domains[0] || '')
  const [copied, setCopied] = useState(false)
  const valid = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/i.test(prefix) && !prefix.includes('..') && !!domain
  const address = `${prefix}@${domain}`
  async function copy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid) return
    try { await copyText(address); setCopied(true); notify('收件地址已复制，可以直接使用') }
    catch (error) { notify(error.message, true) }
  }
  return <Dialog title="新建收件地址" onClose={onClose}><p className="dialog-description">取一个顺手的名字，立即开始收件。<br />地址无需注册，收到邮件后会自动出现在侧栏。</p><form onSubmit={copy}>
    <label className="field-label" htmlFor="address-prefix">地址名称</label><div className="input-wrap"><input id="address-prefix" value={prefix} maxLength={64} autoComplete="off" autoCapitalize="none" spellCheck="false" onChange={(event) => { setPrefix(event.target.value.toLowerCase()); setCopied(false) }} /><IconButton label="随机生成地址" onClick={() => { setPrefix(randomPrefix()); setCopied(false) }}><RefreshCw size={16} /></IconButton></div>
    <label className="field-label domain-select-label" htmlFor="address-domain">接收域名</label><select id="address-domain" className="select-input" value={domain} onChange={(event) => { setDomain(event.target.value); setCopied(false) }}>{domains.map((item) => <option key={item} value={item}>@{item}</option>)}</select>
    <p className="field-hint">支持字母、数字、点、短横线和下划线，以字母或数字开头和结尾。</p>
    <div className="address-preview"><span>你的收件地址</span><strong>{address}</strong></div>
    <button className="button button-primary dialog-submit" disabled={!valid}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '已复制地址' : '复制并使用'}</button>
  </form></Dialog>
}
