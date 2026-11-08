import { useTranslation } from 'react-i18next'
import type { Locale } from '@/i18n'

export type { Locale } from '@/i18n'
export { intlLocale } from '@/i18n'

export const LOCALES: { code: Locale; label: string; name: string }[] = [
  { code: 'am', label: 'አማ', name: 'አማርኛ' },
  { code: 'en', label: 'EN', name: 'English' },
]

/** Current language and a setter; the choice is remembered on this device. */
export function useLocale() {
  const { i18n } = useTranslation()
  const locale: Locale = i18n.resolvedLanguage === 'en' ? 'en' : 'am'
  return { locale, setLocale: (next: Locale) => void i18n.changeLanguage(next) }
}

/** Two-button language switch (አማ / EN). */
export function LocaleSwitch({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  return (
    <div className={`locale-switch ${className ?? ''}`} role="group" aria-label="Language / ቋንቋ">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          aria-pressed={locale === l.code}
          title={l.name}
          onClick={() => setLocale(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
