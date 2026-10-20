import { useState } from 'react'
import { type Plan } from './types'
import { PackageModal } from './PackageModal'

interface PlanGridProps {
  plans: Plan[]
  onEnquire: (planId: number, packageId?: number) => void
}

export function PlanGrid({ plans, onEnquire }: PlanGridProps) {
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
        {plans.map((plan, index) => (
          <article className="plan-card" key={plan.id}>
            <div className={`plan-image${emblemPlanIds.includes(plan.id) ? ' image-emblem' : ''}`}>
              {plan.image ? (
                <img
                  src={plan.image}
                  alt={plan.name}
                  loading="lazy"
                  onLoad={(e) => handleImageLoad(e, plan.id)}
                />
              ) : (
                <div className="woven-placeholder" aria-hidden="true">
                  <span>✥</span>
                </div>
              )}
              <span className="plan-number">0{index + 1}</span>
            </div>

            <div className="plan-content">
              <p className="eyebrow">Aster celebration</p>
              <h3>{plan.name}</h3>
              {plan.description && (
                <p className="plan-description">{plan.description}</p>
              )}

              <div className="plan-card-actions">
                {plan.packages.length > 0 ? (
                  <>
                    <p className="plan-pkg-count">
                      <span className="plan-pkg-cross" aria-hidden="true">✥</span>
                      {plan.packages.length} package{plan.packages.length !== 1 ? 's' : ''} available
                    </p>
                    <button
                      className="plan-view-packages-btn"
                      type="button"
                      onClick={() => setModalPlan(plan)}
                    >
                      View packages <span aria-hidden="true">↗</span>
                    </button>
                  </>
                ) : (
                  <button
                    className="package-cta standalone-cta"
                    type="button"
                    onClick={() => onEnquire(plan.id)}
                  >
                    Enquire about this experience <span>↗</span>
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {modalPlan && (
        <PackageModal
          plan={modalPlan}
          onClose={() => setModalPlan(null)}
          onEnquire={onEnquire}
        />
      )}
    </>
  )
}
