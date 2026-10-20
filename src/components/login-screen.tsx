import { Link } from 'react-router-dom'
import weddingProcession from '../assets/orthodox-wedding-procession.jpg'
import { LoginForm } from './login-form'

export function LoginScreen() {
  return (
    <main className="staff-login-page">
      <section className="staff-login-story" aria-label="Bahran Events">
        <img
          className="staff-login-photo"
          src={weddingProcession}
          alt="An Ethiopian Orthodox wedding procession in traditional red, gold, and white clothing"
        />
        <div className="staff-login-shade" />
        <div className="staff-login-story-top">
          <Link className="staff-login-brand" to="/" aria-label="Bahran Events home">
            <span className="staff-login-mark" aria-hidden="true">✥</span>
            <span>BAHRAN <i>EVENTS</i></span>
          </Link>
          <span className="staff-login-label">TEAM PORTAL</span>
        </div>
        <div className="staff-login-story-copy">
          <p className="staff-login-kicker"><span /> FAITH · FAMILY · CELEBRATION</p>
          <h1>Every detail<br />helps make a day<br /><i>remembered.</i></h1>
          <p>Welcome to the team space for planning with care, coordinating with family, and bringing each celebration together.</p>
        </div>
        <div className="staff-login-story-bottom">
          <span>ROOTED IN TRADITION · MADE FOR TOGETHERNESS</span>
          <Link to="/">Return to the public site <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className="staff-login-panel">
        <div className="staff-login-panel-top">
          <Link to="/" className="staff-login-mobile-brand">
            <span className="staff-login-mark" aria-hidden="true">✥</span>
            <span>BAHRAN <i>EVENTS</i></span>
          </Link>
          <span className="staff-login-secure"><span aria-hidden="true">✦</span> STAFF ACCESS</span>
        </div>

        <div className="staff-login-content">
          <p className="staff-login-welcome">Welcome back</p>
          <h2>Sign in to<br /><i>your workspace.</i></h2>
          <p className="staff-login-instruction">Enter your staff phone number and password to continue.</p>
          <LoginForm />
          <p className="staff-login-help">Need access? Please contact your Bahran Events administrator.</p>
        </div>

        <div className="staff-login-footer"><span>BAHRAN EVENTS</span><span>ADDIS ABABA · ETHIOPIA</span></div>
      </section>
    </main>
  )
}
