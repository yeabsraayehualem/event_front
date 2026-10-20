import weddingProcession from '../../assets/orthodox-wedding-procession.jpg'

export function HeroSection() {
  return (
    <section id="top" className="hero-section">
      <div className="hero-copy">
        <p className="eyebrow"><span /> በእምነት ሥር · ETHIOPIAN ORTHODOX TEWAHEDO</p>
        <h1>A day crowned<br /><i>in faith &amp; joy.</i></h1>
        <p className="hero-description">
          A sacred beginning, dressed in the colors of home. We bring together the church,
          the families, and every detail of the celebration.
        </p>
        <div className="hero-actions">
          <a className="button button-light" href="#experiences">Explore our celebrations <span>↓</span></a>
          <a className="text-link" href="#contact">Plan your wedding <span>↗</span></a>
        </div>
        <div className="hero-note"><span className="note-rule" /> ጋብቻ · ጥምቀት · ሽምግልና</div>
      </div>
      <div className="hero-image-wrap hero-photo">
        <img
          src={weddingProcession}
          alt="An Ethiopian Orthodox wedding procession, with the couple in red and gold ceremonial clothing among guests dressed in white"
        />
        <div className="image-caption">
          <span>THE SACRAMENT OF CROWNING</span>
          <span>በረከት · ቤተሰብ · ደስታ</span>
        </div>
        <small className="photo-credit">
          Photo: ZeevRo ·{' '}
          <a href="https://commons.wikimedia.org/wiki/File:Wedding_ceremony_at_Ethiopian_church_-_%D7%98%D7%A7%D7%A1_%D7%97%D7%AA%D7%95%D7%A0%D7%94_%D7%9E%D7%A1%D7%95%D7%A8%D7%AA%D7%99_%D7%91%D7%9B%D7%A0%D7%A1%D7%99%D7%99%D7%94_%D7%94%D7%90%D7%AA%D7%99%D7%95%D7%A4%D7%99%D7%AA.jpg">
            Wikimedia Commons
          </a>{' '}
          · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
        </small>
      </div>
      <div className="hero-index" aria-hidden="true"><span>01</span><i /> A S A C R E D B E G I N N I N G</div>
    </section>
  )
}
