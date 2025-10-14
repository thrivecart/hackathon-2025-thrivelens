import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import OpenAI from 'openai'
import { 
  getProducts, 
  getProduct, 
  getProductPricing,
  listTransactions,
  getCustomerByEmail,
  listAffiliates,
  getUpsells,
  getBumps,
  getDownsells,
  getUpsellPricing,
  getBumpPricing,
  getDownsellPricing
} from '../lib/thrivecart'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ query: string; history?: Array<{role: string, content: string}> }>(event)
  const query = (body?.query || '').trim()
  const history = body?.history || []

  if (!query) {
    return { messages: [{ type: 'error', content: 'Please ask a question.' }] }
  }

  const cfg = useRuntimeConfig()
  const apiKey = cfg.openai?.apiKey as string | undefined
  if (!apiKey) {
    return { messages: [{ type: 'error', content: 'OpenAI is not configured.' }] }
  }

  try {
    const openai = new OpenAI({ apiKey })
    const messages: Array<{ type: string, content: string, status?: string }> = []
    
    // System prompt
    const systemPrompt = [
      'You are Thrivebot: a concise, business-savvy AI assistant for ThriveCart merchants.',
      'You help analyze business data, create coupons, and perform commerce operations.',
      '',
      'CRITICAL BEHAVIOR RULES:',
      '- When you need to make tool calls, explain what you\'re doing FIRST',
      '- Then make the tool calls to get the data',
      '- Always complete all necessary tool calls before final response',
      '- When user asks for exports/files, explain that you\'ll provide the data in text format',
      '',
      'Available ThriveCart tools:',
      '- Products: list_products, get_product_pricing_by_name, list_products_with_pricing',
      '- Sales: list_transactions, Customers: get_customer_by_email',
      '- Marketing: list_affiliates, list_upsells, list_bumps, list_downsells',
      '',
      'Always be concise and actionable.',
    ].join(' ')

    // Build conversation with history
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: query }
    ]

    // Step 1: Get initial AI response with potential tool calls
    messages.push({ type: 'status', content: 'Processing your request...', status: 'thinking' })
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      messages: conversationMessages,
      tools: [
        // === PRODUCT TOOLS ===
        {
          type: 'function',
          function: {
            name: 'list_products',
            description: 'List all ThriveCart products',
            parameters: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['live', 'test'] }
              }
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'list_products_with_pricing',
            description: 'List all products WITH pricing automatically fetched',
            parameters: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['live', 'test'] }
              }
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_product_pricing_by_name',
            description: 'Get pricing for a product by name (like TC-5474)',
            parameters: {
              type: 'object',
              properties: {
                product_name: { type: 'string' }
              },
              required: ['product_name']
            }
          }
        },
        
        // === TRANSACTION TOOLS ===
        {
          type: 'function',
          function: {
            name: 'list_transactions',
            description: 'List transactions for analysis',
            parameters: {
              type: 'object',
              properties: {
                transactionType: { 
                  type: 'string',
                  enum: ['any', 'charge', 'rebill', 'refund', 'cancel']
                },
                perPage: { type: 'integer', minimum: 1, maximum: 100 },
                page: { type: 'integer', minimum: 1 }
              }
            }
          }
        },
        
        // === CUSTOMER TOOLS ===
        {
          type: 'function',
          function: {
            name: 'get_customer_by_email',
            description: 'Look up customer by email',
            parameters: {
              type: 'object',
              properties: {
                email: { type: 'string' }
              },
              required: ['email']
            }
          }
        },
        
        // === AFFILIATE TOOLS ===
        {
          type: 'function',
          function: {
            name: 'list_affiliates',
            description: 'List affiliates',
            parameters: {
              type: 'object',
              properties: {
                product_id: { type: 'integer' },
                perPage: { type: 'integer' },
                page: { type: 'integer' }
              }
            }
          }
        },
        
        // === FUNNEL TOOLS ===
        {
          type: 'function',
          function: {
            name: 'list_upsells',
            description: 'List upsell offers',
            parameters: {
              type: 'object',
              properties: {}
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'list_bumps',
            description: 'List order bumps',
            parameters: {
              type: 'object',
              properties: {}
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'list_downsells',
            description: 'List downsells',
            parameters: {
              type: 'object',
              properties: {}
            }
          }
        }
      ]
    })

    const message = response.choices[0]?.message
    if (!message) {
      return { messages: [{ type: 'error', content: 'Failed to get AI response' }] }
    }

    // If there are tool calls, process them with status updates
    if (message.tool_calls && message.tool_calls.length > 0) {
      messages.push({ 
        type: 'progress', 
        content: `Making ${message.tool_calls.length} data requests...`,
        status: 'working'
      })

      const toolResults = []
      
      for (let i = 0; i < message.tool_calls.length; i++) {
        const toolCall = message.tool_calls[i]
        const { name, arguments: args } = toolCall.function
        
        messages.push({ 
          type: 'progress', 
          content: `Step ${i + 1}: Calling ${name}...`,
          status: 'working'
        })

        try {
          let result = await callThriveCartTool(name, JSON.parse(args))
          
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool' as const,
            content: JSON.stringify(result, null, 2)
          })

          messages.push({ 
            type: 'progress', 
            content: `✓ ${name} completed`,
            status: 'success'
          })

        } catch (error) {
          messages.push({ 
            type: 'progress', 
            content: `✗ ${name} failed: ${error.message}`,
            status: 'error'
          })
          
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool' as const,
            content: JSON.stringify({ error: error.message })
          })
        }
      }

      // Step 2: Get final response with all tool results
      messages.push({ 
        type: 'progress', 
        content: 'Generating final response...',
        status: 'thinking'
      })

      const finalResponse = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: query },
          message,
          ...toolResults
        ]
      })

      const finalReply = finalResponse.choices[0]?.message?.content?.trim()
      messages.push({ 
        type: 'final', 
        content: finalReply || 'I processed your request but couldn\'t generate a response.',
        status: 'complete'
      })

    } else {
      // No tool calls needed, return direct response
      messages.push({ 
        type: 'final', 
        content: message.content?.trim() || 'I need more information to help you.',
        status: 'complete'
      })
    }

    return { messages }

  } catch (error) {
    console.error('Streaming chat error:', error)
    return { 
      messages: [
        { type: 'error', content: 'I encountered an issue processing your request.' }
      ]
    }
  }
})

