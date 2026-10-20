import shimgilinaGathering from '../../assets/shimgilina.jpg'

export function TraditionSection() {
  return (
    <>
      <section id="story" className="intro-section">
        <p className="eyebrow">Faith · family · celebration</p>
        <div className="intro-content">
          <h2>Tradition gives the day<br /><i>its deepest meaning.</i></h2>
          <div className="intro-aside">
            <p>
              From church ceremony to the family celebration, we plan with respect for
              Orthodox Tewahedo customs and room for each family&apos;s own way of celebrating.
            </p>
            <a className="text-link" href="#contact">Plan with us <span>↗</span></a>
          </div>
        </div>
        <div className="values-row">
          <div>
            <span>01</span>
            <strong>Tradition, honored</strong>
            <p>We shape the plan around your ceremony, customs, and family wishes.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Hospitality, from the heart</strong>
            <p>Welcoming guests with the warmth and care this occasion deserves.</p>
          </div>
          <div>
            <span>03</span>
            <strong>Every detail in good hands</strong>
            <p>We coordinate the people and practicalities, so your family can be present.</p>
          </div>
        </div>
      </section>

      <section className="wedding-ritual" aria-labelledby="ritual-title">
        <div className="ritual-image">
          <img
            src={shimgilinaGathering}
            alt="Family members gathered in traditional Ethiopian clothing at a family celebration"
            loading="lazy"
          />
          <span className="ritual-image-caption">THE FAMILIES, GATHERED</span>
          <small className="photo-credit">
            Photo: Elroe Tadele ·{' '}
            <a href="https://commons.wikimedia.org/wiki/File:Shimgilina.jpg">Wikimedia Commons</a>
            {' '}·{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
          </small>
        </div>
        <div className="ritual-copy">
          <p className="eyebrow">A wedding, held with reverence</p>
          <h2 id="ritual-title">First the blessing.<br /><i>Then the gathering.</i></h2>
          <p className="ritual-intro">
            In the Ethiopian Orthodox Tewahedo Church, marriage is a sacrament. The service includes
            the crowning of the bride and groom—a sacred beginning shared with family and community.
          </p>
          <div className="ritual-steps">
            <article>
              <span>01</span>
              <div>
                <h3>The church service</h3>
                <p>The couple make their vows before God and the congregation. The priest leads the service and blesses their union.</p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>The crowning</h3>
                <p>The crowns mark the couple&apos;s new life together. Families may choose red, white, or richly embroidered traditional dress for the day.</p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Family &amp; celebration</h3>
                <p>After the church, loved ones gather to eat, celebrate, and welcome the couple. Each family brings its own customs and rhythm.</p>
              </div>
            </article>
          </div>
          <a className="text-link" href="#contact">Plan around your family&apos;s traditions <span>↗</span></a>
          <p className="ritual-source">
            Ceremony details:{' '}
            <a href="https://www.ethiopianorthodox.org/english/dogma/sacramatrimony.html">
              Ethiopian Orthodox Tewahedo Church
            </a>{' '}
            ·{' '}
            <a href="https://betamasaheft.awhamburg.de/works/LIT1970Mashaf/main">
              The Book of the Crowning
            </a>
          </p>
        </div>
      </section>
    </>
  )
}
