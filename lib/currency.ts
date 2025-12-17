/**
 * Format number to Indonesian Rupiah currency
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "Rp 10.000")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace("IDR", "Rp")
    .trim()
}

/**
 * Format number to Indonesian number format without currency symbol
 * @param amount - The amount to format
 * @returns Formatted number string (e.g., "10.000")
 */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("id-ID").format(amount)
}

