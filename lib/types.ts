export interface Product {
  id: string
  name: string
  description: string
  price: number
  category: string
  image: string
  available: boolean
  createdAt: Date
}

export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  price: number
}

export interface Order {
  id: string
  items: OrderItem[]
  total: number
  status: "pending" | "preparing" | "completed" | "cancelled"
  createdAt: Date
  customerName?: string
  tableNumber?: string
  orderType?: "dine_in" | "takeaway" | "gojek" | "grab" | "shopeefood"
  note?: string
  cancelNote?: string
}

export interface Category {
  id: string
  name: string
  icon: string
}

export interface DailySales {
  date: string
  revenue: number
  orders: number
}
