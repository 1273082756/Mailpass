import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { API, readStorage, writeStorage } from '../lib'
import { Brand, IconButton, ThemeButton } from './ui'

interface LoginProps { onAuthenticated: (key: string, remember: boolean) => void; dark: boolean; onToggleTheme: () => void }
export default function Login({ onAuthenticated, dark, onToggleTheme }: LoginProps) {
  const [key, setKey] = useState(() => readStorage('localStorage', 'tempmail-remember-key'))
  const [remember, setRemember] = useState(() => Boolean(readStorage('localStorage', 'tempmail-remember-key')))
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!key.trim()) { setError('请输入访问密钥'); return }
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API}/auth/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: key.trim() }) })
      if (!response.ok) throw new Error(response.status === 503 ? '服务端尚未配置访问密钥' : response.status === 401 ? '密钥不正确，请重新输入' : '服务暂时不可用，请稍后重试')
      writeStorage('localStorage', 'tempmail-remember-key', remember ? key.trim() : null)
      onAuthenticated(key.trim(), remember)
    } catch (error) { setError(error instanceof TypeError ? '无法连接服务器，请检查网络后重试' : error.message) }
    finally { setLoading(false) }
  }

  return <main className="login-layout">
    <section className="login-main">
      <header className="login-header"><Brand /><ThemeButton dark={dark} onToggle={onToggleTheme} /></header>
      <div className="login-form-wrap">
        <div className="login-lock"><LockKeyhole size={25} strokeWidth={1.5} /></div>
        <div className="eyebrow">YOUR PRIVATE MAILROOM</div>
        <h1>欢迎回来。</h1>
        <p className="login-description">让每一封来信，都有自己的位置。<br />输入访问密钥，进入你的邮件工作空间。</p>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="access-key">访问密钥</label>
          <div className="input-wrap"><KeyRound size={17} /><input id="access-key" type={visible ? 'text' : 'password'} value={key} onChange={(event) => { setKey(event.target.value); setError('') }} placeholder="输入你的访问密钥" autoComplete={remember ? 'current-password' : 'off'} required aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} /><IconButton label={visible ? '隐藏密钥' : '显示密钥'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</IconButton></div>
          <label className="remember-option"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span className="remember-check" aria-hidden="true">✓</span><span>记住密码</span><small>仅保存在当前浏览器</small></label>
          {error && <p id="login-error" className="field-error" role="alert">{error}</p>}
          <button className="button button-primary login-submit" disabled={loading}>{loading ? <LoaderCircle size={17} className="spin" /> : <>进入工作空间<ArrowRight size={17} /></>}</button>
        </form>
        <div className="login-note"><ShieldCheck size={15} />私密访问 · 无需注册邮箱</div>
      </div>
      <footer className="login-footer"><span>Mailpass</span><span>Simple receiving, zero noise.</span></footer>
    </section>
    <section className="login-showcase" aria-label="产品介绍">
      <div className="showcase-top"><span className="small-caps">LESS NOISE. MORE FOCUS.</span><span className="showcase-pill"><span className="status-dot" />为简单而设计</span></div>
      <div className="mail-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-sheet sheet-back" /><div className="art-sheet sheet-middle" /><div className="art-envelope"><div className="art-envelope-fold" /><span className="art-seal"><Mail size={28} strokeWidth={1.3} /></span></div><span className="art-spark spark-one" /><span className="art-spark spark-two" /></div>
      <div className="showcase-copy"><span className="eyebrow">A LITTLE SPACE FOR YOUR MAIL</span><h2>来信有序，<br /><span>一切从简。</span></h2><p>所有地址，一个收件箱。<br />从第一封来信开始，让信息回归清晰。</p></div>
      <div className="showcase-bottom"><span>01 / 收件，原来可以很简单</span><span className="showcase-dashes"><i /><i /><i /></span></div>
    </section>
  </main>
}
