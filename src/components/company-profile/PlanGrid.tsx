import { useState } from 'react'
import { type Plan, ordinal } from './types'
import { EthiopianCross } from './EthiopianCross'
import { PackageModal } from './PackageModal'
import { useTranslation } from 'react-i18next'

interface PlanGridProps {
  plans: Plan[]
  onEnquire: (planId: number, packageId?: number) => void
}

const SHOWN_CEREMONIES = 3

export function PlanGrid({ plans, onEnquire }: PlanGridProps) {
  const { t } = useTranslation('website')
  const [modalPlan, setModalPlan] = useState<Plan | null>(null)
  const [emblemPlanIds, setEmblemPlanIds] = useState<number[]>([])

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>, planId: number) {
    const img = e.currentTarget
    if (Math.abs(img.naturalWidth - img.naturalHeight) < 10) {
      setEmblemPlanIds((prev) => (prev.includes(planId) ? prev : [...prev, planId]))
    }
  }

  return (
    <>
      <div className="plan-grid">
        {plans.map((plan, index) => {
          const ceremonies = plan.event_types ?? []
          const hidden = ceremonies.length - SHOWN_CEREMONIES
          const count = plan.packages.length

          return (
            <article className="plan-card" key={plan.id}>
              <div className={`plan-image${emblemPlanIds.includes(plan.id) ? ' image-emblem' : ''}`}>
                {plan.image ? (
                  <img src={plan.image} alt={plan.name} loading="lazy" onLoad={(e) => handleImageLoad(e, plan.id)} />
                ) : (
                  <div className="woven-placeholder" aria-hidden="true">
                    <EthiopianCross size={44} />
                  </div>
                )}
                <span className="plan-number">{ordinal(index)}</span>
              </div>

              <div className="plan-content">
                <h3>{plan.name}</h3>
                {plan.description && <p className="plan-description">{plan.description}</p>}

                {ceremonies.length > 0 && (
                  <ul className="plan-ceremonies" aria-label={t('plans.ceremonies')}>
                    {ceremonies.slice(0, SHOWN_CEREMONIES).map((type) => <li key={type.id}>{type.name}</li>)}
                    {hidden > 0 && <li className="is-more">+{hidden}</li>}
                  </ul>
                )}

                <div className="plan-card-actions">
                  {count > 0 ? (
                    <button className="plan-view-packages-btn" type="button" onClick={() => setModalPlan(plan)}>
                      {t('plans.packages', { count })} <span aria-hidden="true">↗</span>
                    </button>
                  ) : (
                    <span className="plan-pkg-count">{t('plans.tailored')}</span>
                  )}
                  <button className="plan-enquire-link" type="button" onClick={() => onEnquire(plan.id)}>
                    {t('plans.enquire')}
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {modalPlan && <PackageModal plan={modalPlan} onClose={() => setModalPlan(null)} onEnquire={onEnquire} />}
    </>
  )
}
