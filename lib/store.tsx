"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { Product, Order, Category, OrderItem } from "./types"

interface StoreContextType {
  products: Product[]
  orders: Order[]
  categories: Category[]
  addProduct: (product: Omit<Product, "id" | "createdAt">) => void
  updateProduct: (id: string, product: Partial<Product>) => void
  deleteProduct: (id: string) => void
  createOrder: (
    items: OrderItem[],
    customerName?: string,
    tableNumber?: string,
    orderType?: Order["orderType"],
    note?: string,
  ) => void
  updateOrderStatus: (id: string, status: Order["status"], cancelNote?: string) => void
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

const STORAGE_KEY = "restaurant-pos-data"

const defaultCategories: Category[] = [
  { id: "1", name: "Appetizers", icon: "🥗" },
  { id: "2", name: "Main Course", icon: "🍽️" },
  { id: "3", name: "Desserts", icon: "🍰" },
  { id: "4", name: "Beverages", icon: "🥤" },
]

const defaultProducts: Product[] = [
  {
    id: "1",
    name: "Caesar Salad",
    description: "Fresh romaine lettuce with parmesan",
    price: 8.99,
    category: "Appetizers",
    image: "/caesar-salad.png",
    available: true,
    createdAt: new Date(),
  },
  {
    id: "2",
    name: "Grilled Chicken",
    description: "Tender chicken with herbs",
    price: 15.99,
    category: "Main Course",
    image: "/grilled-chicken.png",
    available: true,
    createdAt: new Date(),
  },
  {
    id: "3",
    name: "Chocolate Cake",
    description: "Rich chocolate layered cake",
    price: 6.99,
    category: "Desserts",
    image: "/decadent-chocolate-cake.png",
    available: true,
    createdAt: new Date(),
  },
  {
    id: "4",
    name: "Fresh Orange Juice",
    description: "Freshly squeezed oranges",
    price: 4.99,
    category: "Beverages",
    image: "/glass-of-orange-juice.png",
    available: true,
    createdAt: new Date(),
  },
]

export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [categories] = useState<Category[]>(defaultCategories)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      setProducts(data.products || defaultProducts)
      setOrders(data.orders || [])
    } else {
      setProducts(defaultProducts)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, orders }))
  }, [products, orders])

  const addProduct = (product: Omit<Product, "id" | "createdAt">) => {
    const newProduct: Product = {
      ...product,
      id: Date.now().toString(),
      createdAt: new Date(),
    }
    setProducts((prev) => [...prev, newProduct])
  }

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  const createOrder = (
    items: OrderItem[],
    customerName?: string,
    tableNumber?: string,
    orderType: Order["orderType"] = "dine_in",
    note?: string,
  ) => {
    const newOrder: Order = {
      id: Date.now().toString(),
      items,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      status: "pending",
      createdAt: new Date(),
      customerName,
      tableNumber,
      orderType,
      note,
    }
    setOrders((prev) => [newOrder, ...prev])
  }

  const updateOrderStatus = (id: string, status: Order["status"], cancelNote?: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status,
              cancelNote: cancelNote ?? o.cancelNote,
            }
          : o,
      ),
    )
  }

  return (
    <StoreContext.Provider
      value={{
        products,
        orders,
        categories,
        addProduct,
        updateProduct,
        deleteProduct,
        createOrder,
        updateOrderStatus,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error("useStore must be used within StoreProvider")
  }
  return context
}
