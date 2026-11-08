import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import i18n, { formatMoney } from '@/i18n'
import { Many2ManyTags } from '@/components/admin/many2many-tags'

export type ContentOption = { id: number; name: string }
export type TaxProfile = { id: number; name: string; kind: string; rate: string; inclusive: boolean }
export type EditableLine = { key: string; contentId: number | ''; amount: string; taxProfileIds: number[] }

export function formatAmount(value: string | number) {
  return formatMoney(value)
}

export function newInvoiceLine(contents: ContentOption[]): EditableLine {
  return { key: `new-${Date.now()}-${Math.random()}`, contentId: contents[0]?.id ?? '', amount: '0.00', taxProfileIds: [] }
}

export function invalidInvoiceLines(lines: EditableLine[]) {
  if (lines.length === 0) return i18n.t('invoices:lines.needOne')
  if (lines.some((line) => !line.contentId || line.amount.trim() === '' || Number(line.amount) < 0)) {
    return i18n.t('invoices:lines.invalid')
  }
  return ''
}

export function invoiceLinesPayload(lines: EditableLine[]) {
  return lines.map((line) => ({
    content_id: line.contentId,
    inclusive_price: line.amount,
    tax_profile_ids: line.taxProfileIds,
  }))
}

type InvoiceLinesEditorProps = {
  lines: EditableLine[]
  setLines: Dispatch<SetStateAction<EditableLine[]>>
  contents: ContentOption[]
  taxProfiles: TaxProfile[]
  /** Saved line totals by line key; lines without one show "After save". */
  savedTotals?: Record<string, string>
}

/** Editable one2many list of invoice lines: service, tax-inclusive price, and taxes. */
export function InvoiceLinesEditor({ lines, setLines, contents, taxProfiles, savedTotals = {} }: InvoiceLinesEditorProps) {
  const { t } = useTranslation('invoices')
  const taxOptions = taxProfiles.map((tax) => ({ id: tax.id, label: tax.name.includes('%') ? tax.name : `${tax.name} ${Number(tax.rate)}%` }))
  const updateLine = (key: string, update: Partial<EditableLine>) => {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...update } : line))
  }

  return (
    <>
      <div className="o-list-wrap">
        <table className="o-list">
          <thead><tr>
            <th scope="col">{t('lines.service')}</th>
            <th scope="col" className="o-num">{t('lines.priceIncl')}</th>
            <th scope="col">{t('lines.taxes')}</th>
            <th scope="col" className="o-num">{t('lines.subtotal')}</th>
            <th scope="col" className="o-list-actions"><span className="sr-only">{t('lines.actions')}</span></th>
          </tr></thead>
          <tbody>
            {lines.map((line) => {
              const savedTotal = savedTotals[line.key]
              return (
                <tr key={line.key} className={savedTotal === undefined ? 'is-new' : ''}>
                  <td>
                    <select className="o-input" aria-label={t('lines.serviceLabel')} value={line.contentId} onChange={(event) => updateLine(line.key, { contentId: event.target.value ? Number(event.target.value) : '' })}>
                      <option value="">{t('lines.chooseService')}</option>
                      {contents.map((content) => <option key={content.id} value={content.id}>{content.name}</option>)}
                    </select>
                  </td>
                  <td className="o-num">
                    <input className="o-input o-num" aria-label={t('lines.priceLabel')} type="number" min="0" step="0.01" value={line.amount} onChange={(event) => updateLine(line.key, { amount: event.target.value })} />
                  </td>
                  <td>
                    {taxOptions.length
                      ? <Many2ManyTags aria-label={t('lines.taxesLabel')} options={taxOptions} value={line.taxProfileIds} onChange={(ids) => updateLine(line.key, { taxProfileIds: ids })} placeholder={t('lines.defaultVatPlaceholder')} />
                      : <span className="o-muted">{t('lines.defaultVat')}</span>}
                  </td>
                  <td className="o-num o-muted">{savedTotal !== undefined ? formatAmount(savedTotal) : t('lines.afterSave')}</td>
                  <td className="o-list-actions">
                    <button type="button" className="o-btn o-btn-link o-btn-sm o-btn-danger" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} disabled={lines.length === 1} aria-label={t('lines.remove')} title={t('lines.remove')}>🗑</button>
                  </td>
                </tr>
              )
            })}
            {lines.length === 0 && <tr><td colSpan={5} className="o-list-empty">{t('lines.empty')}</td></tr>}
          </tbody>
        </table>
      </div>
      <button type="button" className="o-list-add" onClick={() => setLines((current) => [...current, newInvoiceLine(contents)])} disabled={!contents.length}>{t('lines.add')}</button>
    </>
  )
}
