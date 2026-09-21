import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  keccak256,
  namehash,
  stringToBytes,
  type Address,
  type PublicClient,
} from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'
import { DashboardError } from '../types'
import {
  NETWORK_BALANCES_ABI,
  RETH_ABI,
  RETH_ADDRESS,
  ROCKET_STORAGE_ABI,
  ROCKET_STORAGE_ADDRESS,
} from './contracts'

let client: PublicClient | undefined

export function getMainnetClient(): PublicClient {
  const rpcUrl = import.meta.env.VITE_ETHEREUM_RPC_URL?.trim()
  if (!rpcUrl) {
    throw new DashboardError(
      'rpc_missing',
      'Add VITE_ETHEREUM_RPC_URL to .env.local. RocketYield needs an archive-capable Ethereum endpoint.',
    )
  }
  if (!client) {
    client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl, {
        timeout: 25_000,
        retryCount: 0,
        retryDelay: 500,
      }),
      batch: { multicall: true },
    })
  }
  return client
}

export async function resolveWallet(input: string): Promise<{ address: Address; ensName?: string }> {
  const value = input.trim()
  if (isAddress(value)) return { address: getAddress(value) }

  if (!value.includes('.') || value.length > 255) {
    throw new DashboardError('invalid_address', 'Enter a complete Ethereum address or ENS name.')
  }

  try {
    const ensName = normalize(value)
    // Validate early and keep this computation explicit for malformed ENS labels.
    namehash(ensName)
    const address = await getMainnetClient().getEnsAddress({ name: ensName })
    if (!address) {
      throw new DashboardError('ens_not_found', `No Ethereum address is set for ${ensName}.`)
    }
    return { address, ensName }
  } catch (error) {
    if (error instanceof DashboardError) throw error
    throw mapChainError(error, `Could not resolve ${value}.`)
  }
}

export async function readCurrentPosition(address: Address) {
  try {
    const rpc = getMainnetClient()
    const [currentReth, currentRate, chainBlock] = await Promise.all([
      rpc.readContract({
        address: RETH_ADDRESS,
        abi: RETH_ABI,
        functionName: 'balanceOf',
        args: [address],
      }),
      rpc.readContract({
        address: RETH_ADDRESS,
        abi: RETH_ABI,
        functionName: 'getExchangeRate',
      }),
      rpc.getBlockNumber(),
    ])
    const balancesAddress = await readCurrentNetworkBalancesAddress()
    const protocolRateUpdatedAt = Number(
      await rpc.readContract({
        address: balancesAddress,
        abi: NETWORK_BALANCES_ABI,
        functionName: 'getBalancesTimestamp',
      }),
    )

    return {
      currentReth,
      currentRate,
      currentEth: (currentReth * currentRate) / 10n ** 18n,
      chainBlock,
      protocolRateUpdatedAt,
    }
  } catch (error) {
    throw mapChainError(error, 'Could not read the current rETH position.')
  }
}

export async function readCurrentNetworkBalancesAddress(): Promise<Address> {
  const key = keccak256(stringToBytes('contract.addressrocketNetworkBalances'))
  try {
    return await getMainnetClient().readContract({
      address: ROCKET_STORAGE_ADDRESS,
      abi: ROCKET_STORAGE_ABI,
      functionName: 'getAddress',
      args: [key],
    })
  } catch (error) {
    throw mapChainError(error, 'Could not resolve the current Rocket Pool balances contract.')
  }
}

export function mapChainError(error: unknown, fallback: string): DashboardError {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (lower.includes('429') || lower.includes('rate limit')) {
    return new DashboardError('rpc_rate_limited', 'The Ethereum endpoint is rate-limiting this history request.', error)
  }
  if (
    lower.includes('missing trie node') ||
    lower.includes('historical state') ||
    lower.includes('archive')
  ) {
    return new DashboardError('archive_required', 'This endpoint cannot serve the required historical Ethereum data.', error)
  }
  if (lower.includes('fetch') || lower.includes('network') || lower.includes('timeout')) {
    return new DashboardError('network', fallback, error)
  }
  return new DashboardError('unknown', fallback, error)
}
