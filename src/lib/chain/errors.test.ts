import { HttpRequestError, TimeoutError } from 'viem'
import { describe, expect, it } from 'vitest'
import { DashboardError } from '../types'
import {
  describeErrorCause,
  isRateLimitedRpcError,
  isRetryableRpcError,
} from './errors'

const url = 'https://eth-mainnet.g.alchemy.com/v2/SECRET_KEY'
const body = { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [] }

describe('RPC error classification', () => {
  it('retries viem timeouts and 5xx responses, including nested causes', () => {
    const timeout = new TimeoutError({ body, url })
    expect(isRetryableRpcError(timeout)).toBe(true)
    expect(isRetryableRpcError(new Error('outer', { cause: timeout }))).toBe(true)
    expect(isRetryableRpcError(new HttpRequestError({ body, url, status: 503 }))).toBe(true)
  })

  it('treats Alchemy throughput errors as rate limiting', () => {
    const throttled = new HttpRequestError({ body, url, status: 429 })
    expect(isRateLimitedRpcError(throttled)).toBe(true)
    expect(isRateLimitedRpcError(new Error('Your app has exceeded its compute units per second capacity.'))).toBe(true)
  })

  it('does not retry reverts or cancellations', () => {
    expect(isRetryableRpcError(new Error('execution reverted'))).toBe(false)
    expect(isRetryableRpcError(new DOMException('The request was cancelled.', 'AbortError'))).toBe(false)
  })

  it('describes the root cause without leaking the endpoint key', () => {
    const error = new DashboardError('network', 'Could not reconstruct history.', new TimeoutError({ body, url }))
    const description = describeErrorCause(error)
    expect(description).toMatch(/took too long/i)
    expect(description).not.toContain('SECRET_KEY')
    expect(description).not.toContain('eth_call')
  })
})
