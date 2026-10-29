import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { type Package, type Plan, currency } from './types'
import { EthiopianCross } from './EthiopianCross'

interface PlanShowcaseProps {
  plans: Plan[]
  onEnquire: (planId: number, packageId?: number) => void
}

function priceOf(pkg: Package) {
  const amount = Number(pkg.price)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function startingPrice(plan: Plan) {
  const prices = plan.packages.map(priceOf).filter((price): price is number => price !== null)
  return prices.length ? Math.min(...prices) : null
}

/** Every service offered anywhere in the plan, in first-seen order, so packages can be compared line by line. */
function planServices(plan: Plan) {
  const seen = new Map<number, Package['contents'][number]>()
  for (const pkg of plan.packages) for (const content of pkg.contents) if (!seen.has(content.id)) seen.set(content.id, content)
  return [...seen.values()]
}

export function PlanShowcase({ plans, onEnquire }: PlanShowcaseProps) {
  const [activeId, setActiveId] = useState(plans[0]?.id)
  // Plans whose picture failed to load fall back to the cross mark instead of a broken image.
  const [brokenImages, setBrokenImages] = useState<Set<number>>(() => new Set())
  const imageFor = (item: Plan) => (item.image && !brokenImages.has(item.id) ? item.image : null)
  const markBroken = (id: number) => setBrokenImages((current) => new Set(current).add(id))
  const baseId = useId()
  const plan = plans.find((item) => item.id === activeId) ?? plans[0]
  const services = useMemo(() => (plan ? planServices(plan) : []), [plan])

  if (!plan) return null
  const planIndex = plans.indexOf(plan)
  const fullest = plan.packages.length > 1
    ? plan.packages.reduce((best, pkg) => (pkg.contents.length > best.contents.length ? pkg : best))
    : null
  // Only call a package "most complete" when it clearly includes more than every other one.
  const mostComplete = fullest && plan.packages.filter((pkg) => pkg.contents.length === fullest.contents.length).length === 1 ? fullest : null

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = plans[(index + (event.key === 'ArrowRight' ? 1 : plans.length - 1)) % plans.length]
    setActiveId(next.id)
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus()
  }

  return (
    <div className="web-plans">
      {plans.length > 1 && (
        <div className="web-plan-tabs" role="tablist" aria-label="Our celebrations">
          {plans.map((item, index) => {
            const from = startingPrice(item)
            const selected = item.id === plan.id
            return (
              <button
                key={item.id}
                id={`${baseId}-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                className={selected ? 'is-active' : ''}
                onClick={() => setActiveId(item.id)}
                onKeyDown={(event) => onTabKey(event, index)}
              >
                <span className="web-plan-tab-thumb" aria-hidden="true">
                  {imageFor(item) ? <img src={imageFor(item) ?? ''} alt="" onError={() => markBroken(item.id)} /> : <EthiopianCross size={18} />}
                </span>
                <span className="web-plan-tab-text">
                  <strong>{item.name}</strong>
                  <small>{from !== null ? `From ${currency(String(from))}` : item.packages.length ? 'Tailored quote' : 'Made to order'}</small>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${plan.id}`} className="web-plan-panel" key={plan.id}>
        <div className="web-plan-feature">
          <div className="web-plan-arch">
            {imageFor(plan)
              ? <img src={imageFor(plan) ?? ''} alt={plan.name} onError={() => markBroken(plan.id)} />
              : <span className="web-plan-arch-cross" aria-hidden="true"><EthiopianCross size={72} /></span>}
          </div>
          <div className="web-plan-intro">
            <p className="eyebrow">Celebration {String(planIndex + 1).padStart(2, '0')} of {String(plans.length).padStart(2, '0')}</p>
            <h3>{plan.name}</h3>
            {plan.description && <p className="web-plan-description">{plan.description}</p>}
            {plan.event_types && plan.event_types.length > 0 && (
              <div className="web-plan-for">
                <span>Ideal for</span>
                <ul>{plan.event_types.map((item) => <li key={item.id}>{item.name}</li>)}</ul>
              </div>
            )}
            <div className="web-plan-facts">
              <div><strong>{plan.packages.length || '—'}</strong><span>{plan.packages.length === 1 ? 'package' : 'packages'}</span></div>
              <div><strong>{services.length || '—'}</strong><span>{services.length === 1 ? 'service' : 'services'}</span></div>
              <div><strong>{startingPrice(plan) !== null ? currency(String(startingPrice(plan))) : 'On request'}</strong><span>starting price</span></div>
            </div>
          </div>
        </div>

        {plan.packages.length === 0 ? (
          <div className="web-plan-empty">
            <EthiopianCross size={26} />
            <div>
              <strong>Every {plan.name} is made to order.</strong>
              <p>Tell us about your family and your date, and we will put together a package and a quote for you.</p>
            </div>
            <button type="button" className="button button-dark" onClick={() => onEnquire(plan.id)}>Ask for a quote <span>↗</span></button>
          </div>
        ) : (
          <>
            <div className="web-packages">
              {plan.packages.map((pkg) => {
                const price = priceOf(pkg)
                const included = new Set(pkg.contents.map((content) => content.id))
                const highlight = mostComplete?.id === pkg.id
                return (
                  <article key={pkg.id} className={`web-package${highlight ? ' is-highlight' : ''}`}>
                    {highlight && <span className="web-package-badge">Most complete</span>}
                    <header>
                      <h4>{pkg.name}</h4>
                      <p className="web-package-price">
                        {price !== null ? <>{currency(String(price))}<small>tax included</small></> : <>Tailored quote<small>priced with your family</small></>}
                      </p>
                      {pkg.description && <p className="web-package-desc">{pkg.description}</p>}
                    </header>
                    {services.length > 0 && (
                      <ul className="web-package-services" aria-label={`What ${pkg.name} includes`}>
                        {services.map((service) => {
                          const has = included.has(service.id)
                          return (
                            <li key={service.id} className={has ? '' : 'is-missing'}>
                              <span className="web-package-check" aria-hidden="true">{has ? '✓' : '–'}</span>
                              <div>
                                <strong>{service.name}</strong>
                                <span className="sr-only">{has ? ' (included)' : ' (not included)'}</span>
                                {has && service.description && <p>{service.description}</p>}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    <button type="button" className={`web-package-cta${highlight ? ' is-primary' : ''}`} onClick={() => onEnquire(plan.id, pkg.id)}>
                      Choose {pkg.name} <span aria-hidden="true">↗</span>
                    </button>
                  </article>
                )
              })}
            </div>
            <p className="web-plans-footnote">
              <EthiopianCross size={14} /> Every package can be adjusted for your parish, your guests and fasting or non-fasting tables.{' '}
              <button type="button" onClick={() => onEnquire(plan.id)}>Ask us to tailor one ↗</button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
