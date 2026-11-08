import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import { apiBaseUrl } from '@/lib/api'
import { fetchCsrfToken } from '@/lib/csrf'
import { formatDualDate } from '@/lib/ethiopian-calendar'
import { useTranslation } from 'react-i18next'
import i18n, { intlLocale } from '@/i18n'

export type ChatterModel = 'lead' | 'event' | 'project' | 'invoice' | 'plan' | 'package' | 'vendor' | 'purchaseorder' | 'expense' | 'employee' | 'user'

type TrackingValue = { field: string; field_label: string; old_value: string; new_value: string }
type ChatterMessage = {
  id: number
  kind: 'note' | 'tracking' | 'system'
  body: string
  author: { id: number; name: string } | null
  created_at: string
  tracking_values: TrackingValue[]
}

type ChatterProps = {
  model: ChatterModel
  recordId: number
  /** Change this value (e.g. after a save) to reload the history. */
  refreshKey?: number
}

const avatarTones = ['#5b211e', '#a64f42', '#8d6c32', '#3f6a7a', '#6b4f7a', '#5c6b3a']

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?'
}

function avatarTone(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return avatarTones[Math.abs(hash) % avatarTones.length]
}

function dayLabel(date: Date) {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return i18n.t('chatter:today')
  if (date.toDateString() === yesterday.toDateString()) return i18n.t('chatter:yesterday')
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return formatDualDate(iso)
}

function relativeTime(date: Date) {
  const relative = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto', style: 'short' })
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return relative.format(0, 'second')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relative.format(-hours, 'hour')
  return date.toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' })
}

function TrackingLine({ value }: { value: TrackingValue }) {
  const { t } = useTranslation('chatter')
  return (
    <li className="o-chatter-tracking">
      <span className={value.old_value ? 'o-chatter-old' : 'o-chatter-old is-empty'}>{value.old_value || t('none')}</span>
      <span className="o-chatter-arrow" aria-label={t('changedTo')}>→</span>
      <span className={value.new_value ? 'o-chatter-new' : 'o-chatter-new is-empty'}>{value.new_value || t('none')}</span>
      <span className="o-chatter-field">({value.field_label})</span>
    </li>
  )
}

export function Chatter({ model, recordId, refreshKey = 0 }: ChatterProps) {
  const { t } = useTranslation('chatter')
  const [messages, setMessages] = useState<ChatterMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/chatter/${model}/${recordId}/`, {
        credentials: 'include', signal, headers: { Accept: 'application/json' },
      })
      const body: unknown = await response.json()
      if (!response.ok) {
        const detail = typeof body === 'object' && body !== null && 'detail' in body ? String(body.detail) : ''
        throw new Error(detail || t('loadFailed'))
      }
      setMessages(body as ChatterMessage[])
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name !== 'AbortError') setError(loadError.message)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [model, recordId, t])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load, refreshKey])

  async function logNote() {
    const body = draft.trim()
    if (!body) return
    setPosting(true)
    setError('')
    try {
      const csrfToken = await fetchCsrfToken()
      const response = await fetch(`${apiBaseUrl}/chatter/${model}/${recordId}/`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({ body }),
      })
      const created: unknown = await response.json()
      if (!response.ok) throw new Error(t('postFailed'))
      setMessages((current) => [created as ChatterMessage, ...current])
      setDraft('')
      setComposerOpen(false)
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : t('postFailed'))
    } finally {
      setPosting(false)
    }
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void logNote()
    }
    if (event.key === 'Escape') setComposerOpen(false)
  }

  // Messages arrive newest first; group them under a day separator.
  const groups: { label: string; items: ChatterMessage[] }[] = []
  for (const message of messages) {
    const label = dayLabel(new Date(message.created_at))
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(message)
    else groups.push({ label, items: [message] })
  }

  return (
    <aside className="o-chatter" aria-label={t('label')}>
      <div className="o-chatter-topbar">
        <button
          type="button"
          className={`o-chatter-tab${composerOpen ? ' is-active' : ''}`}
          aria-expanded={composerOpen}
          onClick={() => setComposerOpen((open) => !open)}
        >
          {t('logNote')}
        </button>
        <span className="o-chatter-count">{t('entries', { count: messages.length })}</span>
        <button type="button" className="o-chatter-refresh" onClick={() => void load()} aria-label={t('refresh')} title={t('refreshTitle')}>↻</button>
      </div>

      {composerOpen && (
        <div className="o-chatter-composer">
          <span className="o-avatar" aria-hidden="true" style={{ background: '#5b211e' }}>✎</span>
          <div className="o-chatter-composer-body">
            <textarea
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={t('placeholder')}
              aria-label={t('noteLabel')}
              rows={3}
            />
            <div className="o-chatter-composer-actions">
              <button type="button" className="o-btn o-btn-primary" disabled={posting || !draft.trim()} onClick={() => void logNote()}>
                {posting ? t('logging') : t('log')}
              </button>
              <small>{t('hint')}</small>
            </div>
          </div>
        </div>
      )}

      {error && <p className="o-chatter-error" role="alert">{error}</p>}

      <div className="o-chatter-thread">
        {loading ? (
          <p className="o-chatter-empty">{t('loading')}</p>
        ) : groups.length === 0 ? (
          <p className="o-chatter-empty">{t('empty')}</p>
        ) : groups.map((group) => (
          <section key={group.label} className="o-chatter-day">
            <div className="o-chatter-separator"><span>{group.label}</span></div>
            {group.items.map((message) => {
              const author = message.author?.name ?? t('system')
              const created = new Date(message.created_at)
              return (
                <article key={message.id} className={`o-chatter-message o-chatter-message--${message.kind}`}>
                  <span className="o-avatar" aria-hidden="true" style={{ background: message.author ? avatarTone(author) : '#9a9789' }}>
                    {message.author ? initials(author) : '⚙'}
                  </span>
                  <div className="o-chatter-message-body">
                    <header>
                      <strong>{author}</strong>
                      <time dateTime={message.created_at} title={created.toLocaleString(intlLocale())}>{relativeTime(created)}</time>
                      {message.kind === 'note' && <span className="o-chatter-badge">{t('note')}</span>}
                    </header>
                    {message.body && <p>{message.body}</p>}
                    {message.tracking_values.length > 0 && (
                      <ul>{message.tracking_values.map((value) => <TrackingLine key={value.field} value={value} />)}</ul>
                    )}
                  </div>
                </article>
              )
            })}
          </section>
        ))}
      </div>
    </aside>
  )
}
