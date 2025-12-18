"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, Search, X, Eye } from "lucide-react"
import Image from "next/image"
import { Switch } from "@/components/ui/switch"
import { supabaseClient } from "@/lib/supabaseClient"
import { formatCurrency, formatNumber } from "@/lib/currency"
import Cropper, { type Area } from "react-easy-crop"
import { getCroppedFile } from "./crop-utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type CategoryRow = {
  id: string
  name: string
}

type ProductRow = {
  id: string
  name: string
  description: string | null
  price: number
  category_id: string | null
  image_url: string | null
  is_available: boolean
  stock_quantity: number
  track_stock: boolean
}

type ProductView = {
  id: string
  name: string
  description: string
  price: number
  categoryId: string | null
  categoryName: string
  image: string
  available: boolean
  stockQuantity: number
  trackStock: boolean
}

type ProductVariant = {
  id?: string
  name: string
  additional_price: number
  is_active: boolean
}

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductView | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailProduct, setDetailProduct] = useState<ProductView | null>(null)
  const [newProductId, setNewProductId] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    image: "",
    available: true,
    stockQuantity: "",
    trackStock: false,
  })
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [detailVariants, setDetailVariants] = useState<ProductVariant[]>([])

  const onCropComplete = (_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }

  const applyCrop = async () => {
    if (!imagePreviewUrl || !croppedAreaPixels || !imageFile) {
      setDialogError("Gagal menyimpan crop gambar. Silakan pilih gambar lagi.")
      return
    }

    try {
      const croppedFile = await getCroppedFile(imagePreviewUrl, croppedAreaPixels, imageFile)
      const objectUrl = URL.createObjectURL(croppedFile)
      setImageFile(croppedFile)
      setImagePreviewUrl(objectUrl)
    } catch (err: any) {
      setDialogError(err?.message ?? "Gagal memproses crop gambar.")
    }
  }

  useEffect(() => {
    const loadData = async () => {
      if (!supabaseClient) {
        setError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
        return
      }

      try {
        setLoading(true)
        setError(null)

        const [catRes, prodRes] = await Promise.all([
          supabaseClient
            .from("categories")
            .select("id, name, is_active, sort_order")
            .order("sort_order", { ascending: true }),
          supabaseClient
            .from("products")
            .select(
              "id, name, description, price, category_id, image_url, is_available, stock_quantity, track_stock, created_at",
            )
            .order("created_at", { ascending: true }),
        ])

        if (catRes.error) throw catRes.error
        if (prodRes.error) throw prodRes.error

        setCategories(
          (catRes.data ?? []).map((c: any) => ({
            id: c.id as string,
            name: c.name as string,
          })),
        )

        setProducts(
          (prodRes.data ?? []).map((p: any) => ({
            id: p.id as string,
            name: p.name as string,
            description: (p.description as string | null) ?? null,
            price: Number(p.price),
            category_id: (p.category_id as string | null) ?? null,
            image_url: (p.image_url as string | null) ?? null,
            is_available: Boolean(p.is_available),
            stock_quantity: Number(p.stock_quantity ?? 0),
            track_stock: Boolean(p.track_stock),
          })),
        )
      } catch (err) {
        setError("Gagal memuat data produk dari database. Silakan coba lagi atau hubungi administrator.")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const productsView: ProductView[] = useMemo(() => {
    const categoryMap = new Map<string, string>()
    categories.forEach((c) => {
      if (c.id) categoryMap.set(c.id, c.name)
    })

    return products.map((p) => {
      const categoryName = p.category_id ? categoryMap.get(p.category_id) ?? "Uncategorized" : "Uncategorized"
      return {
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        price: p.price,
        categoryId: p.category_id,
        categoryName,
        image: p.image_url ?? "/placeholder.svg",
        available: p.is_available,
        stockQuantity: p.stock_quantity,
        trackStock: p.track_stock,
      }
    })
  }, [products, categories])

  const filteredProducts = productsView.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.categoryName.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const openDetailDialog = async (product: ProductView) => {
    setDetailProduct(product)
    setIsDetailOpen(true)
    
    // Load variants for detail view
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from("product_variants")
          .select("id, name, additional_price, is_active")
          .eq("product_id", product.id)
          .order("created_at", { ascending: true })
        
        if (error) {
          console.error("[PRODUCTS] Error loading detail variants:", error)
          setDetailVariants([])
        } else if (data) {
          setDetailVariants(data.map(v => ({
            id: v.id,
            name: v.name,
            additional_price: Number(v.additional_price),
            is_active: Boolean(v.is_active),
          })))
        } else {
          setDetailVariants([])
        }
      } catch (err) {
        console.error("[PRODUCTS] Exception loading detail variants:", err)
        setDetailVariants([])
      }
    } else {
      setDetailVariants([])
    }
  }

  const openDialog = async (product?: ProductView) => {
    if (product) {
      setEditingProduct(product)
      setNewProductId(null)
      setFormData({
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        categoryId: product.categoryId ?? (categories[0]?.id ?? ""),
        image: product.image,
        available: product.available,
        stockQuantity: (product.stockQuantity ?? 0).toString(),
        trackStock: product.trackStock,
      })
      setImageFile(null)
      setImagePreviewUrl(product.image || null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      
      // Load variants
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient
            .from("product_variants")
            .select("id, name, additional_price, is_active")
            .eq("product_id", product.id)
            .order("created_at", { ascending: true })
          
          if (error) {
            console.error("[PRODUCTS] Error loading variants:", error)
            setVariants([])
          } else if (data) {
            console.log("[PRODUCTS] Loaded variants:", data.length)
            setVariants(data.map(v => ({
              id: v.id,
              name: v.name,
              additional_price: Number(v.additional_price),
              is_active: Boolean(v.is_active),
            })))
          } else {
            setVariants([])
          }
        } catch (err) {
          console.error("[PRODUCTS] Exception loading variants:", err)
          setVariants([])
        }
      } else {
        setVariants([])
      }
    } else {
      setEditingProduct(null)
      // Generate id untuk produk baru (dipakai sebagai nama file upload)
      const generatedId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2)
      setNewProductId(generatedId)
      setFormData({
        name: "",
        description: "",
        price: "",
        categoryId: categories[0]?.id ?? "",
        image: "",
        available: true,
        stockQuantity: "",
        trackStock: false,
      })
      setImageFile(null)
      setImagePreviewUrl(null)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setVariants([])
    }
    setDialogError(null)
    // Set dialog open after variants are loaded (if editing)
    if (product) {
      // Wait a bit to ensure variants state is set
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingProduct(null)
    setDialogError(null)
    setNewProductId(null)
    setImageFile(null)
    setImagePreviewUrl(null)
    setVariants([])
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  const closeDetailDialog = () => {
    setIsDetailOpen(false)
    setDetailProduct(null)
    setDetailVariants([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDialogError(null)

    if (!supabaseClient) {
      setDialogError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
      return
    }

    const priceNumber = Number.parseFloat(formData.price)
    if (Number.isNaN(priceNumber) || priceNumber < 0) {
      setDialogError("Harga tidak valid.")
      return
    }

    const stockNumber = formData.stockQuantity ? Number.parseInt(formData.stockQuantity, 10) : 0
    if (Number.isNaN(stockNumber) || stockNumber < 0) {
      setDialogError("Jumlah stok harus berupa angka >= 0.")
      return
    }

    // Siapkan URL gambar (dari input manual atau dari upload file nanti)
    let imageUrl: string | null = formData.image || null

    // Jika ada file yang dipilih, upload ke bucket uploads dengan nama <productId>.<ext>
    if (imageFile && supabaseClient) {
      const productId = editingProduct?.id ?? newProductId
      if (!productId) {
        setDialogError("ID produk belum tersedia. Simpan nama produk terlebih dahulu lalu coba upload lagi.")
        return
      }

      try {
        setUploadingImage(true)
        const fileExt = imageFile.name.split(".").pop()
        const safeExt = fileExt ? fileExt.toLowerCase() : "jpg"
        const fileName = `${productId}.${safeExt}`
        const filePath = `products/${fileName}`

        const { error: uploadError } = await supabaseClient.storage
          .from("uploads")
          .upload(filePath, imageFile, {
            cacheControl: "3600",
            upsert: true,
          })

        if (uploadError) throw uploadError

        const {
          data: { publicUrl },
        } = supabaseClient.storage.from("uploads").getPublicUrl(filePath)

        imageUrl = publicUrl
      } catch (err: any) {
        setDialogError(err?.message ?? "Gagal mengupload gambar. Silakan coba lagi.")
        setUploadingImage(false)
        return
      } finally {
        setUploadingImage(false)
      }
    }

    const payload: any = {
      name: formData.name,
      description: formData.description,
      price: priceNumber,
      category_id: formData.categoryId || null,
      image_url: imageUrl,
      is_available: formData.available,
      stock_quantity: stockNumber,
      track_stock: formData.trackStock,
    }

    // Untuk produk baru, pakai id yang sudah di-generate agar sinkron dengan nama file upload
    if (!editingProduct && newProductId) {
      payload.id = newProductId
    }

    try {
      let productId: string

      if (editingProduct) {
        if (!editingProduct.id) {
          setDialogError("ID produk tidak valid.")
          return
        }
        productId = editingProduct.id
        const { data, error } = await supabaseClient
          .from("products")
          .update(payload)
          .eq("id", productId)
          .select()
          .single()

        if (error) throw error

        setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...(data as any) } : p)))
      } else {
        const { data, error } = await supabaseClient.from("products").insert(payload).select().single()

        if (error) throw error

        productId = data.id
        setProducts((prev) => [...prev, data as any])
      }

      // Save variants
      if (productId) {
        // Delete existing variants first (if editing)
        if (editingProduct) {
          await supabaseClient
            .from("product_variants")
            .delete()
            .eq("product_id", productId)
        }

        // Insert new variants
        if (variants.length > 0) {
          const variantsToInsert = variants
            .filter(v => v.name.trim() !== "")
            .map(v => ({
              product_id: productId,
              name: v.name.trim(),
              additional_price: v.additional_price,
              is_active: v.is_active,
            }))

          if (variantsToInsert.length > 0) {
            const { error: variantError } = await supabaseClient
              .from("product_variants")
              .insert(variantsToInsert)

            if (variantError) throw variantError
          }
        }
      }

      closeDialog()
    } catch (err: any) {
      setDialogError(err?.message ?? "Gagal menyimpan produk. Silakan coba lagi.")
    }
  }

  const addVariant = () => {
    setVariants([...variants, { name: "", additional_price: 0, is_active: true }])
  }

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index))
  }

  const updateVariant = (index: number, field: keyof ProductVariant, value: string | number | boolean) => {
    const updated = [...variants]
    updated[index] = { ...updated[index], [field]: value }
    setVariants(updated)
  }

  // Helper function untuk format angka dengan separator ribuan
  const formatNumberInput = (value: string | number): string => {
    if (!value && value !== 0) return ""
    const numValue = typeof value === "string" ? value.replace(/\./g, "") : value
    const num = typeof numValue === "string" ? Number.parseFloat(numValue) : numValue
    if (Number.isNaN(num)) return ""
    return formatNumber(num)
  }

  // Helper function untuk parse input angka (hilangkan separator)
  const parseNumberInput = (value: string): string => {
    return value.replace(/\./g, "")
  }

  // Handler untuk input harga
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = parseNumberInput(e.target.value)
    setFormData({ ...formData, price: rawValue })
  }

  // Handler untuk input harga tambahan varian
  const handleVariantPriceChange = (index: number, value: string) => {
    const rawValue = parseNumberInput(value)
    const numValue = Number.parseFloat(rawValue) || 0
    updateVariant(index, "additional_price", numValue)
  }

  const handleDelete = async (id: string) => {
    if (!supabaseClient) {
      setError("Konfigurasi Supabase belum lengkap. Hubungi administrator.")
      return
    }

    if (!id) {
      setError("ID produk tidak valid.")
      return
    }

    try {
      const { error } = await supabaseClient.from("products").delete().eq("id", id)
      if (error) throw error

      setProducts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError("Gagal menghapus produk. Silakan coba lagi.")
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manajemen Produk</h1>
          <p className="text-muted-foreground">Kelola daftar menu restoran yang tersimpan di database Supabase.</p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Tambah Produk
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="aspect-square relative bg-muted">
              <Image src={product.image || "/placeholder.svg"} alt={product.name} fill className="object-cover" />
            </div>
            <CardContent className="flex flex-col flex-1 p-3">
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm mb-1 truncate leading-tight">{product.name}</h3>
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    {product.categoryName}
                  </Badge>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mb-1.5 line-clamp-2 leading-tight">
                {product.description ? (product.description.length > 20 ? `${product.description.slice(0, 20)}...` : product.description) : "-"}
              </p>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-primary">{formatCurrency(product.price)}</span>
                <Badge variant={product.available ? "default" : "secondary"} className="text-[9px] px-1.5 py-0">
                  {product.available ? "Tersedia" : "Tidak tersedia"}
                </Badge>
              </div>
              {product.trackStock && (
                <div className="mb-2 text-[10px] text-muted-foreground">
                  <span>Stok: </span>
                  <span className="font-medium text-foreground">
                    {typeof product.stockQuantity === "number" ? product.stockQuantity : 0}
                  </span>
                </div>
              )}
              <div className="mt-auto flex gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-transparent h-7 w-7"
                  onClick={() => openDetailDialog(product)}
                  title="Detail"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="sr-only">Detail</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-transparent h-7 w-7"
                  onClick={() => openDialog(product)}
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="sr-only">Edit</span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon" className="h-7 w-7" title="Hapus">
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Hapus produk</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus Produk</AlertDialogTitle>
                      <AlertDialogDescription>
                        Produk ini akan dihapus dari daftar menu. Tindakan ini tidak dapat dibatalkan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          void handleDelete(product.id)
                        }}
                      >
                        Hapus
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Tidak ada produk yang ditemukan.</p>
        </div>
      )}

      {/* Detail produk (read-only) */}
      <Dialog
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open)
          if (!open) {
            setDetailProduct(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          {detailProduct && (
            <>
              <DialogHeader>
                <DialogTitle>Detail Produk</DialogTitle>
                <DialogDescription>Lihat informasi lengkap produk.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="relative w-24 h-24 rounded-md border overflow-hidden bg-muted">
                    <Image
                      src={detailProduct.image || "/placeholder.svg"}
                      alt={detailProduct.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{detailProduct.name}</h3>
                    <Badge variant="secondary" className="mt-1 text-[10px]">
                      {detailProduct.categoryName}
                    </Badge>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {detailProduct.description || "Tidak ada deskripsi"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Harga</p>
                    <p className="font-semibold">{formatCurrency(detailProduct.price)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Status</p>
                    <Badge variant={detailProduct.available ? "default" : "secondary"}>
                      {detailProduct.available ? "Tersedia" : "Tidak tersedia"}
                    </Badge>
                  </div>
                  {detailProduct.trackStock && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Stok</p>
                      <p className="font-semibold">
                        {typeof detailProduct.stockQuantity === "number" ? detailProduct.stockQuantity : 0}
                      </p>
                    </div>
                  )}
                </div>

                {/* Variants Section */}
                {detailVariants.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Varian Produk</p>
                      <Badge variant="secondary" className="text-xs">
                        {detailVariants.length} varian
                      </Badge>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {detailVariants.map((variant) => (
                        <div key={variant.id || variant.name} className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm">
                          <div className="flex-1">
                            <div className="font-medium">{variant.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Harga tambahan: {variant.additional_price > 0 ? "+" : ""}
                              {formatCurrency(variant.additional_price)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={variant.is_active ? "default" : "secondary"} className="text-xs">
                              {variant.is_active ? "Aktif" : "Nonaktif"}
                            </Badge>
                            <div className="text-right">
                              <div className="font-semibold">
                                {formatCurrency(detailProduct.price + variant.additional_price)}
                              </div>
                              <div className="text-xs text-muted-foreground">Total</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDetailDialog}>
                  Tutup
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!detailProduct) return
                    closeDetailDialog()
                    openDialog(detailProduct)
                  }}
                >
                  Edit Produk
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {loading && (
        <div className="text-center py-6 text-sm text-muted-foreground">Memuat produk dari database...</div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Perbarui detail produk di bawah ini."
                : "Isi detail produk menu yang akan ditambahkan ke kasir."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-1">
                  <Label htmlFor="name">Nama Produk</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

              {/* Availability & stock controls (2 columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="available" className="font-normal">
                      Tersedia untuk dijual
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Jika nonaktif, produk tidak akan muncul di layar kasir.
                    </p>
                  </div>
                  <Switch
                    id="available"
                    checked={formData.available}
                    onCheckedChange={(checked) => setFormData({ ...formData, available: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="track_stock" className="font-normal">
                      Pantau stok
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Jika aktif, sistem memakai nilai <span className="font-semibold">jumlah stok</span>.
                    </p>
                  </div>
                  <Switch
                    id="track_stock"
                    checked={formData.trackStock}
                    onCheckedChange={(checked) => setFormData({ ...formData, trackStock: checked })}
                  />
                </div>
              </div>

              {/* Price, stock, category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="price">Harga</Label>
                  <Input
                    id="price"
                    type="text"
                    inputMode="numeric"
                    value={formData.price ? formatNumberInput(formData.price) : ""}
                    onChange={handlePriceChange}
                    placeholder="0"
                    required
                  />
                </div>
                {formData.trackStock && (
                  <div className="space-y-1">
                    <Label htmlFor="stockQuantity">Jumlah Stok</Label>
                    <Input
                      id="stockQuantity"
                      type="number"
                      min={0}
                      value={formData.stockQuantity}
                      onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                    />
                  </div>
                )}
                <div className={`space-y-1 ${formData.trackStock ? "" : "sm:col-span-2"}`}>
                  <Label htmlFor="category">Kategori</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Variants Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Varian Produk</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addVariant}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Tambah Varian
                  </Button>
                </div>
                {variants.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                    {variants.map((variant, index) => (
                      <div key={variant.id || `variant-${index}`} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                        <div className="flex-1 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Nama Varian</Label>
                            <Input
                              placeholder="Contoh: Large, Extra Cheese"
                              value={variant.name}
                              onChange={(e) => updateVariant(index, "name", e.target.value)}
                              className="text-sm h-8"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Harga Tambahan</Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="0 untuk tidak ada perubahan"
                              value={variant.additional_price ? formatNumberInput(variant.additional_price) : ""}
                              onChange={(e) => handleVariantPriceChange(index, e.target.value)}
                              className="text-sm h-8"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs whitespace-nowrap">Aktif</Label>
                            <Switch
                              checked={variant.is_active}
                              onCheckedChange={(checked) => updateVariant(index, "is_active", checked)}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeVariant(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {variants.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Tidak ada varian. Klik "Tambah Varian" untuk menambahkan.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Gambar Produk</Label>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-2">
                    <Input
                      id="image_file"
                      type="file"
                      accept="image/*"
                      disabled={!supabaseClient || uploadingImage}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setDialogError(null)
                        setImageFile(file)
                        // Preview lokal, belum upload ke storage
                        const objectUrl = URL.createObjectURL(file)
                        setImagePreviewUrl(objectUrl)
                        setCrop({ x: 0, y: 0 })
                        setZoom(1)
                      }}
                    />
                  </div>
                  {imageFile && imagePreviewUrl && (
                    <div className="space-y-2">
                      <Label>Edit & Preview</Label>
                      <div className="space-y-2">
                        <div className="relative w-full h-56 rounded-md border overflow-hidden bg-muted">
                          <Cropper
                            image={imagePreviewUrl}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>Ukuran</span>
                          <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.1}
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-full"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={applyCrop}
                            disabled={!croppedAreaPixels}
                          >
                            Simpan Crop
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  {!imageFile && formData.image && (
                    <div className="space-y-2">
                      <Label>Preview</Label>
                      <div className="relative w-24 h-24 rounded-md border overflow-hidden bg-muted">
                        <Image
                          src={formData.image}
                          alt={formData.name || "Preview"}
                          fill
                          className="object-cover"
                        />
                      </div>
                    </div>
                  )}
                  {uploadingImage && <p className="text-xs text-muted-foreground">Mengupload gambar...</p>}
                </div>
              </div>
              {dialogError && <p className="text-sm text-red-500">{dialogError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Batal
              </Button>
              <Button type="submit">{editingProduct ? "Simpan Perubahan" : "Simpan Produk"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
