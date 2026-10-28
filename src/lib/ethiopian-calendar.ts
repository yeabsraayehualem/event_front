/**
 * Ethiopian calendar conversion and the Ethiopian Orthodox Tewahedo church year.
 *
 * Dates are always stored and sent to the API as Gregorian (ISO yyyy-mm-dd);
 * the Ethiopian date is for display only.
 *
 * Fasika (Easter) follows the Julian computation used by the EOTC (Bahire Hasab
 * gives the same Sunday as Orthodox Easter). The Julian→Gregorian offset of 13 days
 * is valid for 1900–2099.
 */

const ETHIOPIAN_EPOCH = 1723856

export const ETHIOPIAN_MONTHS = [
  { am: 'መስከረም', en: 'Meskerem' },
  { am: 'ጥቅምት', en: 'Tikimt' },
  { am: 'ኅዳር', en: 'Hidar' },
  { am: 'ታኅሣሥ', en: 'Tahsas' },
  { am: 'ጥር', en: 'Tir' },
  { am: 'የካቲት', en: 'Yekatit' },
  { am: 'መጋቢት', en: 'Megabit' },
  { am: 'ሚያዝያ', en: 'Miyazya' },
  { am: 'ግንቦት', en: 'Ginbot' },
  { am: 'ሰኔ', en: 'Sene' },
  { am: 'ሐምሌ', en: 'Hamle' },
  { am: 'ነሐሴ', en: 'Nehase' },
  { am: 'ጳጉሜ', en: 'Pagume' },
] as const

export type EthiopianDate = { year: number; month: number; day: number }

const DAY_MS = 86_400_000

/** Parse an ISO yyyy-mm-dd string as a calendar day (no time zone drift). */
export function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(d.getTime()) ? null : d
}

function toJdn(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS) + 2440588
}

