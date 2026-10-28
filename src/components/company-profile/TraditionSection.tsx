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
              From the elders&apos; visit to the church ceremony and the family feast, we plan with
              respect for Orthodox Tewahedo customs and leave room for each family&apos;s own way of
              celebrating. We work with your parish, not around it.
            </p>
            <a className="text-link" href="#contact">Plan with us <span>↗</span></a>
          </div>
        </div>
        <div className="values-row">
          <div>
            <span>01</span>
            <strong>Tradition, honored</strong>
            <p>We plan around the church calendar, your parish&apos;s schedule and your family&apos;s customs.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Hospitality, from the heart</strong>
            <p>Fasting and non-fasting tables, the coffee ceremony, and a warm welcome for every guest.</p>
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
            alt="Two women in white habesha kemis with green tibeb borders sit beneath a glowing ሽምግልና sign and woven wall baskets"
            loading="lazy"
          />
          <span className="ritual-image-caption">SHIMGILINA · <span lang="am">ሽምግልና</span></span>
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
            In the Ethiopian Orthodox Tewahedo Church, marriage is a sacrament. In Teklil, the
            couple are crowned and often receive Holy Communion together. The journey begins long
            before the church, with the families.
          </p>
          <div className="ritual-steps">
            <article>
              <span>01</span>
              <div>
                <h3>Shimgilina <small lang="am">ሽምግልና</small></h3>
                <p>Elders visit the bride&apos;s family to ask for her hand and their blessing. We help host the gathering and the families&apos; celebration afterward.</p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Teklil <small lang="am">ተክሊል</small></h3>
                <p>The priest blesses and crowns the couple. We confirm the date with your parish, outside the fasting seasons, and keep the day&apos;s plan around the service.</p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>The celebration and Melse <small lang="am">መልስ</small></h3>
                <p>Loved ones gather to eat and welcome the couple, and the families meet again at Melse. Each family brings its own customs and rhythm.</p>
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
