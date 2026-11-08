import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatEthiopian, formatGregorian, todayUtc, upcomingPeriods } from '@/lib/ethiopian-calendar'
import { TibebBand } from './EthiopianCross'

export function ChurchYearSection() {
  const { t, i18n } = useTranslation('website')
  const amharic = i18n.language !== 'en'
  const today = useMemo(() => todayUtc(), [])
  const periods = useMemo(() => upcomingPeriods(today, 6), [today])

  return (
    <section id="church-year" className="church-year-section" aria-labelledby="church-year-title">
      <TibebBand className="church-year-band" />
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            <span lang="am">የቤተ ክርስቲያን ዘመን</span>{!amharic && <> · {t('churchYear.eyebrow')}</>}
          </p>
          <h2 id="church-year-title">{t('churchYear.title')}<br /><i>{t('churchYear.titleAccent')}</i></h2>
        </div>
        <p>
          {t('churchYear.bodyBefore')} <strong lang="am">{formatEthiopian(today, 'am')}</strong>{' '}
          ({formatGregorian(today)}). {t('churchYear.bodyAfter')}
        </p>
      </div>

      <ol className="church-year-list">
        {periods.map((p) => {
          const sameDay = p.start.getTime() === p.end.getTime()
          return (
            <li key={`${p.key}-${p.start.toISOString()}`} className={`church-year-item church-year-item--${p.kind}`}>
              <span className="church-year-kind">{p.kind === 'fast' ? t('churchYear.fast') : t('churchYear.feast')}</span>
              <h3>
                <span lang="am">{p.am}</span>
                {!amharic && <small>{p.name}</small>}
              </h3>
              <p className="church-year-dates">
                {formatEthiopian(p.start)}
                {!sameDay && <> – {formatEthiopian(p.end)}</>}
                <small>
                  {formatGregorian(p.start)}
                  {!sameDay && <> – {formatGregorian(p.end)}</>}
                </small>
              </p>
              <p className="church-year-note">
                {t(`churchYear.notes.${p.key as ChurchNoteKey}`, { defaultValue: p.note })}
              </p>
            </li>
          )
        })}
      </ol>
      <p className="church-year-footnote">{t('churchYear.footnote')}</p>
    </section>
  )
}

type ChurchNoteKey = keyof typeof import('@/i18n/en/website').default.churchYear.notes
