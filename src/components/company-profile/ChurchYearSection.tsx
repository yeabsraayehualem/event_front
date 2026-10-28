import { useMemo } from 'react'
import { formatEthiopian, formatGregorian, todayUtc, upcomingPeriods } from '@/lib/ethiopian-calendar'
import { TibebBand } from './EthiopianCross'

export function ChurchYearSection() {
  const today = useMemo(() => todayUtc(), [])
  const periods = useMemo(() => upcomingPeriods(today, 6), [today])

  return (
    <section id="church-year" className="church-year-section" aria-labelledby="church-year-title">
      <TibebBand className="church-year-band" />
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            <span lang="am">የቤተ ክርስቲያን ዘመን</span> · The church year
          </p>
          <h2 id="church-year-title">We plan around<br /><i>the feasts and the fasts.</i></h2>
        </div>
        <p>
          Church weddings (Teklil) are not held during the fasting seasons, and feast days fill
          quickly. Today is <strong lang="am">{formatEthiopian(today, 'am')}</strong>{' '}
          ({formatGregorian(today)}). Here is what is coming up.
        </p>
      </div>

      <ol className="church-year-list">
        {periods.map((p) => {
          const sameDay = p.start.getTime() === p.end.getTime()
          return (
            <li key={`${p.key}-${p.start.toISOString()}`} className={`church-year-item church-year-item--${p.kind}`}>
              <span className="church-year-kind">{p.kind === 'fast' ? 'Fast · ጾም' : 'Feast · በዓል'}</span>
              <h3>
                <span lang="am">{p.am}</span>
                <small>{p.name}</small>
              </h3>
              <p className="church-year-dates">
                {formatEthiopian(p.start)}
                {!sameDay && <> – {formatEthiopian(p.end)}</>}
                <small>
                  {formatGregorian(p.start)}
                  {!sameDay && <> – {formatGregorian(p.end)}</>}
                </small>
              </p>
              <p className="church-year-note">{p.note}</p>
            </li>
          )
        })}
      </ol>
      <p className="church-year-footnote">
        Wednesdays and Fridays are also fast days, except in the fifty days after Fasika. We confirm
        every church date with your parish.
      </p>
    </section>
  )
}
