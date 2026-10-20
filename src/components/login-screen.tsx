import { Link } from 'react-router-dom'
import { LoginForm } from './login-form'

export function LoginScreen() {
  return (
    <main className="min-h-screen bg-slate-100 p-3 sm:p-6 lg:p-10">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-900/10 sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="pointer-events-none absolute -right-28 -top-28 size-96 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-12 -top-12 size-64 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-40 -left-32 size-96 rounded-full bg-violet-500/20 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <div className="grid size-11 grid-cols-2 gap-1 rounded-2xl bg-white/10 p-2.5 ring-1 ring-white/20">
              <span className="rounded-sm bg-white" />
              <span className="rounded-sm bg-violet-300" />
              <span className="rounded-sm bg-indigo-300" />
              <span className="rounded-sm bg-white/70" />
            </div>
            <span className="text-sm font-semibold tracking-[0.18em] text-white/90">
              EVENT PLANNER
            </span>
          </div>

          <div className="relative my-12 max-w-lg">
            <p className="mb-5 text-sm font-medium uppercase tracking-[0.22em] text-violet-200">
              Bring people together
            </p>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight xl:text-6xl">
              Make room for
              <span className="mt-2 block text-violet-200">great moments.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-indigo-100/80">
              Plan your events, keep the details in one place, and spend more
              time enjoying the day.
            </p>

            <div className="mt-12 max-w-sm rotate-[-2deg] rounded-3xl border border-white/15 bg-white/10 p-5 shadow-xl shadow-indigo-950/20 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-emerald-300/15 px-3 py-1 text-xs font-medium text-emerald-100">
                  COMING UP
                </span>
                <span className="text-sm text-indigo-100/70">SAT · 10:30 AM</span>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-white text-indigo-900">
                  <span className="text-[10px] font-semibold tracking-widest">JUN</span>
                  <span className="text-2xl font-bold leading-none">15</span>
                </div>
                <div>
                  <p className="font-semibold">A day to get together</p>
                  <p className="mt-1 text-sm text-indigo-100/70">Your next event starts here</p>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-indigo-100/75">
                <span className="flex -space-x-2" aria-hidden="true">
                  <span className="size-6 rounded-full border-2 border-indigo-900 bg-amber-200" />
                  <span className="size-6 rounded-full border-2 border-indigo-900 bg-pink-200" />
                  <span className="size-6 rounded-full border-2 border-indigo-900 bg-sky-200" />
                </span>
                Everything you need, all together
              </div>
            </div>
          </div>

          <p className="relative text-xs text-indigo-100/55">
            Make every gathering a little easier.
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-12 lg:px-14 xl:px-20">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="grid size-10 grid-cols-2 gap-1 rounded-xl bg-indigo-700 p-2.5">
                <span className="rounded-sm bg-white" />
                <span className="rounded-sm bg-violet-300" />
                <span className="rounded-sm bg-indigo-300" />
                <span className="rounded-sm bg-white/70" />
              </div>
              <span className="text-xs font-bold tracking-[0.16em] text-slate-700">
                EVENT PLANNER
              </span>
            </div>

            <div className="mb-8">
              <p className="mb-3 text-sm font-semibold text-indigo-700">
                Welcome back
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Sign in to your account
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Enter your details below to pick up where you left off.
              </p>
            </div>

            <LoginForm />

            <p className="mt-8 text-center text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-indigo-700 underline-offset-4 hover:underline"
              >
                Create one
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
