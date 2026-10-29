import { useEffect, useState } from 'react'
import { EthiopianCross } from './EthiopianCross'

const links = [
  { href: '#story', label: 'Our tradition' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#experiences', label: 'Celebrations' },
  { href: '#church-year', label: 'Church year' },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className={`site-header web-header${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <a className="brand" href="#top" aria-label="Bahran Events home" onClick={() => setOpen(false)}>
        <span className="brand-mark"><EthiopianCross size={22} /></span>
        <span className="brand-name">Bahran <em>EVENTS</em></span>
      </a>
      <nav id="site-menu" className="site-nav" aria-label="Main navigation">
        {links.map((link) => <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}
        <a className="web-nav-cta" href="#contact" onClick={() => setOpen(false)}>Start planning <span aria-hidden="true">↗</span></a>
      </nav>
      <button
        type="button"
        className="web-menu-toggle"
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((value) => !value)}
      >
        <span /><span /><span />
      </button>
    </header>
  )
}
