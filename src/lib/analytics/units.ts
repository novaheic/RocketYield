export const WAD = 10n ** 18n

export function toEthNumber(value: bigint) {
  return Number(value) / 1e18
}
