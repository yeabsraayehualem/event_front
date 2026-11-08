import { useTranslation } from 'react-i18next'
import weddingProcession from '../../assets/orthodox-wedding-procession.jpg'

export function HeroSection() {
  const { t } = useTranslation('website')
  const english = t('hero.eyebrow')
  return (
    <section id="top" className="hero-section">
      <div className="hero-copy">
        <p className="eyebrow">
          <span /> <em className="eyebrow-am" lang="am" style={{ fontStyle: 'normal' }}>የኢትዮጵያ ኦርቶዶክስ ተዋሕዶ</em>
          {english && <> · {english}</>}
        </p>
        <h1>{t('hero.title')}<br /><i>{t('hero.titleAccent')}</i></h1>
        <p className="hero-description">{t('hero.body')}</p>
        <div className="hero-actions">
          <a className="button button-light" href="#experiences">{t('hero.explore')} <span>↓</span></a>
          <a className="text-link" href="#contact">{t('hero.plan')}<span>↗</span></a>
        </div>
      </div>
      <div className="hero-image-wrap hero-photo">
        <img src={weddingProcession} alt={t('hero.imageAlt')} />
        <div className="image-caption">
          <span lang="am">በረከት · ቤተሰብ · ደስታ</span>
        </div>
      </div>
    </section>
  )
}
