import { EthiopianCross } from './EthiopianCross'

const steps = [
  {
    am: 'ጥሪ',
    title: 'Tell us your celebration',
    text: 'Share the occasion, the date and your family’s customs. We show the date in the Ethiopian calendar and flag fasts and feast days.',
  },
  {
    am: 'ምክክር',
    title: 'Meet and choose a plan',
    text: 'We sit with your family, walk through our plans and packages, and shape them around your parish and your budget.',
  },
  {
    am: 'ዝግጅት',
    title: 'We prepare every detail',
    text: 'One coordinator works with your parish, the caterers, decor and hosts, with a clear plan for fasting and non-fasting tables.',
  },
  {
    am: 'በዓል',
    title: 'Be present on the day',
    text: 'From the church service to the feast and Melse, we keep the day running so your family can pray, celebrate and welcome guests.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="web-steps" aria-labelledby="how-it-works-title">
      <div className="web-section-head">
        <p className="eyebrow">How it works · <span lang="am">አሠራራችን</span></p>
        <h2 id="how-it-works-title">From the first call<br /><i>to the last blessing.</i></h2>
      </div>
      <ol className="web-steps-list">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="web-step-mark" aria-hidden="true">
              <EthiopianCross size={18} />
              <b>{String(index + 1).padStart(2, '0')}</b>
            </span>
            <small lang="am">{step.am}</small>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
      <a className="button button-dark web-steps-cta" href="#contact">Start with step one <span>↗</span></a>
    </section>
  )
}
