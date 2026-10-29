import { useEffect, useState } from 'react'
import { apiBaseUrl } from '@/lib/api'
import { EthiopianCross } from './EthiopianCross'

type ShowcaseEntry = {
  id: number
  kind: 'service' | 'gallery' | 'testimonial'
  title: string
  description: string
  image_url: string | null
  attribution: string
}

/**
 * Gallery photos and family testimonials published from the Django admin (Website → Showcase entries).
 * Each section stays hidden until something is published, so the page never shows placeholder praise.
 */
export function Showcase() {
  const [entries, setEntries] = useState<ShowcaseEntry[]>([])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${apiBaseUrl}/website/showcase/`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((body: unknown) => {
        const list = Array.isArray(body) ? body : Array.isArray((body as { results?: unknown })?.results) ? (body as { results: unknown[] }).results : []
        setEntries(list as ShowcaseEntry[])
      })
      .catch(() => setEntries([]))
    return () => controller.abort()
  }, [])

  const gallery = entries.filter((entry) => entry.kind === 'gallery' && entry.image_url)
  const testimonials = entries.filter((entry) => entry.kind === 'testimonial' && entry.description)

  return (
    <>
      {gallery.length > 0 && (
        <section className="web-gallery" aria-labelledby="gallery-title">
          <div className="web-section-head">
            <p className="eyebrow">Moments we have shared · <span lang="am">ትውስታዎች</span></p>
            <h2 id="gallery-title">Celebrations<br /><i>we were honored to plan.</i></h2>
          </div>
          <div className="web-gallery-grid">
            {gallery.slice(0, 7).map((entry) => (
              <figure key={entry.id}>
                <img src={entry.image_url ?? ''} alt={entry.description || entry.title} loading="lazy" />
                <figcaption>
                  <strong>{entry.title}</strong>
                  {entry.attribution && <span>{entry.attribution}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {testimonials.length > 0 && (
        <section className="web-testimonials" aria-labelledby="testimonials-title">
          <div className="web-section-head">
            <p className="eyebrow">Kind words · <span lang="am">ምስጋና</span></p>
            <h2 id="testimonials-title">From the families<br /><i>we have served.</i></h2>
          </div>
          <div className="web-testimonial-grid">
            {testimonials.slice(0, 3).map((entry) => (
              <figure key={entry.id}>
                <span className="web-testimonial-mark" aria-hidden="true"><EthiopianCross size={20} /></span>
                <blockquote>{entry.description}</blockquote>
                <figcaption>
                  <strong>{entry.attribution || entry.title}</strong>
                  {entry.attribution && entry.title && <span>{entry.title}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
