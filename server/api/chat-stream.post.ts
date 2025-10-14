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
      '- NEVER say "I will", "Let me", "Now I will" - always DO all actions immediately and completely',
      '- For single product pricing: use get_product_pricing_by_name tool',
      '- For ALL products with prices: First call list_products, then call get_product_pricing_by_name for each product',
      '- For customer analysis: Analyze transaction data directly - do NOT say you will calculate, just DO the calculation and show results',
      '- Make ALL necessary tool calls in sequence, then perform complete analysis in your final response',
      '- When you have data, analyze it immediately and provide complete insights',
      '- Always complete all necessary tool calls AND analysis before final response',
      '',
      'Available ThriveCart tools:',
      '- Products: list_products, get_product_pricing_by_name',
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

    // Start reasoning loop with streaming updates
    const finalContent = await runStreamingReasoningLoop(
      openai,
      systemPrompt,
      history,
      query,
      message,
      messages,
      6  // Max iterations
    )
    
    messages.push({ 
      type: 'final', 
      content: finalContent,
      status: 'complete'
    })

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

// Streaming reasoning loop to handle multiple tool calls iteratively
async function runStreamingReasoningLoop(
  openai: any,
  systemPrompt: string,
  history: Array<{role: string, content: string}>,
  userQuery: string,
  initialMessage: any,
  messages: Array<{type: string, content: string, status?: string}>,
  maxIterations: number = 6
): Promise<string> {
  const conversationHistory = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userQuery }
  ]
  
  let currentMessage = initialMessage
  let iteration = 0
  
  // Add tools definition for subsequent calls
  const tools = [
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
    {
      type: 'function',
      function: {
        name: 'list_transactions',
        description: 'List transactions for analysis',
        parameters: {
          type: 'object',
          properties: {
            transactionType: { type: 'string', enum: ['any', 'charge', 'rebill', 'refund', 'cancel'] },
            perPage: { type: 'integer', minimum: 1, maximum: 100 },
            page: { type: 'integer', minimum: 1 }
          }
        }
      }
    }
  ]
  
  while (iteration < maxIterations) {
    // If the current message has no tool calls, we're done
    if (!currentMessage.tool_calls || currentMessage.tool_calls.length === 0) {
      return currentMessage.content?.trim() || 'I processed your request but couldn\'t generate a response.'
    }
    
    messages.push({ 
      type: 'progress', 
      content: `Making ${currentMessage.tool_calls.length} data requests...`,
      status: 'working'
    })
    
    // Add the assistant's message (with tool calls) to the conversation
    conversationHistory.push(currentMessage)
    
    // Execute all tool calls in this iteration
    const toolResults = []
    for (let i = 0; i < currentMessage.tool_calls.length; i++) {
      const toolCall = currentMessage.tool_calls[i]
      const { name, arguments: args } = toolCall.function
      
      messages.push({ 
        type: 'progress', 
        content: `Step ${i + 1}: Calling ${name}...`,
        status: 'working'
      })
      
      try {
        const result = await callThriveCartTool(name, JSON.parse(args))
        
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
    
    // Add tool results to conversation
    conversationHistory.push(...toolResults)
    
    // Get the AI's next response
    messages.push({ 
      type: 'progress', 
      content: 'Analyzing results...',
      status: 'thinking'
    })
    
    try {
      const nextResponse = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        temperature: 0.2,
        messages: conversationHistory,
        tools: tools
      })
      
      currentMessage = nextResponse.choices[0]?.message
      if (!currentMessage) {
        break
      }
      
    } catch (error) {
      console.error(`Error in reasoning iteration ${iteration + 1}:`, error)
      break
    }
    
    iteration++
  }
  
  if (iteration >= maxIterations) {
    messages.push({ 
      type: 'progress', 
      content: 'Reached reasoning limit, providing response...',
      status: 'thinking'
    })
  }
  
  // Return the final message content
  const finalContent = currentMessage?.content?.trim()
  if (finalContent) {
    return finalContent
  }
  
  // Fallback: try to extract useful information from the conversation
  const toolData = conversationHistory
    .filter(msg => msg.role === 'tool')
    .map(msg => {
      try {
        return JSON.parse(msg.content as string)
      } catch {
        return msg.content
      }
    })
  
  if (toolData.length > 0) {
    return `I gathered the requested data through multiple steps. Here's what I found: ${JSON.stringify(toolData, null, 2)}`
  }
  
  return 'I processed your request but encountered an issue generating the final response.'
}
