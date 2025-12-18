/**
 * Bluetooth Thermal Printer Utility
 * Supports ESC/POS commands for thermal printers
 */

export interface ReceiptData {
  receiptNumber: string
  orderDate: Date
  customerName?: string
  tableNumber?: string
  items: Array<{
    name: string
    quantity: number
    price: number
    total: number
  }>
  subtotal: number
  tax: number
  total: number
  paymentMethod: string
  cashier?: string
  restaurantName?: string
  restaurantAddress?: string
  restaurantPhone?: string
  footerMessage?: string
  taxRate?: number
}

// ESC/POS Commands
const ESC = "\x1B"
const GS = "\x1D"

const Commands = {
  INIT: ESC + "@", // Initialize printer
  ALIGN_LEFT: ESC + "a" + "\x00",
  ALIGN_CENTER: ESC + "a" + "\x01",
  ALIGN_RIGHT: ESC + "a" + "\x02",
  BOLD_ON: ESC + "E" + "\x01",
  BOLD_OFF: ESC + "E" + "\x00",
  DOUBLE_HEIGHT: GS + "!" + "\x11",
  NORMAL_SIZE: GS + "!" + "\x00",
  FEED_LINE: "\n",
  CUT_PAPER: GS + "V" + "\x41" + "\x00",
}

export class BluetoothPrinter {
  // Use loose typing here karena Web Bluetooth API belum terdefinisi di TypeScript DOM secara default
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private device: any | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private characteristic: any | null = null
  private disconnectHandler: (() => void) | null = null

  /**
   * Connect to bluetooth printer
   */
  async connect(): Promise<boolean> {
    try {
      // Request bluetooth device
      const nav = navigator as any
      this.device = await nav.bluetooth.requestDevice({
        filters: [{ services: ["000018f0-0000-1000-8000-00805f9b34fb"] }], // Common thermal printer service
        optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
      })

      if (!this.device.gatt) {
        throw new Error("GATT not supported")
      }

      // Connect to GATT server
      const server = await this.device.gatt.connect()

      // Set up disconnect listener
      this.disconnectHandler = () => {
        console.warn("[Bluetooth Printer] Device disconnected unexpectedly")
        this.device = null
        this.characteristic = null
      }
      this.device.addEventListener("gattserverdisconnected", this.disconnectHandler)

      // Get service
      const service = await server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb")

      // Get characteristic (write)
      this.characteristic = await service.getCharacteristic("00002af1-0000-1000-8000-00805f9b34fb")

      return true
    } catch (error) {
      console.error("Failed to connect to printer:", error)
      return false
    }
  }

  /**
   * Check if printer is connected (with more robust checking)
   */
  isConnected(): boolean {
    try {
      if (!this.device) {
        return false
      }
      
      // Check if GATT exists and is connected
      if (!this.device.gatt) {
        return false
      }
      
      // Some devices may not have the connected property, so we check both
      const isGattConnected = this.device.gatt.connected === true
      const hasCharacteristic = this.characteristic !== null
      
      return isGattConnected && hasCharacteristic
    } catch (error) {
      console.error("[Bluetooth Printer] Error checking connection:", error)
      return false
    }
  }

  /**
   * Disconnect from printer
   */
  disconnect(): void {
    // Remove disconnect listener if exists
    if (this.device && this.disconnectHandler) {
      this.device.removeEventListener("gattserverdisconnected", this.disconnectHandler)
      this.disconnectHandler = null
    }

    if (this.device && this.device.gatt?.connected) {
      try {
        this.device.gatt.disconnect()
      } catch (error) {
        console.warn("[Bluetooth Printer] Error during disconnect:", error)
      }
    }
    this.device = null
    this.characteristic = null
  }

