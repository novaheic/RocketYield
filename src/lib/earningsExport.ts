import type { DailyEarningsLedgerRow } from './types'

type ExportFormat = 'csv' | 'json'

function exportRow(row: DailyEarningsLedgerRow) {
  return {
    date: row.date,
    changeEth: row.earnedEth,
    dollarValueUsd: row.dollarValueUsd,
    ethPriceUsd: row.ethPriceUsd,
    annualizedYieldPercent: row.annualizedYield * 100,
    balanceEth: row.balanceEth,
  }
}

function csvCell(value: string | number | null) {
  if (value === null) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function serializeEarningsCsv(rows: DailyEarningsLedgerRow[]) {
  const headers = [
    'Date',
    'Change (ETH)',
    'Dollar Value (USD)',
    'ETH Price (USD)',
    'Annualized Yield (%)',
    'Balance (ETH)',
  ]
  const lines = rows.map((row) => {
    const item = exportRow(row)
    return [
      item.date,
      item.changeEth,
      item.dollarValueUsd,
      item.ethPriceUsd,
      item.annualizedYieldPercent,
      item.balanceEth,
    ].map(csvCell).join(',')
  })
  return [headers.join(','), ...lines].join('\r\n')
}

export function serializeEarningsJson(rows: DailyEarningsLedgerRow[]) {
  return JSON.stringify(rows.map(exportRow), null, 2)
}

export function downloadEarnings(
  rows: DailyEarningsLedgerRow[],
  format: ExportFormat,
  address: string,
) {
  const contents = format === 'csv' ? serializeEarningsCsv(rows) : serializeEarningsJson(rows)
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
