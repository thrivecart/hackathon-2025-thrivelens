import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import OpenAI from 'openai'
import { spawn } from 'child_process'
import { join } from 'path'

// Analytics functions still needed for legacy computations
import { revenueSummary, refundSummary, topProducts } from '../lib/analytics'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ query: string; period?: { start?: string; end?: string } }>(event)
  const query = (body?.query || '').trim()
  const period = body?.period || {}
  if (!query) {
    return { reply: 'Please ask a question. For example: “Top 3 products last month?”' }
  }

  const cfg = useRuntimeConfig()
  const apiKey = cfg.openai?.apiKey as string | undefined
  if (!apiKey) {
    return { reply: 'OpenAI is not configured. Set NUXT_OPENAI_API_KEY in .env.' }
  }

  // Period helpers
  function parsePeriodFromQuery(q: string) {
    const now = new Date()
    const lower = q.toLowerCase()
    const iso = (d: Date) => d.toISOString().slice(0, 10)

    // YYYY-MM or Month YYYY
    const mmYYYY = lower.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{4})/) || lower.match(/(\d{4})-(\d{2})/)
    if (mmYYYY) {
      let year: number, monthIdx: number
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
      if (mmYYYY.length === 3 && isNaN(Number(mmYYYY[1])) ) {
        monthIdx = months.indexOf(mmYYYY[1].slice(0,3))
        year = Number(mmYYYY[2])
      } else {
        year = Number(mmYYYY[1])
        monthIdx = Number(mmYYYY[2]) - 1
      }
      const start = new Date(Date.UTC(year, monthIdx, 1))
      const end = new Date(Date.UTC(year, monthIdx + 1, 0))
      return { start: iso(start), end: iso(end) }
    }

    if (lower.includes('last 7')) {
      const end = now
      const start = new Date(now.getTime() - 7 * 86400000)
      return { start: iso(start), end: iso(end) }
    }
    if (lower.includes('last 30') || lower.includes('last month')) {
      const end = now
      const start = new Date(now.getTime() - 30 * 86400000)
      return { start: iso(start), end: iso(end) }
    }
    if (lower.includes('this month')) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth()+1, 0))
      return { start: iso(start), end: iso(end) }
    }
    return null
  }

  // Intent routing
  const lower = query.toLowerCase()
  const periodFromQuery = parsePeriodFromQuery(query)

  async function normalizeArray(raw: any) {
    if (Array.isArray(raw)) return raw
    return raw?.data || raw?.items || raw?.results || raw?.transactions || []
  }

  // Handlers
  if (lower.includes('affiliate')) {
    const pageMatch = lower.match(/page\s+(\d{1,4})/)
    const perPageMatch = lower.match(/per\s*page\s+(\d{1,3})/)
    const page = pageMatch ? Number(pageMatch[1]) : 1
    const perPage = perPageMatch ? Math.min(Number(perPageMatch[1]), 25) : 10
    const aff = await listAffiliates({ page, perPage }) as any
    const items = await normalizeArray(aff)
    const top = items.slice(0, perPage).map((a: any) => ({
      id: a?.id ?? a?.affiliate_id ?? a?.user_id ?? null,
      name: a?.name ?? (([a?.first_name, a?.last_name].filter(Boolean).join(' ')) || 'Unknown'),
      email: a?.email,
      status: a?.status,
    }))

    const context = { affiliates: top, page, perPage }
    const system = [
      'You are Thrivebot: concise, business-savvy. Use plain English. Keep replies short and actionable.',
      'If unsure, say "Based on available data…".'
    ].join(' ')
    const openai = new OpenAI({ apiKey: useRuntimeConfig().openai?.apiKey as string })
    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini', temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'system', content: `Context JSON: ${JSON.stringify(context)}` },
        { role: 'user', content: query }
      ]
    })
    const reply = res.choices?.[0]?.message?.content?.trim() || `Found ${top.length} affiliates.`
    return { reply }
  }

  if (lower.includes('upsell')) {
    const data = await getUpsells({})
    const items = await normalizeArray(data)
    const upsells = items.slice(0, 20).map((u: any) => ({ id: u?.id ?? u?.upsell_id, name: u?.name || u?.upsell_name }))
    const context = { upsells }
    const openai = new OpenAI({ apiKey: useRuntimeConfig().openai?.apiKey as string })
    const res = await openai.chat.completions.create({ model: 'gpt-4.1-mini', temperature: 0.2, messages: [
      { role: 'system', content: 'You are Thrivebot. Be concise and actionable.' },
      { role: 'system', content: `Context JSON: ${JSON.stringify(context)}` },
      { role: 'user', content: query }
    ]})
    const reply = res.choices?.[0]?.message?.content?.trim() || `Found ${upsells.length} upsells.`
    return { reply }
  }

  if (lower.includes('bump')) {
    const data = await getBumps({})
    const items = await normalizeArray(data)
    const bumps = items.slice(0, 20).map((b: any) => ({ id: b?.id ?? b?.bump_id, name: b?.name || b?.bump_name }))
    const context = { bumps }
    const openai = new OpenAI({ apiKey: useRuntimeConfig().openai?.apiKey as string })
    const res = await openai.chat.completions.create({ model: 'gpt-4.1-mini', temperature: 0.2, messages: [
      { role: 'system', content: 'You are Thrivebot. Be concise and actionable.' },
      { role: 'system', content: `Context JSON: ${JSON.stringify(context)}` },
      { role: 'user', content: query }
    ]})
    const reply = res.choices?.[0]?.message?.content?.trim() || `Found ${bumps.length} bumps.`
    return { reply }
  }

  if (lower.includes('downsell')) {
    const data = await getDownsells({})
    const items = await normalizeArray(data)
    const downsells = items.slice(0, 20).map((d: any) => ({ id: d?.id ?? d?.downsell_id, name: d?.name || d?.downsell_name }))
    const context = { downsells }
    const openai = new OpenAI({ apiKey: useRuntimeConfig().openai?.apiKey as string })
    const res = await openai.chat.completions.create({ model: 'gpt-4.1-mini', temperature: 0.2, messages: [
      { role: 'system', content: 'You are Thrivebot. Be concise and actionable.' },
      { role: 'system', content: `Context JSON: ${JSON.stringify(context)}` },
      { role: 'user', content: query }
    ]})
    const reply = res.choices?.[0]?.message?.content?.trim() || `Found ${downsells.length} downsells.`
    return { reply }
  }

  // Products
  if (lower.includes('product pricing')) {
    const idMatch = lower.match(/(id|product)\s*(\d{3,})/)
    if (idMatch) {
      const id = idMatch[2]
      const pricing = await getProductPricing(id)
      const context = { pricing }
      const openai = new OpenAI({ apiKey: useRuntimeConfig().openai?.apiKey as string })
      const res = await openai.chat.completions.create({ model: 'gpt-4.1-mini', temperature: 0.2, messages: [
        { role: 'system', content: 'You are Thrivebot. Be concise and actionable.' },
        { role: 'system', content: `Context JSON: ${JSON.stringify(context)}` },
        { role: 'user', content: query }
      ]})
      const reply = res.choices?.[0]?.message?.content?.trim() || 'Here is the pricing.'
      return { reply }
    }
  }

  if (lower.includes('products') || lower.includes('list products') || lower.includes('all products')) {
    const productsRaw = await getProducts({ status: 'live' } as any)
    const arr = await normalizeArray(productsRaw)
    
    // Enhanced product mapping with pricing info
    const products = await Promise.all(
      arr.slice(0, 20).map(async (p: any) => {
        const baseProduct = {
          id: p?.id ?? p?.product_id ?? p?.uuid ?? null,
          name: p?.name ?? p?.product_name ?? 'Unknown',
          status: p?.status,
        }
        
        // Try to extract pricing from the main product object first
        const priceFromProduct = p?.price ?? p?.amount ?? p?.cost ?? p?.unit_price ?? null
        if (priceFromProduct !== null) {
          return { ...baseProduct, price: priceFromProduct }
        }
        
        // If no price in main object, try to fetch pricing options
        try {
          if (baseProduct.id) {
            const pricing = await getProductPricing(baseProduct.id)
            const pricingData = await normalizeArray(pricing)
            
            // Extract the primary/default price
            let primaryPrice = null
            if (Array.isArray(pricingData) && pricingData.length > 0) {
              const firstOption = pricingData[0]
              primaryPrice = firstOption?.price ?? firstOption?.amount ?? firstOption?.cost ?? null
            } else if (pricing && typeof pricing === 'object') {
              primaryPrice = pricing?.price ?? pricing?.amount ?? pricing?.cost ?? null
            }
            
            return { ...baseProduct, price: primaryPrice }
          }
        } catch {
          // If pricing fetch fails, continue without pricing
        }
        
        return { ...baseProduct, price: null }
      })
    )
    
    const context = { products, total_count: arr.length }
    const openai = new OpenAI({ apiKey: useRuntimeConfig().openai?.apiKey as string })
    const res = await openai.chat.completions.create({ model: 'gpt-4.1-mini', temperature: 0.2, messages: [
      { role: 'system', content: 'You are Thrivebot. Be concise and actionable. Show product names with pricing when available.' },
      { role: 'system', content: `Context JSON: ${JSON.stringify(context)}` },
      { role: 'user', content: query }
    ]})
    const reply = res.choices?.[0]?.message?.content?.trim() || `Found ${products.length} products.`
    return { reply }
  }

  // Sales by product / top product for period
  if (lower.includes('sales') || lower.includes('top product')) {
    const p = periodFromQuery || { start: new Date(Date.now()-30*86400000).toISOString().slice(0,10), end: new Date().toISOString().slice(0,10) }
    const [txRaw, productsRaw] = await Promise.all([
      listTransactions({ transactionType: 'charge', perPage: 100 }),
      getProducts({ status: 'live' } as any)
    ])
    const tx = await normalizeArray(txRaw)
    const prodArr = await normalizeArray(productsRaw)

    const nameById = new Map<string, string>()
    for (const pItem of prodArr) {
      const id = pItem?.id ?? pItem?.product_id
      if (id) nameById.set(String(id), pItem?.name ?? pItem?.product_name ?? 'Unknown')
    }

    const agg = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const t of tx) {
      if (t?.transaction_type !== 'charge') continue
      const id = String(t?.product_id ?? '')
      if (!id) continue
      const rec = agg.get(id) || { name: nameById.get(id) || 'Unknown', qty: 0, revenue: 0 }
      rec.qty += 1
      rec.revenue += t?.amount || 0
      agg.set(id, rec)
    }
    const byProduct = [...agg.entries()].map(([id, v]) => ({ id, ...v })).sort((a,b)=>b.revenue-a.revenue)

    // Deterministic short reply to avoid LLM "no access" confusion
    if (byProduct.length === 0) {
      return { reply: 'Based on available data… no sales found for the selected period.' }
    }
    const lines = byProduct.slice(0, 15).map((r, i) => `${i+1}. ${r.name} — ${r.qty} sales — $${Math.round(r.revenue).toLocaleString()}`)
    const header = periodFromQuery ? `Sales by product (${p.start} → ${p.end})` : 'Sales by product (last 30 days)'
    return { reply: [header, ...lines].join('\n') }
  }

  // Customer lookup by email
  if (lower.includes('@') && (lower.includes('customer') || lower.includes('lookup') || lower.includes('find'))) {
    const emailMatch = query.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)
    if (emailMatch) {
      try {
        const cust = await getCustomerByEmail(emailMatch[0])
        const context = { customer: cust }
        const openai = new OpenAI({ apiKey: useRuntimeConfig().openai?.apiKey as string })
        const res = await openai.chat.completions.create({ model: 'gpt-4.1-mini', temperature: 0.2, messages: [
          { role: 'system', content: 'You are Thrivebot. Be concise and actionable.' },
          { role: 'system', content: `Context JSON: ${JSON.stringify(context)}` },
          { role: 'user', content: query }
        ]})
        const reply = res.choices?.[0]?.message?.content?.trim() || 'Customer found.'
        return { reply }
      } catch (e: any) {
        return { reply: `Based on available data… I couldn’t fetch that customer (${e?.statusCode || e?.status || e?.message || 'unknown error'}).` }
      }
    }
  }

  // Default metrics fallback (revenue/refunds/top products for last 30 days)
  const now = new Date()
  const startDate = period.start ? new Date(period.start) : new Date(now.getTime() - 30 * 86400000)
  const endDate = period.end ? new Date(period.end) : now
  const params = { start: startDate.toISOString().slice(0,10), end: endDate.toISOString().slice(0,10) }

  // Conservative fallback: use transactions list and compute summaries
  let txRaw: any = []
  try {
    txRaw = await listTransactions({ transactionType: 'any', perPage: 100 })
  } catch {
    txRaw = []
  }
  const tx = await normalizeArray(txRaw)
  const revenue = revenueSummary(tx as any)
  const refunds = refundSummary(tx as any)
  const top = topProducts(tx as any, 5)

  const productsRaw = await getProducts({ status: 'live' } as any)
  const productsArr = await normalizeArray(productsRaw)

  // Derive best-guess creation date from common fields
  function getCreatedAt(p: any): string | null {
    const candidates = [p?.created_at,p?.createdAt,p?.created,p?.date_created,p?.time_created,p?.createdDate]
    for (const c of candidates) {
      if (!c) continue
      const d = new Date(c)
      if (!isNaN(d.getTime())) return d.toISOString()
      if (typeof c === 'number') {
        const d2 = new Date((c > 1e12 ? c : c * 1000))
        if (!isNaN(d2.getTime())) return d2.toISOString()
      }
    }
    return null
  }
  const products = productsArr.slice(0, 50).map((p: any) => ({ id: p?.id ?? p?.product_id ?? p?.uuid ?? null, name: p?.name ?? p?.product_name ?? 'Unknown', status: p?.status ?? undefined, created_at: getCreatedAt(p) }))
  const latestProduct = products.filter(p=>p.created_at).sort((a,b)=> (a.created_at!>b.created_at!?-1:1))[0] || null

  const system = [
    'You are Thrivebot: concise, business-savvy, part data analyst, part marketing coach.',
    'Use plain English, no jargon or filler. Keep replies short, factual, and actionable.',
    'Tie suggestions to sales, profit, or conversion. When uncertain, say: "Based on available data…".'
  ].join(' ')

  const context = {
    period: params,
    revenue,
    refunds,
    top,
    products,
    latestProduct
  }

  const openai = new OpenAI({ apiKey })
  const res = await openai.chat.completions.create({
    model: 'gpt-4.1-mini',
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'system', content: `Context JSON: ${JSON.stringify(context)}` },
      { role: 'user', content: query }
    ]
  })

  const reply = res.choices?.[0]?.message?.content?.trim() || 'Based on available data… I don’t have a confident answer yet.'
  return { reply }
})