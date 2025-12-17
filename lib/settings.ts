/**
 * Settings Management
 * Load and cache application settings from database
 */

import { supabaseClient } from "./supabaseClient"

export interface AppSettings {
  restaurant_name: string
  restaurant_address: string
  restaurant_phone: string
  tax_rate: number
  receipt_footer: string
  auto_print_receipt: boolean
}

// Default settings (fallback)
const DEFAULT_SETTINGS: AppSettings = {
  restaurant_name: "Warung Makan Meninting",
  restaurant_address: "Jl. Raya Meninting No. 123",
  restaurant_phone: "0812-3456-7890",
  tax_rate: 10,
  receipt_footer: "Terima Kasih Atas Kunjungan Anda",
  auto_print_receipt: true,
}

// Cache settings in memory
let settingsCache: AppSettings | null = null
let lastFetchTime = 0
const CACHE_DURATION = 60000 // 1 minute

/**
 * Load settings from database
 */
export async function loadSettings(forceRefresh = false): Promise<AppSettings> {
  // Return cached settings if still valid
  if (!forceRefresh && settingsCache && Date.now() - lastFetchTime < CACHE_DURATION) {
    return settingsCache
  }

  if (!supabaseClient) {
    return DEFAULT_SETTINGS
  }

  try {
    const { data, error } = await supabaseClient.from("settings").select("key, value")

    if (error) {
      console.error("Failed to load settings:", error)
      return DEFAULT_SETTINGS
    }

    // Build settings object from key-value pairs
    const settings: Partial<AppSettings> = {}

    for (const row of data || []) {
      const key = row.key as keyof AppSettings
      const value = row.value as string

      switch (key) {
        case "tax_rate": {
          const parsed = Number.parseFloat(value)
          settings[key] = Number.isNaN(parsed) ? DEFAULT_SETTINGS.tax_rate : parsed
          break
        }
        case "auto_print_receipt":
          settings[key] = value.toLowerCase() === "true"
          break
        default:
          settings[key] = value
      }
    }

    // Merge with defaults for any missing keys
    const finalSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
    }

    // Update cache
    settingsCache = finalSettings
    lastFetchTime = Date.now()

    return finalSettings
  } catch (err) {
    console.error("Error loading settings:", err)
    return DEFAULT_SETTINGS
  }
}

/**
 * Get cached settings (no database call)
 */
export function getCachedSettings(): AppSettings {
  return settingsCache || DEFAULT_SETTINGS
}

/**
 * Clear settings cache (force reload on next call)
 */
export function clearSettingsCache(): void {
  settingsCache = null
  lastFetchTime = 0
}

/**
 * Get a specific setting value
 */
export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const settings = await loadSettings()
  return settings[key]
}

/**
 * Calculate tax amount based on settings
 */
export async function calculateTax(subtotal: number): Promise<number> {
  const taxRate = await getSetting("tax_rate")
  return (subtotal * taxRate) / 100
}

