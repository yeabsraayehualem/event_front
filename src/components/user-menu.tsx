import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logout03Icon, SquareLock02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiRequest } from '@/lib/api-request'
import { useProfile } from '@/lib/use-profile'
import { useAuthStore } from '@/stores/auth-store'
import { useTranslation } from 'react-i18next'
import { roleLabel } from '@/i18n'


function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const close = (value: boolean) => {
    onOpenChange(value)
    if (!value) { setCurrent(''); setNext(''); setConfirm(''); setError(''); setDone(false) }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (next !== confirm) { setError(t('userMenu.mismatch')); return }
    setSaving(true)
    setError('')
    try {
      await apiRequest('/user/profile/password/', {
        method: 'POST', body: { current_password: current, new_password: next }, fallback: t('userMenu.changeFailed'),
        labels: { current_password: t('userMenu.currentPassword'), new_password: t('userMenu.newPassword') },
      })
      setDone(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('userMenu.changeFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="usr-dialog">
        <DialogHeader>
          <DialogTitle>{t('userMenu.changePassword')}</DialogTitle>
          <DialogDescription>{done ? t('userMenu.passwordChanged') : t('userMenu.passwordRule')}</DialogDescription>
        </DialogHeader>
        {done ? (
          <button type="button" className="o-btn o-btn-primary" onClick={() => close(false)}>{t('actions.done')}</button>
        ) : (
          <form className="usr-dialog-form" onSubmit={(event) => void submit(event)}>
            <label>{t('userMenu.currentPassword')}<input className="o-input" type="password" autoComplete="current-password" required value={current} onChange={(event) => setCurrent(event.target.value)} /></label>
            <label>{t('userMenu.newPassword')}<input className="o-input" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(event) => setNext(event.target.value)} /></label>
            <label>{t('userMenu.repeatPassword')}<input className="o-input" type="password" autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
            {error && <p className="usr-dialog-error" role="alert">{error}</p>}
            <button type="submit" className="o-btn o-btn-primary" disabled={saving}>{saving ? t('actions.saving') : t('userMenu.changePassword')}</button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Who is signed in, with change-password and sign-out. Sits at the bottom of the side navigation. */
export function UserMenu() {
  const profile = useProfile()
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()
  const [changing, setChanging] = useState(false)
  const { t } = useTranslation()
  if (!profile) return null
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.phone
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')

  return (
    <div className="side-user">
      <div className="side-user-who">
        <span className="side-user-avatar" aria-hidden="true">{initials}</span>
        <span className="side-user-text">
          <strong>{name}</strong>
          <small>{roleLabel(profile.role)}</small>
        </span>
      </div>
      <div className="side-user-actions">
        <button type="button" onClick={() => setChanging(true)} title={t('userMenu.changePassword')} aria-label={t('userMenu.changePassword')}>
          <HugeiconsIcon icon={SquareLock02Icon} size={17} strokeWidth={1.8} />
        </button>
        <button type="button" onClick={async () => { await logout(); navigate('/login', { replace: true }) }} title={t('userMenu.signOut')} aria-label={t('userMenu.signOut')}>
          <HugeiconsIcon icon={Logout03Icon} size={17} strokeWidth={1.8} />
        </button>
      </div>
      <ChangePasswordDialog open={changing} onOpenChange={setChanging} />
    </div>
  )
}
