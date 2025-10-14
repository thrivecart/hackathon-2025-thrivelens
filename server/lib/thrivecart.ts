import { ofetch } from 'ofetch'
import { createError } from 'h3'

function getConfig() {
  const cfg = useRuntimeConfig()
  const apiKey = cfg.thrivecart?.apiKey
  const baseUrl = cfg.thrivecart?.baseUrl || 'https://thrivecart.com'
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: 'ThriveCart API not configured' })
  }
  return { apiKey, baseUrl }
}

function client(modeOverride?: 'live' | 'test') {
  const { apiKey, baseUrl } = getConfig()
  // Mode header controls live/test
  const mode = (modeOverride || (process.env.NUXT_THRIVECART_MODE as any) || 'live') as 'live' | 'test'
  return ofetch.create({
    baseURL: baseUrl + '/api/external',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-TC-Mode': mode,
      'X-TC-Sdk': 'node/1.0',
      'X-TC-Version': '1.0.0'
    }
  })
}

// Helpers: attach query params only if defined
function q(obj: Record<string, any>) {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') out[k] = v
  return out
}

export type Period = { start?: string; end?: string }

// Transactions (orders/sales)
export async function listTransactions(params: {
  query?: string
  transactionType?: 'any' | 'charge' | 'rebill' | 'refund' | 'cancel'
  perPage?: number
  page?: number
  mode?: 'live' | 'test'
} = {}) {
  const c = client(params.mode)
  return c('/transactions', { query: q(params) })
}

// Convenience wrapper for metrics period mapping
export async function getOrders(period?: Period) {
  const c = client()
  const params: any = {}
  if (period?.start) params.from = period.start
  if (period?.end) params.to = period.end
  return c('/transactions', { query: q(params) })
}

// Products
export async function getProducts(params: { status?: 'live' | 'test' } = {}) {
  const c = client(params.status as any)
  return c('/products', { query: q(params) })
}
export async function getProduct(id: string | number, params: any = {}) {
  const c = client(params?.mode)
  return c(`/products/${id}`, { query: q(params) })
}
export async function getProductPricing(id: string | number, params: any = {}) {
  const c = client(params?.mode)
  return c(`/products/${id}/pricing_options`, { query: q(params) })
}

// Bumps
export async function getBumps(params: any = {}) {
  const c = client(params?.mode)
  return c('/bumps', { query: q(params) })
}
export async function getBump(id: string | number, params: any = {}) {
  const c = client(params?.mode)
  return c(`/bumps/${id}`, { query: q(params) })
}
export async function getBumpPricing(id: string | number, params: any = {}) {
  const c = client(params?.mode)
  return c(`/bumps/${id}/pricing_options`, { query: q(params) })
}

// Upsells
export async function getUpsells(params: any = {}) {
  const c = client(params?.mode)
  return c('/upsells', { query: q(params) })
}
export async function getUpsell(id: string | number, params: any = {}) {
  const c = client(params?.mode)
  return c(`/upsells/${id}`, { query: q(params) })
}
export async function getUpsellPricing(id: string | number, params: any = {}) {
  const c = client(params?.mode)
  return c(`/upsells/${id}/pricing_options`, { query: q(params) })
}

// Downsells
export async function getDownsells(params: any = {}) {
  const c = client(params?.mode)
  return c('/downsells', { query: q(params) })
}
export async function getDownsell(id: string | number, params: any = {}) {
  const c = client(params?.mode)
  return c(`/downsells/${id}`, { query: q(params) })
}
export async function getDownsellPricing(id: string | number, params: any = {}) {
  const c = client(params?.mode)
  return c(`/downsells/${id}/pricing_options`, { query: q(params) })
}

// Customer (lookup by email)
export async function getCustomerByEmail(email: string) {
  const c = client()
  return c('/customer', { method: 'POST', body: { email } })
}

// Refund & subscriptions
export async function refund(body: { order_id: number; reference: string; reason?: string }) {
  const c = client()
  return c('/refund', { method: 'POST', body })
}
export async function cancelSubscription(body: { order_id: number; subscription_id: number }) {
  const c = client()
  return c('/cancelSubscription', { method: 'POST', body })
}
export async function pauseSubscription(body: { order_id: number; subscription_id: number; auto_resume?: number }) {
  const c = client()
  return c('/pauseSubscription', { method: 'POST', body })
}
export async function resumeSubscription(body: { order_id: number; subscription_id: number }) {
  const c = client()
  return c('/resumeSubscription', { method: 'POST', body })
}

// Affiliates
export async function listAffiliates(params: { product_id?: number; query?: string; perPage?: number; page?: number } = {}) {
  const c = client()
  return c('/affiliates', { query: q(params) })
}
export async function getAffiliate(body: { affiliate_id: string }) {
  const c = client()
  return c('/affiliate', { method: 'POST', body })
}
export async function createAffiliate(body: any) {
  const c = client()
  // normalize product_ids to JSON string if array
  if (Array.isArray(body?.product_ids)) body.product_ids = JSON.stringify(body.product_ids)
  return c('/affiliates', { method: 'POST', body })
}
export async function favoriteAffiliate(affiliate_id: string, body: any = {}) {
  const c = client()
  return c(`/affiliates/${affiliate_id}/favorite`, { method: 'POST', body })
}
export async function unfavoriteAffiliate(affiliate_id: string, body: any = {}) {
  const c = client()
  return c(`/affiliates/${affiliate_id}/unfavorite`, { method: 'POST', body })
}
export async function registerAffiliate(affiliate_id: string, body: any = {}) {
  const c = client()
  if (Array.isArray(body?.product_ids)) body.product_ids = JSON.stringify(body.product_ids)
  return c(`/affiliates/${affiliate_id}/register`, { method: 'POST', body })
}
export async function approveAffiliate(affiliate_id: string, body: any = {}) {
  const c = client()
  if (Array.isArray(body?.product_ids)) body.product_ids = JSON.stringify(body.product_ids)
  return c(`/affiliates/${affiliate_id}/approve`, { method: 'POST', body })
}
export async function rejectAffiliate(affiliate_id: string, body: any = {}) {
  const c = client()
  if (Array.isArray(body?.product_ids)) body.product_ids = JSON.stringify(body.product_ids)
  return c(`/affiliates/${affiliate_id}/reject`, { method: 'POST', body })
}
export async function setCustomCommissions(affiliate_id: string, body: any = {}) {
  const c = client()
  if (typeof body?.commission_object === 'object') body.commission_object = JSON.stringify(body.commission_object)
  return c(`/affiliates/${affiliate_id}/custom_commissions`, { method: 'POST', body })
}
export async function deleteAffiliate(affiliate_id: string, body: any = {}) {
  const c = client()
  return c(`/affiliates/${affiliate_id}/delete`, { method: 'POST', body })
}

// Event subscriptions
export async function subscribeToEvents(body: { event: string; target_url: string; trigger_fields?: any }) {
  const c = client()
  return c('/subscribe', { method: 'POST', body })
}
export async function unsubscribeFromEvents(body: { target_url: string }) {
  const c = client()
  return c('/unsubscribe', { method: 'POST', body })
}
