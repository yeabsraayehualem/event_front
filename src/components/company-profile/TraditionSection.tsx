import { useTranslation } from 'react-i18next'

export function TraditionSection() {
  const { t } = useTranslation('website')
  return (
    <section id="story" className="intro-section">
      <p className="eyebrow">{t('tradition.eyebrow')}</p>
      <div className="intro-content">
        <h2>{t('tradition.title')}<br /><i>{t('tradition.titleAccent')}</i></h2>
        <div className="intro-aside">
          <p>{t('tradition.body')}</p>
          <a className="text-link" href="#contact">{t('tradition.plan')} <span>↗</span></a>
        </div>
      </div>
    </section>
  )
}
