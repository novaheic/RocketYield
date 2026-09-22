import type { DailyEarningsLedgerRow, FiatCurrency } from './types'

type ExportFormat = 'csv' | 'json'

function exportRow(row: DailyEarningsLedgerRow, currency: FiatCurrency) {
  return {
    date: row.date,
    changeEth: row.earnedEth,
    fiatValue: row.fiatValue,
    ethPrice: row.ethPrice,
    currency,
    annualizedYieldPercent: row.annualizedYield * 100,
    balanceEth: row.balanceEth,
  }
}

function csvCell(value: string | number | null) {
  if (value === null) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function serializeEarningsCsv(rows: DailyEarningsLedgerRow[], currency: FiatCurrency) {
  const headers = [
    'Date',
    'Change (ETH)',
    `Value (${currency})`,
    `ETH Price (${currency})`,
    'Annualized Yield (%)',
    'Balance (ETH)',
  ]
  const lines = rows.map((row) => {
    const item = exportRow(row, currency)
    return [
      item.date,
      item.changeEth,
      item.fiatValue,
      item.ethPrice,
      item.annualizedYieldPercent,
      item.balanceEth,
    ].map(csvCell).join(',')
  })
  return [headers.join(','), ...lines].join('\r\n')
}

export function serializeEarningsJson(rows: DailyEarningsLedgerRow[], currency: FiatCurrency) {
  return JSON.stringify(rows.map((row) => exportRow(row, currency)), null, 2)
}

export function downloadEarnings(
  rows: DailyEarningsLedgerRow[],
  format: ExportFormat,
  address: string,
  currency: FiatCurrency,
) {
  const contents = format === 'csv'
    ? serializeEarningsCsv(rows, currency)
    : serializeEarningsJson(rows, currency)
  const mimeType = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8'
  const latestDate = rows[0]?.date ?? new Date().toISOString().slice(0, 10)
  const filename = `rocketyield-daily-earnings-${address.toLowerCase()}-${latestDate}.${format}`
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
