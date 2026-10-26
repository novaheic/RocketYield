/** Pure helpers for classifying RPC failures. Kept free of client state so tests use them directly. */

interface ErrorFields {
  name?: unknown
  message?: unknown
  details?: unknown
  shortMessage?: unknown
  code?: unknown
  status?: unknown
  cause?: unknown
}

export interface ErrorInfo {
  text: string
  codes: number[]
  statuses: number[]
  aborted: boolean
}

const MAX_CAUSE_DEPTH = 6

// viem embeds the endpoint URL (including any API key) and the request body in its messages.
export function sanitizeErrorText(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, '[endpoint]')
    .replace(/^\s*(request body|url|version):.*$/gim, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function errorLevels(error: unknown) {
  const levels: ErrorFields[] = []
  let current: unknown = error
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current && typeof current === 'object'; depth += 1) {
    const item = current as ErrorFields
    levels.push(item)
    current = item.cause
  }
  return levels
}

export function readErrorInfo(error: unknown): ErrorInfo {
  const messages: string[] = typeof error === 'string' ? [error] : []
  const codes: number[] = []
  const statuses: number[] = []
  let aborted = false

  for (const item of errorLevels(error)) {
    if (item.name === 'AbortError') aborted = true
    for (const value of [item.message, item.details, item.shortMessage]) {
      if (typeof value === 'string') messages.push(sanitizeErrorText(value).toLowerCase())
    }
    if (typeof item.code === 'number') codes.push(item.code)
    if (typeof item.status === 'number') statuses.push(item.status)
  }

  return { text: messages.join(' '), codes, statuses, aborted }
}

export function isRateLimitedRpcError(error: unknown) {
  const { text, codes, statuses } = readErrorInfo(error)
  return (
    codes.includes(429) ||
    statuses.includes(429) ||
    text.includes('429') ||
    text.includes('rate limit') ||
    text.includes('too many requests') ||
    text.includes('compute units') ||
    text.includes('capacity') ||
    text.includes('rate exceeded')
  )
}

export function isTransientNetworkError(error: unknown) {
  const { text, codes, statuses } = readErrorInfo(error)
  return (
    statuses.some((status) => status >= 500) ||
    codes.includes(-32603) ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('took too long') ||
    text.includes('failed to fetch') ||
    text.includes('fetch failed') ||
    text.includes('network') ||
    text.includes('header not found')
  )
}

export function isRetryableRpcError(error: unknown) {
  if (readErrorInfo(error).aborted) return false
  return isRateLimitedRpcError(error) || isTransientNetworkError(error)
}

/** A short, key-free summary of the root cause for the error screen. */
export function describeErrorCause(error: unknown): string | undefined {
  const parts: string[] = []
  // The top level is the DashboardError whose message is already on screen.
  for (const item of errorLevels(error).slice(1)) {
    const summary = typeof item.shortMessage === 'string'
      ? [item.shortMessage, typeof item.details === 'string' ? item.details : '']
      : [typeof item.message === 'string' ? item.message : '']
    for (const value of summary) {
      const clean = sanitizeErrorText(value)
      if (clean && !parts.some((part) => part.includes(clean))) parts.push(clean)
    }
  }
  if (!parts.length) return undefined
  const text = parts.join(' — ')
  return text.length > 400 ? `${text.slice(0, 397)}…` : text
}
