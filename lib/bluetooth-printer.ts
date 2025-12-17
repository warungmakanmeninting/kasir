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
   * Check if printer is connected
   */
  isConnected(): boolean {
    return this.device !== null && this.device.gatt?.connected === true
  }

  /**
   * Disconnect from printer
   */
  disconnect(): void {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect()
    }
    this.device = null
    this.characteristic = null
  }

  /**
   * Send data to printer
   */
  private async write(data: string): Promise<void> {
    if (!this.characteristic) {
      throw new Error("Printer not connected")
    }

    const encoder = new TextEncoder()
    const bytes = encoder.encode(data)

    // Split into chunks if needed (max 20 bytes per write for some printers)
    const chunkSize = 20
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize)
      await this.characteristic.writeValue(chunk)
      await new Promise((resolve) => setTimeout(resolve, 10)) // Small delay between writes
    }
  }

  /**
   * Print receipt
   */
  async printReceipt(data: ReceiptData): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        throw new Error("Printer not connected")
      }

      // Initialize
      await this.write(Commands.INIT)

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

      // Cut paper
      await this.write(Commands.CUT_PAPER)

      return true
    } catch (error) {
      console.error("Failed to print receipt:", error)
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

