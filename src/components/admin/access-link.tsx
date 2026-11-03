import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { can, useProfile } from '@/lib/use-profile'

/** A link into another module that turns into plain text when the viewer's role can't open it. */
export function AccessLink({ module, to, className, children }: { module: string; to: string; className?: string; children: ReactNode }) {
  const profile = useProfile()
  return can(profile, module) ? <Link to={to} className={className}>{children}</Link> : <span className={className}>{children}</span>
}
