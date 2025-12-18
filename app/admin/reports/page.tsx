"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { supabaseClient } from "@/lib/supabaseClient"
import { TrendingUp, DollarSign, ShoppingBag, Package, Download, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Line, LineChart, Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { formatCurrency } from "@/lib/currency"
import { loadSettings, type AppSettings } from "@/lib/settings"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

type OrderData = {
  id: string
  items: Array<{
    productId: string
    productName: string
    quantity: number
    price: number
  }>
  total: number
  createdAt: string
}

type ProductData = {
  id: string
  name: string
  category_id: string | null
}

type ReportData = {
  period: "daily" | "monthly"
  periodLabel: string
  summary: {
    revenue: number
    orders: number
    averageOrder: number
    itemsSold: number
  }
  breakdown: Array<{
    date: string
    revenue: number
    orders: number
    items: number
  }>
  categorySales: Array<{
    category: string
    revenue: number
  }>
  topProducts: Array<{
    name: string
    quantity: number
    revenue: number
  }>
}

export default function ReportsPage() {
  const [orders, setOrders] = useState<OrderData[]>([])
  const [products, setProducts] = useState<ProductData[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [reportPeriod, setReportPeriod] = useState<"daily" | "monthly">("daily")

  useEffect(() => {
    const loadData = async () => {
      if (!supabaseClient) {
        setError("Konfigurasi Supabase belum lengkap.")
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load settings
        const appSettings = await loadSettings()
        setSettings(appSettings)

        // Load session
        const {
          data: { session },
        } = await supabaseClient.auth.getSession()

        if (!session) {
          setError("Sesi login tidak ditemukan. Silakan login kembali.")
          return
        }

        // Load orders
        const ordersRes = await fetch("/api/admin/orders", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        const ordersJson = await ordersRes.json()
        if (!ordersRes.ok) {
          throw new Error(ordersJson.error ?? "Gagal memuat pesanan")
        }

        // Load products and categories
        const [catRes, prodRes] = await Promise.all([
          supabaseClient
            .from("categories")
            .select("id, name")
            .eq("is_active", true),
          supabaseClient
            .from("products")
            .select("id, name, category_id"),
        ])

        if (catRes.error) throw catRes.error
        if (prodRes.error) throw prodRes.error

        setCategories((catRes.data ?? []).map((c: any) => ({ id: c.id, name: c.name })))
        setProducts(
          (prodRes.data ?? []).map((p: any) => ({
            id: p.id,
            name: p.name,
            category_id: p.category_id,
          }))
        )

        // Transform orders
        const ordersData = (ordersJson.orders ?? []).map((order: any) => ({
          id: order.id,
          items: order.items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
          })),
          total: order.total,
          createdAt: order.createdAt,
        }))

        setOrders(ordersData)
      } catch (err: any) {
        setError(err?.message ?? "Gagal memuat data laporan")
        console.error("Error loading reports data:", err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Calculate daily sales
  const dailySalesMap = new Map<string, { revenue: number; orders: number }>()
  orders.forEach((order) => {
    const date = new Date(order.createdAt).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    })
    const existing = dailySalesMap.get(date) || { revenue: 0, orders: 0 }
    dailySalesMap.set(date, {
      revenue: existing.revenue + order.total,
      orders: existing.orders + 1,
    })
  })

  const dailySalesData = Array.from(dailySalesMap.entries())
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orders: data.orders,
    }))
    .slice(-7) // Last 7 days

  // Calculate category sales
  const categoryMap = new Map<string, string>()
  categories.forEach((c) => categoryMap.set(c.id, c.name))
  
  const categorySalesMap = new Map<string, number>()
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const product = products.find((p) => p.id === item.productId)
      const categoryName = product?.category_id ? categoryMap.get(product.category_id) ?? "Tanpa Kategori" : "Tanpa Kategori"
      const existing = categorySalesMap.get(categoryName) || 0
      categorySalesMap.set(categoryName, existing + item.price * item.quantity)
    })
  })

  const categorySalesData = Array.from(categorySalesMap.entries()).map(
    ([category, revenue]) => ({
      category,
      revenue,
    }),
  )

  // Calculate top selling products
  const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>()
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const existing = productSalesMap.get(item.productId) || { name: item.productName, quantity: 0, revenue: 0 }
      productSalesMap.set(item.productId, {
        name: item.productName,
        quantity: existing.quantity + item.quantity,
        revenue: existing.revenue + item.price * item.quantity,
      })
    })
  })

  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
  const averageOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0
  const totalItemsSold = orders.reduce((sum, order) => order.items.reduce((s, i) => s + i.quantity, 0), 0)

  // Calculate report data
  const calculateReportData = (period: "daily" | "monthly"): ReportData => {
    const now = new Date()
    let startDate: Date
    let endDate: Date = now
    let periodLabel: string

    if (period === "daily") {
      startDate = new Date(now)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(now)
      endDate.setHours(23, 59, 59, 999)
      periodLabel = `Harian ${now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}`
    } else {
      // Monthly
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      endDate.setHours(23, 59, 59, 999)
      periodLabel = `Bulanan ${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`
    }

    // Filter orders by period
    const filteredOrders = orders.filter((order) => {
      const orderDate = new Date(order.createdAt)
      return orderDate >= startDate && orderDate <= endDate
    })

    // Calculate filtered stats
    const periodRevenue = filteredOrders.reduce((sum, order) => sum + order.total, 0)
    const periodOrdersCount = filteredOrders.length
    const periodAverageOrder = periodOrdersCount > 0 ? periodRevenue / periodOrdersCount : 0
    const periodItemsSold = filteredOrders.reduce(
      (sum, order) => sum + order.items.reduce((s, i) => s + i.quantity, 0),
      0
    )

    // Calculate daily/monthly breakdown
    const breakdownMap = new Map<string, { revenue: number; orders: number; items: number }>()
    filteredOrders.forEach((order) => {
      const orderDate = new Date(order.createdAt)
      const key =
        period === "daily"
          ? orderDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short" })
          : orderDate.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })

      const existing = breakdownMap.get(key) || { revenue: 0, orders: 0, items: 0 }
      breakdownMap.set(key, {
        revenue: existing.revenue + order.total,
        orders: existing.orders + 1,
        items: existing.items + order.items.reduce((s, i) => s + i.quantity, 0),
      })
    })

    const breakdown = Array.from(breakdownMap.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate category sales for period
    const categoryMap = new Map<string, string>()
    categories.forEach((c) => categoryMap.set(c.id, c.name))

    const categorySalesMap = new Map<string, number>()
    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId)
        const categoryName = product?.category_id
          ? categoryMap.get(product.category_id) ?? "Tanpa Kategori"
          : "Tanpa Kategori"
        const existing = categorySalesMap.get(categoryName) || 0
        categorySalesMap.set(categoryName, existing + item.price * item.quantity)
      })
    })

    const categorySales = Array.from(categorySalesMap.entries())
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue)

    // Calculate top products for period
    const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>()
    filteredOrders.forEach((order) => {
      order.items.forEach((item) => {
        const existing = productSalesMap.get(item.productId) || { name: item.productName, quantity: 0, revenue: 0 }
        productSalesMap.set(item.productId, {
          name: item.productName,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + item.price * item.quantity,
        })
      })
    })

    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    return {
      period,
      periodLabel,
      summary: {
        revenue: periodRevenue,
        orders: periodOrdersCount,
        averageOrder: periodAverageOrder,
        itemsSold: periodItemsSold,
      },
      breakdown,
      categorySales,
      topProducts,
    }
  }

  // Generate PDF report
  const generatePDF = (period: "daily" | "monthly") => {
    const report = calculateReportData(period)
    const now = new Date()

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPosition = 20

    // Helper untuk format currency
    const formatCurrency = (amount: number) => {
      return `Rp ${amount.toLocaleString("id-ID")}`
    }

    // Header
    doc.setFontSize(18)
    doc.setFont("helvetica", "bold")
    doc.text("LAPORAN PENJUALAN", pageWidth / 2, yPosition, { align: "center" })
    yPosition += 8

    doc.setFontSize(14)
    doc.setFont("helvetica", "normal")
    doc.text(report.periodLabel.toUpperCase(), pageWidth / 2, yPosition, { align: "center" })
    yPosition += 6

    doc.setFontSize(10)
    doc.text(settings?.restaurant_name || "Restoran", pageWidth / 2, yPosition, { align: "center" })
    yPosition += 5

    doc.setFontSize(9)
    doc.text(
      `Tanggal: ${now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      pageWidth / 2,
      yPosition,
      { align: "center" }
    )
    yPosition += 10

    // Summary Section
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("RINGKASAN", 14, yPosition)
    yPosition += 8

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    const summaryData = [
      ["Total Pendapatan", formatCurrency(report.summary.revenue)],
      ["Total Pesanan", report.summary.orders.toString()],
      ["Rata-rata Nilai Pesanan", formatCurrency(Math.round(report.summary.averageOrder))],
      ["Jumlah Item Terjual", report.summary.itemsSold.toString()],
    ]

    autoTable(doc, {
      startY: yPosition,
      head: [["Item", "Nilai"]],
      body: summaryData,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 80, halign: "right" } },
      margin: { left: 14, right: 14 },
    })

    yPosition = (doc as any).lastAutoTable.finalY + 10

    // Breakdown Section
    if (report.breakdown.length > 0) {
      if (yPosition > pageHeight - 50) {
        doc.addPage()
        yPosition = 20
      }

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text(`RINCIAN ${period === "daily" ? "HARIAN" : "BULANAN"}`, 14, yPosition)
      yPosition += 8

      const breakdownData = report.breakdown.map((item) => [
        item.date,
        formatCurrency(item.revenue),
        item.orders.toString(),
        item.items.toString(),
      ])

      autoTable(doc, {
        startY: yPosition,
        head: [["Tanggal", "Pendapatan", "Jumlah Pesanan", "Jumlah Item"]],
        body: breakdownData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 50, halign: "right" },
          2: { cellWidth: 40, halign: "center" },
          3: { cellWidth: 40, halign: "center" },
        },
        margin: { left: 14, right: 14 },
      })

      yPosition = (doc as any).lastAutoTable.finalY + 10
    }

    // Category Sales Section
    if (report.categorySales.length > 0) {
      if (yPosition > pageHeight - 50) {
        doc.addPage()
        yPosition = 20
      }

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("PENJUALAN PER KATEGORI", 14, yPosition)
      yPosition += 8

      const categoryData = report.categorySales.map((item) => [item.category, formatCurrency(item.revenue)])

      autoTable(doc, {
        startY: yPosition,
        head: [["Kategori", "Pendapatan"]],
        body: categoryData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 60, halign: "right" } },
        margin: { left: 14, right: 14 },
      })

      yPosition = (doc as any).lastAutoTable.finalY + 10
    }

    // Top Products Section
    if (report.topProducts.length > 0) {
      if (yPosition > pageHeight - 50) {
        doc.addPage()
        yPosition = 20
      }

      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("PRODUK TERLARIS (TOP 10)", 14, yPosition)
      yPosition += 8

      const productsData = report.topProducts.map((item) => [
        item.name,
        item.quantity.toString(),
        formatCurrency(item.revenue),
      ])

      autoTable(doc, {
        startY: yPosition,
        head: [["Produk", "Jumlah Terjual", "Pendapatan"]],
        body: productsData,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 40, halign: "center" },
          2: { cellWidth: 40, halign: "right" },
        },
        margin: { left: 14, right: 14 },
      })
    }

    // Footer
    const finalY = (doc as any).lastAutoTable?.finalY || yPosition
    if (finalY < pageHeight - 20) {
      doc.setFontSize(8)
      doc.setFont("helvetica", "italic")
      doc.text(
        `Laporan ini dihasilkan pada ${now.toLocaleString("id-ID")}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      )
    }

    // Save PDF
    const fileName = `Laporan_Penjualan_${period === "daily" ? "Harian" : "Bulanan"}_${now.toISOString().split("T")[0]}.pdf`
    doc.save(fileName)

    toast.success(`Laporan ${period === "daily" ? "harian" : "bulanan"} berhasil diunduh`)
  }

  // Calculate report data using useMemo to avoid recalculating unnecessarily
  const currentReportData = useMemo(() => {
    if (orders.length > 0 && categories.length > 0 && products.length > 0) {
      return calculateReportData(reportPeriod)
    }
    return null
  }, [orders, reportPeriod, categories, products])

  useEffect(() => {
    setReportData(currentReportData)
  }, [currentReportData])

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Laporan Penjualan</h1>
          <p className="text-muted-foreground">
            {settings ? `${settings.restaurant_name} - ` : ""}
            Analisis kinerja penjualan restoran Anda.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setReportPeriod("daily")}
            variant={reportPeriod === "daily" ? "default" : "outline"}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Laporan Harian
          </Button>
          <Button
            onClick={() => setReportPeriod("monthly")}
            variant={reportPeriod === "monthly" ? "default" : "outline"}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Laporan Bulanan
          </Button>
          {reportData && (
            <Button onClick={() => generatePDF(reportPeriod)} variant="default" className="gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="text-center py-12 text-sm text-muted-foreground">Memuat data laporan...</div>
      )}

      {!loading && (
        <>
          {/* Summary Stats */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendapatan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Akumulasi seluruh waktu</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pesanan</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Jumlah pesanan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rata-rata Nilai Pesanan</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(averageOrderValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Rata-rata per pesanan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Jumlah Item Terjual</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItemsSold}</div>
            <p className="text-xs text-muted-foreground mt-1">Total unit terjual</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Daily Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Pendapatan Harian</CardTitle>
            <CardDescription>Performa penjualan 7 hari terakhir</CardDescription>
          </CardHeader>
          <CardContent>
            {dailySalesData.length > 0 ? (
              <ChartContainer
                config={{
                  revenue: {
                    label: "Pendapatan",
                    color: "hsl(var(--chart-1))",
                  },
                }}
                className="h-64 w-full"
              >
                <LineChart data={dailySalesData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
                      return value.toString()
                    }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={2}
                    dot={{ fill: "var(--color-revenue)", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <p>Belum ada data penjualan.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Penjualan per Kategori</CardTitle>
            <CardDescription>Ringkasan pendapatan berdasarkan kategori menu</CardDescription>
          </CardHeader>
          <CardContent>
            {categorySalesData.length > 0 ? (
              <ChartContainer
                config={{
                  revenue: {
                    label: "Pendapatan",
                    color: "hsl(var(--chart-2))",
                  },
                }}
                className="h-64 w-full"
              >
                <AreaChart data={categorySalesData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
                      return value.toString()
                    }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    fill="var(--color-revenue)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <p>Belum ada data penjualan per kategori.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Produk Terlaris</CardTitle>
          <CardDescription>Produk dengan pendapatan tertinggi</CardDescription>
        </CardHeader>
        <CardContent>
          {topProducts.length > 0 ? (
            <div className="space-y-4">
              {topProducts.map((product, idx) => (
                <div key={idx} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.quantity} unit terjual</p>
                    </div>
                  </div>
                  <p className="font-bold text-primary">{formatCurrency(product.revenue)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Belum ada data penjualan produk.</p>
          )}
        </CardContent>
      </Card>

      {/* Report Tables */}
      {reportData && (
        <div className="space-y-6 mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Rincian {reportData.period === "daily" ? "Harian" : "Bulanan"}</CardTitle>
              <CardDescription>Detail penjualan per {reportData.period === "daily" ? "hari" : "tanggal"}</CardDescription>
            </CardHeader>
            <CardContent>
              {reportData.breakdown.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead className="text-right">Pendapatan</TableHead>
                        <TableHead className="text-center">Jumlah Pesanan</TableHead>
                        <TableHead className="text-center">Jumlah Item</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.breakdown.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.date}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                          <TableCell className="text-center">{item.orders}</TableCell>
                          <TableCell className="text-center">{item.items}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Belum ada data untuk periode ini.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Penjualan per Kategori</CardTitle>
              <CardDescription>Ringkasan pendapatan berdasarkan kategori</CardDescription>
            </CardHeader>
            <CardContent>
              {reportData.categorySales.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">Pendapatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.categorySales.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.category}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Belum ada data penjualan per kategori.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Produk Terlaris (Top 10)</CardTitle>
              <CardDescription>Produk dengan pendapatan tertinggi</CardDescription>
            </CardHeader>
            <CardContent>
              {reportData.topProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No</TableHead>
                        <TableHead>Produk</TableHead>
                        <TableHead className="text-center">Jumlah Terjual</TableHead>
                        <TableHead className="text-right">Pendapatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.topProducts.map((product, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="text-center">{product.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Belum ada data produk terlaris.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
        </>
      )}
    </div>
  )
}