  /**
   * Send data to printer with retry mechanism
   */
  private async write(data: string, retries = 3): Promise<void> {
    if (!this.characteristic) {
      throw new Error("Printer not connected")
    }

    // Check connection before writing
    if (!this.isConnected()) {
      throw new Error("Printer connection lost")
    }

    const encoder = new TextEncoder()
    const bytes = encoder.encode(data)

    // Split into smaller chunks for better reliability (reduced from 20 to 10 bytes)
    const chunkSize = 10
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize)
      
      // Retry mechanism for each chunk
      let lastError: Error | null = null
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          // Check connection before each write
          if (!this.isConnected()) {
            throw new Error("Printer connection lost during write")
          }

          await this.characteristic.writeValue(chunk)
          
          // Increased delay between writes for better stability (20ms instead of 10ms)
          await new Promise((resolve) => setTimeout(resolve, 20))
          
          lastError = null
          break // Success, exit retry loop
        } catch (error: any) {
          lastError = error
          console.warn(`[Bluetooth Printer] Write attempt ${attempt + 1} failed:`, error)
          
          // Exponential backoff: wait longer before retry
          if (attempt < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)))
            
            // Try to reconnect if connection lost
            if (error.message?.includes("connection") || error.message?.includes("disconnect") || error.message?.includes("GATT")) {
              console.log("[Bluetooth Printer] Connection lost, attempting to reconnect...")
              const reconnected = await this.reconnect()
              if (!reconnected) {
                throw new Error("Failed to reconnect to printer")
              }
              console.log("[Bluetooth Printer] Reconnected successfully")
            }
          }
        }
      }

      // If all retries failed, throw error
      if (lastError) {
        throw lastError
      }
    }

    // Final flush delay to ensure data is sent
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  /**
   * Reconnect to printer if connection is lost
   */
  private async reconnect(): Promise<boolean> {
    try {
      // Try to reconnect using existing device
      if (this.device && this.device.gatt) {
        const server = await this.device.gatt.connect()
        const service = await server.getPrimaryService("000018f0-0000-1000-8000-00805f9b34fb")
        this.characteristic = await service.getCharacteristic("00002af1-0000-1000-8000-00805f9b34fb")
        return true
      }
      return false
    } catch (error) {
      console.error("[Bluetooth Printer] Reconnection failed:", error)
      return false
    }
  }

  /**
   * Print receipt with improved error handling and connection stability
   */
  async printReceipt(data: ReceiptData): Promise<boolean> {
    try {
      // Verify connection before starting
      if (!this.isConnected()) {
        throw new Error("Printer not connected")
      }

      // Initialize printer with retry
      await this.write(Commands.INIT)
      
      // Small delay after initialization
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Header
      await this.write(Commands.ALIGN_CENTER)
      await this.write(Commands.DOUBLE_HEIGHT)
      await this.write(Commands.BOLD_ON)

      const restaurantName = (data.restaurantName ?? "").trim()
      // Untuk mode double-height, lebar efektif lebih kecil, jadi bungkus teks manual
      const nameLines = this.wrapText(restaurantName || " ", 16)
      for (const line of nameLines) {
        await this.write(line + "\n")
      }

      await this.write(Commands.NORMAL_SIZE)
      await this.write(Commands.BOLD_OFF)
      await this.write((data.restaurantAddress ) + "\n")
      await this.write("Telp: " + (data.restaurantPhone ) + "\n")
      await this.write("================================\n")

      // Receipt info
      await this.write(Commands.ALIGN_LEFT)
      await this.write(`No. Struk: ${data.receiptNumber}\n`)
      await this.write(`Tanggal  : ${this.formatDate(data.orderDate)}\n`)
      if (data.customerName) {
        await this.write(`Customer : ${data.customerName}\n`)
      }
      if (data.tableNumber) {
        await this.write(`Meja     : ${data.tableNumber}\n`)
      }
      await this.write("================================\n")

      // Items
      for (const item of data.items) {
        await this.write(`${item.name}\n`)
        const qtyPrice = `${item.quantity} x ${this.formatCurrency(item.price)}`
        const total = this.formatCurrency(item.total)
        await this.write(this.padLine(qtyPrice, total, 32))
      }

      await this.write("--------------------------------\n")

      // Totals
      await this.write(this.padLine("Subtotal:", this.formatCurrency(data.subtotal), 32))

      // Hanya tampilkan pajak jika taxRate > 0 dan nilai pajak > 0
      if ((data.taxRate ?? 0) > 0 && data.tax > 0) {
        const label = `Pajak (${data.taxRate}%) :`
        await this.write(this.padLine(label, this.formatCurrency(data.tax), 32))
      }
      await this.write("================================\n")
      await this.write(Commands.DOUBLE_HEIGHT)
      await this.write(Commands.BOLD_ON)
      await this.write(this.padLine("TOTAL:", this.formatCurrency(data.total), 32))
      await this.write(Commands.NORMAL_SIZE)
      await this.write(Commands.BOLD_OFF)
      await this.write("================================\n")

      // Payment method
      await this.write(`Metode Bayar: ${data.paymentMethod}\n`)
      if (data.cashier) {
        await this.write(`Kasir: ${data.cashier}\n`)
      }

      // Footer
      await this.write("\n")
      await this.write(Commands.ALIGN_CENTER)

      const rawFooter = data.footerMessage
      const footerText =
        rawFooter && rawFooter.trim().length > 0
          ? rawFooter
          : "Terima Kasih\nAtas Kunjungan Anda"

      const footerLines = footerText.split("\n")
      for (const line of footerLines) {
        await this.write(line + "\n")
      }

      await this.write("\n\n")

      // Final delay before cut to ensure all data is printed
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Cut paper
      await this.write(Commands.CUT_PAPER)

      // Final flush delay to ensure cut command is executed
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Verify connection is still active after printing
      if (!this.isConnected()) {
        console.warn("[Bluetooth Printer] Connection lost after printing, but receipt may have been printed")
      }

      return true
    } catch (error: any) {
      console.error("[Bluetooth Printer] Failed to print receipt:", error)
      
      // If connection error, try to reconnect for next time
      if (error.message?.includes("connection") || error.message?.includes("disconnect")) {
        console.log("[Bluetooth Printer] Attempting to reconnect...")
        await this.reconnect()
      }
      
      return false
    }
  }

  /**
   * Format currency to Rupiah
   */
  private formatCurrency(amount: number): string {
    return `Rp ${new Intl.NumberFormat("id-ID").format(amount)}`
  }

  /**
   * Format date
   */
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  /**
   * Pad line to specific width
   */
  private padLine(left: string, right: string, width: number): string {
    const leftLen = this.getStringWidth(left)
    const rightLen = this.getStringWidth(right)
    const spaces = " ".repeat(Math.max(1, width - leftLen - rightLen))
    return left + spaces + right + "\n"
  }

  /**
   * Wrap text to a given visual width, memotong di spasi agar tidak memecah kata
   */
  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let current = ""

    for (const word of words) {
      const candidate = current ? current + " " + word : word
      if (this.getStringWidth(candidate) <= maxWidth) {
        current = candidate
      } else {
        if (current) {
          lines.push(current)
        }
        // Jika satu kata lebih panjang dari maxWidth, paksa di baris sendiri
        if (this.getStringWidth(word) > maxWidth) {
          lines.push(word)
          current = ""
        } else {
          current = word
        }
      }
    }

    if (current) {
      lines.push(current)
    }

    return lines
  }

  /**
   * Get visual width of string (accounting for non-ASCII chars)
   */
  private getStringWidth(str: string): number {
    let width = 0
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i)
      // ASCII chars are 1 width, others are 2
      width += code < 128 ? 1 : 2
    }
    return width
  }
}

// Singleton instance
let printerInstance: BluetoothPrinter | null = null

export function getPrinterInstance(): BluetoothPrinter {
  if (!printerInstance) {
    printerInstance = new BluetoothPrinter()
  }
  return printerInstance
}