// Helper function to call ThriveCart tools
async function callThriveCartTool(toolName: string, args: any): Promise<any> {
  const cleanQuery = (params: any) => {
    const cleaned: any = {}
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && value !== '') {
        cleaned[key] = value
      }
    }
    return cleaned
  }
  
  switch (toolName) {
    case 'list_products':
      return await getProducts({ status: args.status || 'live' })
      
    case 'list_products_with_pricing':
      // Get products first
      const productsData = await getProducts({ status: args.status || 'live' })
      const productArray = productsData?.data || productsData?.items || productsData?.results || productsData
      
      if (Array.isArray(productArray)) {
        // Limit to first 5 products to avoid timeouts
        const limitedProducts = productArray.slice(0, 5)
        const productsWithPricing = []
        
        for (const product of limitedProducts) {
          const productId = product.id || product.product_id || product.uuid
          const productName = product.name || product.product_name || 'Unknown'
          
          let pricing = null
          try {
            if (productId) {
              const pricingData = await getProductPricing(productId)
              if (pricingData?.data && Array.isArray(pricingData.data)) {
                const priceObj = pricingData.data[0]
                pricing = priceObj?.price || priceObj?.amount || priceObj?.cost
              } else if (pricingData?.price || pricingData?.amount) {
                pricing = pricingData.price || pricingData.amount
              }
            }
          } catch (e) {
            // Continue without pricing if fetch fails
          }
          
          productsWithPricing.push({
            id: productId,
            name: productName,
            status: product.status,
            price: pricing,
            formatted: pricing ? `${productName} ($${pricing})` : `${productName} (pricing unavailable)`
          })
        }
        
        return {
          products: productsWithPricing,
          total: productArray.length,
          showing: limitedProducts.length
        }
      }
      return { error: 'No products found' }
      
    case 'get_product_pricing_by_name':
      // Find product by name first, then get pricing
      const productsForName = await getProducts({ status: 'live' })
      const productArray2 = productsForName?.data || productsForName?.items || productsForName?.results || productsForName
      
      if (Array.isArray(productArray2)) {
        const searchName = args.product_name.toLowerCase()
        let foundProduct = null
        
        for (const product of productArray2) {
          const productName = (product.name || product.product_name || '').toLowerCase()
          if (productName.includes(searchName) || searchName.includes(productName)) {
            foundProduct = {
              id: product.id || product.product_id || product.uuid,
              name: product.name || product.product_name || 'Unknown',
              status: product.status
            }
            break
          }
        }
        
        if (foundProduct && foundProduct.id) {
          const pricingData = await getProductPricing(foundProduct.id)
          return {
            product: foundProduct,
            pricing: pricingData,
            message: `Found pricing for ${foundProduct.name} (ID: ${foundProduct.id})`
          }
        } else {
          throw new Error(`Product "${args.product_name}" not found`)
        }
      } else {
        throw new Error('Could not retrieve products list')
      }
      
    case 'list_transactions':
      return await listTransactions(cleanQuery(args))
      
    case 'get_customer_by_email':
      return await getCustomerByEmail(args.email)
      
    case 'list_affiliates':
      return await listAffiliates(cleanQuery(args))
      
    case 'list_upsells':
      return await getUpsells({})
      
    case 'list_bumps':
      return await getBumps({})
      
    case 'list_downsells':
      return await getDownsells({})
      
    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}