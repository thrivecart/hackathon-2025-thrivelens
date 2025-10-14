// ThriveCart transaction structure (based on API docs)
export type Transaction = {
  id?: string
  invoice_id?: string
  transaction_id?: string
  customer_email?: string
  customer_name?: string
  product_id?: string
  product_name?: string
  amount?: number
  transaction_type?: string // 'charge', 'refund', 'rebill', 'cancel'
  transaction_time?: string
  status?: string
}

export function sum(arr: number[]) { return arr.reduce((a, b) => a + (b || 0), 0) }
export function round(n: number, d = 2) { const m = Math.pow(10, d); return Math.round((n + Number.EPSILON) * m) / m }

// Normalize any input to an array. Supports common API shapes: [], {data:[]}, {items:[]}
function toArray<T = any>(input: any): T[] {
  if (Array.isArray(input)) return input as T[]
  if (input && Array.isArray(input.data)) return input.data as T[]
  if (input && Array.isArray(input.items)) return input.items as T[]
  if (input && Array.isArray(input.results)) return input.results as T[]
  if (input && Array.isArray(input.transactions)) return input.transactions as T[]
  return []
}

export function topProducts(input: any, limit = 5) {
  const transactions = toArray<Transaction>(input)
  const map = new Map<string, { name: string; qty: number; revenue: number }>()
  
  for (const tx of transactions) {
    // Only include charge transactions (actual sales)
    if (tx.transaction_type !== 'charge') continue
    
    const k = tx.product_id || 'unknown'
    const prev = map.get(k) || { name: tx.product_name || 'Unknown Product', qty: 0, revenue: 0 }
    prev.qty += 1
    prev.revenue += tx.amount || 0
    map.set(k, prev)
  }
  
  return [...map.entries()].map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

export function revenueSummary(input: any) {
  const transactions = toArray<Transaction>(input)
  const charges = transactions.filter(tx => tx.transaction_type === 'charge')
  const totals = charges.map(tx => tx.amount || 0)
  const total = sum(totals)
  const count = charges.length
  const aov = count ? total / count : 0
  return { total, count, aov }
}

export function refundSummary(input: any) {
  const transactions = toArray<Transaction>(input)
  const charges = transactions.filter(tx => tx.transaction_type === 'charge')
  const refunds = transactions.filter(tx => tx.transaction_type === 'refund')
  
  const refundedAmount = sum(refunds.map(tx => Math.abs(tx.amount || 0)))
  const totalAmount = sum(charges.map(tx => Math.abs(tx.amount || 0)))
  const rate = totalAmount > 0 ? refundedAmount / totalAmount : 0
  
  return { count: refunds.length, amount: refundedAmount, rate }
}
