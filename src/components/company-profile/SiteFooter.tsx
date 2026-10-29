import { EthiopianCross, TibebBand } from './EthiopianCross'

const YEAR = new Date().getFullYear()

export function SiteFooter() {
  return (
    <footer className="site-footer web-footer">
      <TibebBand className="web-footer-band" />
      <div className="web-footer-main">
        <div className="web-footer-brand">
          <a className="brand footer-brand" href="#top">
            <span className="brand-mark"><EthiopianCross size={22} /></span>
            <span className="brand-name">BAHRAN <em>EVENTS</em></span>
          </a>
          <p>Orthodox weddings, Kiristina, Tezkar, Mahber and holiday gatherings, planned around your parish and the church year.</p>
          <p className="web-footer-blessing" lang="am">እግዚአብሔር ይባርካችሁ</p>
        </div>
        <nav className="web-footer-links" aria-label="Footer">
          <strong>Explore</strong>
          <a href="#story">Our tradition</a>
          <a href="#how-it-works">How it works</a>
          <a href="#experiences">Celebrations &amp; packages</a>
          <a href="#church-year">The church year</a>
        </nav>
        <div className="web-footer-links">
          <strong>Plan with us</strong>
          <a href="#contact">Send an inquiry</a>
          <span>Addis Ababa, Ethiopia</span>
        </div>
      </div>
      <div className="web-footer-bottom">
        <span>© {YEAR} Bahran Events · Faith · family · celebration</span>
        <a className="staff-login" href="/login">Staff login ↗</a>
      </div>
    </footer>
  )
}
