import { Link } from 'react-router-dom'
import weddingProcession from '../assets/orthodox-wedding-procession.jpg'
import { LoginForm } from './login-form'
import { HadafeLockup } from './HadafeLogo'
import { useTranslation } from 'react-i18next'
import { LocaleSwitch } from '@/lib/i18n'

export function LoginScreen() {
  const { t } = useTranslation('auth')
  return (
    <main className="staff-login-page">
      <section className="staff-login-story" aria-label={t('storyLabel')}>
        <img
          className="staff-login-photo"
          src={weddingProcession}
          alt={t('photoAlt')}
        />
        <div className="staff-login-shade" />
        <div className="staff-login-story-top">
          <Link className="staff-login-brand" to="/" aria-label={t('home')}>
            <HadafeLockup size={44} onDark />
          </Link>
          <span className="staff-login-label">{t('portal')}</span>
        </div>
        <div className="staff-login-story-copy">
          <p className="staff-login-kicker"><span /> {t('kicker')}</p>
          <h1>{t('title1')}<br />{t('title2')}<br /><i>{t('titleAccent')}</i></h1>
          <p>{t('story')}</p>
        </div>
        <div className="staff-login-story-bottom">
          <span>{t('storyBottom')}</span>
          <Link to="/">{t('publicSite')} <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className="staff-login-panel">
        <div className="staff-login-panel-top">
          <Link to="/" className="staff-login-mobile-brand">
            <HadafeLockup size={40} />
          </Link>
          <span className="staff-login-secure"><span aria-hidden="true">✦</span> {t('staffAccess')}</span>
          <LocaleSwitch />
        </div>

        <div className="staff-login-content">
          <p className="staff-login-welcome">{t('welcome')}</p>
          <h2>{t('heading')}<br /><i>{t('headingAccent')}</i></h2>
          <p className="staff-login-instruction">{t('instruction')}</p>
          <LoginForm />
          <p className="staff-login-help">{t('help')}</p>
        </div>

        <div className="staff-login-footer"><span>{t('footerBrand')}</span><span>{t('footerPlace')}</span></div>
      </section>
    </main>
  )
}
