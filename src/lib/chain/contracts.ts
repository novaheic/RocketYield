import type { Address } from 'viem'

export const MAINNET_CHAIN_ID = 1
export const RETH_DEPLOYMENT_BLOCK = 13_325_322n

export const RETH_ADDRESS: Address = '0xae78736Cd615f374D3085123A210448E74Fc6393'
export const ROCKET_STORAGE_ADDRESS: Address = '0x1d8f8f00cfa6758d7bE78336684788Fb0ee0Fa46'

// Rocket Pool upgrades network contracts through RocketStorage. Keeping the
// verified generations lets us read historical events while RocketStorage
// supplies the latest address at runtime.
export const NETWORK_BALANCE_GENERATIONS: Address[] = [
  '0x07FCaBCbe4ff0d80c2b1eb42855C0131b6cba2F4',
  '0x6Cc65bF618F55ce2433f9D8d827Fc44117D81399',
]

export const RETH_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getExchangeRate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const

export const ROCKET_STORAGE_ABI = [
  {
    type: 'function',
    name: 'getAddress',
    stateMutability: 'view',
    inputs: [{ name: '_key', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

export const LEGACY_BALANCES_EVENT = {
  type: 'event',
  name: 'BalancesUpdated',
  inputs: [
    { name: 'block', type: 'uint256', indexed: false },
    { name: 'totalEth', type: 'uint256', indexed: false },
    { name: 'stakingEth', type: 'uint256', indexed: false },
    { name: 'rethSupply', type: 'uint256', indexed: false },
    { name: 'time', type: 'uint256', indexed: false },
  ],
} as const

export const CURRENT_BALANCES_EVENT = {
  type: 'event',
  name: 'BalancesUpdated',
  inputs: [
    { name: 'block', type: 'uint256', indexed: true },
    { name: 'slotTimestamp', type: 'uint256', indexed: false },
    { name: 'totalEth', type: 'uint256', indexed: false },
    { name: 'stakingEth', type: 'uint256', indexed: false },
    { name: 'rethSupply', type: 'uint256', indexed: false },
    { name: 'blockTimestamp', type: 'uint256', indexed: false },
  ],
} as const

export const NETWORK_BALANCES_ABI = [
  {
    type: 'function',
    name: 'getBalancesTimestamp',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getBalancesBlock',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
