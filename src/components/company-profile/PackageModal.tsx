import { useEffect, useRef } from 'react'
import { type Package, type Plan } from './types'
import { EthiopianCross } from './EthiopianCross'
import { useTranslation } from 'react-i18next'

interface PackageModalProps {
  plan: Plan
  onClose: () => void
  onEnquire: (planId: number, packageId: number) => void
}

export function PackageModal({ plan, onClose, onEnquire }: PackageModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation('website')

  // Close on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="pkg-modal-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={t('packageModal.label', { plan: plan.name })}
    >
      <div className="pkg-modal" ref={dialogRef}>
        <div className="pkg-modal-header">
          <div className="pkg-modal-title-group">
            <p className="pkg-modal-eyebrow">{t('packageModal.eyebrow')}</p>
            <h2 className="pkg-modal-title">{plan.name}</h2>
            {plan.description && (
              <p className="pkg-modal-subtitle">{plan.description}</p>
            )}
          </div>
          <button
            className="pkg-modal-close"
            type="button"
            onClick={onClose}
            aria-label={t('packageModal.close')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="pkg-modal-body">
          {plan.packages.length === 0 ? (
            <p className="pkg-modal-empty">
              {t('packageModal.empty')}
            </p>
          ) : (
            <div className="pkg-modal-grid">
              {plan.packages.map((pkg: Package, idx) => (
                <article className="pkg-tile" key={pkg.id}>
                  <div className="pkg-tile-accent" aria-hidden="true">
                    <span className="pkg-tile-num">0{idx + 1}</span>
                    <span className="pkg-tile-cross"><EthiopianCross size={18} /></span>
                  </div>
                  <div className="pkg-tile-body">
                    <div className="pkg-tile-top">
                      <h3 className="pkg-tile-name">{pkg.name}</h3>
                    </div>
                    {pkg.description && (
                      <p className="pkg-tile-desc">{pkg.description}</p>
                    )}
                    {pkg.contents.length > 0 && (
                      <ul className="pkg-tile-contents">
                        {pkg.contents.map((c) => (
                          <li key={c.id}>
                            <span className="pkg-tile-bullet" aria-hidden="true">✦</span>
                            <div>
                              <strong>{c.name}</strong>
                              {c.description && <p>{c.description}</p>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      className="pkg-tile-cta"
                      type="button"
                      onClick={() => {
                        onEnquire(plan.id, pkg.id)
                        onClose()
                      }}
                    >
                      {t('packageModal.enquire')} <span>↗</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