function fromJdn(jdn: number): Date {
  return new Date((jdn - 2440588) * DAY_MS)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

export function toEthiopian(date: Date): EthiopianDate {
  const jdn = toJdn(date)
  const r = (jdn - ETHIOPIAN_EPOCH) % 1461
  const n = (r % 365) + 365 * Math.floor(r / 1460)
  return {
    year: 4 * Math.floor((jdn - ETHIOPIAN_EPOCH) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: (n % 30) + 1,
  }
}

export function fromEthiopian({ year, month, day }: EthiopianDate): Date {
  const jdn = ETHIOPIAN_EPOCH + 365 + 365 * (year - 1) + Math.floor(year / 4) + 30 * month + day - 31
  return fromJdn(jdn)
}

export function formatEthiopian(date: Date, lang: 'am' | 'en' = 'en'): string {
  const et = toEthiopian(date)
  const month = ETHIOPIAN_MONTHS[et.month - 1][lang]
  return lang === 'am' ? `${month} ${et.day}፣ ${et.year} ዓ.ም.` : `${month} ${et.day}, ${et.year} E.C.`
}

export function formatGregorian(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(date)
}

/** Orthodox / EOTC Fasika as a Gregorian date (UTC midnight). */
export function fasika(gregorianYear: number): Date {
  const a = gregorianYear % 4
  const b = gregorianYear % 7
  const c = gregorianYear % 19
  const d = (19 * c + 15) % 30
  const e = (2 * a + 4 * b - d + 34) % 7
  const month = Math.floor((d + e + 114) / 31)
  const day = ((d + e + 114) % 31) + 1
  return addDays(new Date(Date.UTC(gregorianYear, month - 1, day)), 13)
}

export type ChurchPeriod = {
  key: string
  kind: 'fast' | 'feast'
  name: string
  am: string
  start: Date
  end: Date
  /** A church wedding (Teklil) is not held during this period. */
  noTeklil?: boolean
  /** Short, plain explanation for families. */
  note: string
}

const et = (year: number, month: number, day: number) => fromEthiopian({ year, month, day })

/** Feasts and seasonal fasts for one Ethiopian year (Meskerem 1 → Pagume end). */
export function churchYear(etYear: number): ChurchPeriod[] {
  // The Gregorian year in which this Ethiopian year's Fasika falls.
  const fasikaDay = fasika(etYear + 8)
  const genna = new Date(Date.UTC(etYear + 8, 0, 7)) // Genna is kept on 7 January
  const timket = et(etYear, 5, 11)
  const nextNewYear = et(etYear + 1, 1, 1)

  return [
    { key: 'enkutatash', kind: 'feast', name: 'Enkutatash', am: 'እንቁጣጣሽ', start: et(etYear, 1, 1), end: et(etYear, 1, 1), note: 'Ethiopian New Year.' },
    { key: 'meskel', kind: 'feast', name: 'Meskel', am: 'መስቀል', start: et(etYear, 1, 16), end: et(etYear, 1, 17), note: 'Demera on the eve, Meskel the next day. Crews and venues book up early.' },
    { key: 'nebiyat', kind: 'fast', name: 'Tsome Nebiyat', am: 'ጾመ ነቢያት', start: et(etYear, 3, 15), end: addDays(genna, -1), noTeklil: true, note: 'The Advent fast before Genna.' },
    { key: 'genna', kind: 'feast', name: 'Genna', am: 'ገና', start: genna, end: genna, note: 'The Nativity.' },
    { key: 'timket', kind: 'feast', name: 'Timket', am: 'ጥምቀት', start: et(etYear, 5, 10), end: addDays(timket, 1), note: 'Ketera on the eve, Timket, then the feast of Kana Zegelila.' },
    { key: 'nenewe', kind: 'fast', name: 'Tsome Nenewe', am: 'ጾመ ነነዌ', start: addDays(fasikaDay, -69), end: addDays(fasikaDay, -67), noTeklil: true, note: 'The three-day fast of Nineveh.' },
    { key: 'abiy', kind: 'fast', name: 'Abiy Tsom', am: 'ዐቢይ ጾም', start: addDays(fasikaDay, -55), end: addDays(fasikaDay, -1), noTeklil: true, note: 'The Great Lent of 55 days before Fasika.' },
    { key: 'fasika', kind: 'feast', name: 'Fasika', am: 'ፋሲካ', start: fasikaDay, end: fasikaDay, note: 'The Resurrection. The weeks after are a favored wedding season.' },
    { key: 'hawaryat', kind: 'fast', name: 'Tsome Hawaryat', am: 'ጾመ ሐዋርያት', start: addDays(fasikaDay, 50), end: et(etYear, 11, 4), noTeklil: true, note: 'The Fast of the Apostles, ending on Hamle 5.' },
    { key: 'filseta', kind: 'fast', name: 'Tsome Filseta', am: 'ጾመ ፍልሰታ', start: et(etYear, 12, 1), end: et(etYear, 12, 15), noTeklil: true, note: 'The fast of the Assumption of St. Mary, Nehase 1–15.' },
    { key: 'buhe', kind: 'feast', name: 'Debre Tabor (Buhe)', am: 'ደብረ ታቦር', start: et(etYear, 12, 13), end: et(etYear, 12, 13), note: 'The Transfiguration.' },
  ].filter((p) => p.start < nextNewYear || p.key === 'enkutatash') as ChurchPeriod[]
}

function sameOrBetween(day: Date, start: Date, end: Date) {
  return day.getTime() >= start.getTime() && day.getTime() <= end.getTime()
}

export type DateGuidance = {
  ethiopian: string
  ethiopianAm: string
  periods: ChurchPeriod[]
  /** Wednesday or Friday fast that applies on this day. */
  weeklyFast: boolean
  teklilRestricted: boolean
}

/** What the church year says about a single day. */
export function guidanceFor(day: Date): DateGuidance {
  const etYear = toEthiopian(day).year
  const periods = churchYear(etYear).filter((p) => sameOrBetween(day, p.start, p.end))

  const weekday = day.getUTCDay() // 3 = Wednesday, 5 = Friday
  const fasikaDay = fasika(etYear + 8)
  const inFiftyDays = day > fasikaDay && day <= addDays(fasikaDay, 49)
  const isGennaOrTimket = periods.some((p) => p.key === 'genna' || (p.key === 'timket' && sameOrBetween(day, et(etYear, 5, 11), et(etYear, 5, 11))))
  const weeklyFast = (weekday === 3 || weekday === 5) && !inFiftyDays && !isGennaOrTimket

  return {
    ethiopian: formatEthiopian(day, 'en'),
    ethiopianAm: formatEthiopian(day, 'am'),
    periods,
    weeklyFast,
    teklilRestricted: periods.some((p) => p.noTeklil),
  }
}

/** The next few feasts and fasts from a given day, for the public calendar strip. */
export function upcomingPeriods(from: Date, count = 6): ChurchPeriod[] {
  const etYear = toEthiopian(from).year
  return [...churchYear(etYear), ...churchYear(etYear + 1)]
    .filter((p) => p.end.getTime() >= from.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, count)
}

export function todayUtc(): Date {
  const now = new Date()
  // Use Addis Ababa's calendar day (UTC+3), whatever the visitor's clock says.
  const addis = new Date(now.getTime() + 3 * 3_600_000)
  return new Date(Date.UTC(addis.getUTCFullYear(), addis.getUTCMonth(), addis.getUTCDate()))
}

/** "Tikimt 18, 2019" from an ISO date (or ISO datetime). */
function asIso(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  return String(value)
}

export function formatEthiopianShort(value: string | Date | null | undefined): string {
  const iso = asIso(value)
  const d = iso ? parseIsoDate(iso.slice(0, 10)) : null
  if (!d) return iso ? String(iso) : '—'
  const e = toEthiopian(d)
  return `${ETHIOPIAN_MONTHS[e.month - 1].en} ${e.day}, ${e.year}`
}

/** "Tikimt 18, 2019 E.C. · 28 Oct 2026" — for read-only displays and tables. */
export function formatDualDate(value: string | Date | null | undefined): string {
  const iso = asIso(value)
  const d = iso ? parseIsoDate(iso.slice(0, 10)) : null
  if (!d) return iso ? String(iso) : '—'
  const g = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d)
  return `${formatEthiopianShort(iso)} E.C. · ${g}`
}
