import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import OpenAI from 'openai'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ query: string; history?: Array<{role: string, content: string}> }>(event)
  const query = (body?.query || '').trim()
  const history = body?.history || []
  
  if (!query) {
    return { reply: 'Please ask a question. For example: "What are my products with prices?"' }
  }

  const cfg = useRuntimeConfig()
  const apiKey = cfg.openai?.apiKey as string | undefined
  if (!apiKey) {
    return { reply: 'OpenAI is not configured. Set NUXT_OPENAI_API_KEY in .env.' }
  }

  try {
    const openai = new OpenAI({ apiKey })
    
    // System prompt that explains available MCP tools
    const systemPrompt = [
      'You are Thrivebot: a concise, business-savvy AI assistant for ThriveCart merchants.',
      'You help analyze business data, create coupons, and perform commerce operations.',
      '',
      'CRITICAL BEHAVIOR RULES:',
      '- NEVER say "I will get pricing" or "One moment" - always DO the action immediately',
      '- When user asks for pricing, use get_product_pricing_by_name tool - it does everything in one call',
      '- When user asks for "all products with pricing", use list_products_with_pricing tool',
      '- Do NOT explain what you will do - just DO it and show results',
      '- NEVER leave the user waiting - complete all tool calls before responding',
      '',
      'Available ThriveCart tools:',
      '- Products: list_products, get_product_pricing',
      '- Sales: list_transactions, generate_business_report (for comprehensive analysis)',
      '- Customers: get_customer_by_email',
      '- Marketing: list_affiliates, list_upsells, list_bumps, list_downsells',
      '',
      'Available Stripe tools: create_coupon, list_customers, create_payment_link, etc.',
      '',
      'Always be concise and actionable. When listing products with prices, show: "ProductName ($X.XX)"',
      'For business reports, be comprehensive and include all key insights and recommendations.',
      'User may follow up with questions to get more information, use it as a context if it is relevant',
      'Be smart and use the data to make the best decisions and provide accurate information',
    ].join(' ')

    // Build conversation with history
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...history,  // Include previous conversation
      { role: 'user', content: query }
    ]
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      messages: conversationMessages,
      tools: [
        // Stripe MCP tools (existing functionality)
        {
          type: 'function',
          function: {
            name: 'call_mcp_tool',
            description: 'Call Stripe MCP tools for payment operations, coupons, customers, subscriptions, invoices, etc.',
            parameters: {
              type: 'object',
              properties: {
                name: { 
                  type: 'string', 
                  description: 'Name of the Stripe MCP tool (e.g., create_coupon, list_customers, create_payment_link)' 
                },
                input: { 
                  type: 'string', 
                  description: 'JSON input for the tool matching the tool\'s input schema' 
                }
              },
              required: ['name', 'input']
            }
          }
        },
        
        // === PRODUCT TOOLS ===
        {
          type: 'function',
          function: {
            name: 'list_products',
            description: 'List all ThriveCart products with basic information (ID, name, status)',
            parameters: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['live', 'test'],
                  description: 'Filter by product status'
                }
              }
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'list_products_with_pricing',
            description: 'List all products WITH their pricing information automatically fetched',
            parameters: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['live', 'test'],
                  description: 'Filter by product status'
                }
              }
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_product',
            description: 'Get detailed information about a specific product',
            parameters: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Product ID' }
              },
              required: ['id']
            }
          }
        },
        {
          type: 'function', 
          function: {
            name: 'get_product_pricing',
            description: 'Get detailed pricing options for a specific product using numeric ID',
            parameters: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Numeric product ID (like 20, 19, 18)' }
              },
              required: ['id']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_product_pricing_by_name',
            description: 'Get pricing for a product by its display name (like TC-5474). This automatically finds the ID and gets pricing.',
            parameters: {
              type: 'object',
              properties: {
                product_name: { 
                  type: 'string', 
                  description: 'Product display name (like "TC-5474", "TC-4759", etc.)' 
                }
              },
              required: ['product_name']
            }
          }
        },
        
        // === TRANSACTION/SALES TOOLS ===
        {
          type: 'function',
          function: {
            name: 'list_transactions',
            description: 'List transactions for revenue analysis, sales data, and order history',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query for transactions' },
                transactionType: {
                  type: 'string',
                  enum: ['any', 'charge', 'rebill', 'refund', 'cancel'],
                  description: 'Filter by transaction type'
                },
                perPage: { type: 'integer', minimum: 1, maximum: 100, description: 'Results per page' },
                page: { type: 'integer', minimum: 1, description: 'Page number' }
              }
            }
          }
        },
        
        // === CUSTOMER TOOLS ===
        {
          type: 'function',
          function: {
            name: 'get_customer_by_email',
            description: 'Look up customer information by email address',
            parameters: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email', description: 'Customer email address' }
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
            description: 'List affiliates with pagination support',
            parameters: {
              type: 'object',
              properties: {
                product_id: { type: 'integer', description: 'Filter by product ID' },
                query: { type: 'string', description: 'Search query for affiliates' },
                perPage: { type: 'integer', minimum: 1, maximum: 100, description: 'Results per page' },
                page: { type: 'integer', minimum: 1, description: 'Page number' }
              }
            }
          }
        },
        
        // === FUNNEL TOOLS (Upsells, Bumps, Downsells) ===
        {
          type: 'function',
          function: {
            name: 'list_upsells',
            description: 'List all upsell offers in your funnels',
            parameters: {
              type: 'object',
              properties: {}
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_upsell_pricing',
            description: 'Get pricing information for a specific upsell offer',
            parameters: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Upsell ID' }
              },
              required: ['id']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'list_bumps',
            description: 'List all order bump offers',
            parameters: {
              type: 'object',
              properties: {}
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_bump_pricing',
            description: 'Get pricing information for a specific order bump',
            parameters: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Order bump ID' }
              },
              required: ['id']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'list_downsells',
            description: 'List all downsell offers in your funnels',
            parameters: {
              type: 'object',
              properties: {}
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_downsell_pricing',
            description: 'Get pricing information for a specific downsell offer',
            parameters: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Downsell ID' }
              },
              required: ['id']
            }
          }
        },
        
        // === BUSINESS REPORT TOOLS ===
        {
          type: 'function',
          function: {
            name: 'generate_business_report',
            description: 'Generate comprehensive business reports with insights, trends, and recommendations based on transaction data',
            parameters: {
              type: 'object',
              properties: {
                months: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 12,
                  description: 'Number of months to analyze (default: 3)'
                },
                include_recommendations: {
                  type: 'boolean',
                  description: 'Include actionable recommendations (default: true)'
                }
              }
            }
          }
        }
      ]
    })

    const message = response.choices[0]?.message
    if (!message) {
      return { reply: 'I encountered an issue processing your request.' }
    }


    // IMPORTANT: pass the same tools array you used in the first call
    const tools = response._requestBody?.tools || []  // or keep a local const tools = [ ...schemas... ] and reuse it

    const finalReply = await runReasoningLoop(
      openai,
      systemPrompt,
      history,
      query,
      message,
      [],
      tools,
      6
    )

    return { reply: finalReply }


    // Handle tool calls if the AI decided to make them
    // if (message.tool_calls && message.tool_calls.length > 0) {
    //   console.log(`Processing ${message.tool_calls.length} tool calls...`)
    //   const toolResults = []
    //
    //   for (const toolCall of message.tool_calls) {
    //     const { name, arguments: args } = toolCall.function
    //     console.log(`Calling tool: ${name} with args:`, args)
    //
    //     try {
    //       let result
    //
    //       if (name === 'call_mcp_tool') {
    //         // Handle Stripe MCP calls (existing functionality)
    //         const { name: mcpName, input } = JSON.parse(args)
    //
    //         // For now, return a placeholder for Stripe MCP calls
    //         result = {
    //           status: 'Stripe MCP integration needed',
    //           tool: mcpName,
    //           input: input
    //         }
    //
    //       } else {
    //         // Handle ThriveCart MCP calls via our implementation
    //         console.log(`Calling ThriveCart tool: ${name}`)
    //         result = await callThriveCartMCP(name, JSON.parse(args))
    //         console.log(`Tool ${name} result:`, result ? 'Success' : 'No result')
    //       }
    //
    //       toolResults.push({
    //         tool_call_id: toolCall.id,
    //         role: 'tool' as const,
    //         content: JSON.stringify(result, null, 2)
    //       })
    //
    //     } catch (error) {
    //       console.error(`Tool call error for ${name}:`, error)
    //       toolResults.push({
    //         tool_call_id: toolCall.id,
    //         role: 'tool' as const,
    //         content: JSON.stringify({
    //           error: error.message,
    //           tool: name,
    //           status: 'failed'
    //         })
    //       })
    //     }
    //   }
    //
    //   // Get final response with tool results
    //   console.log('Getting final response from OpenAI with tool results...')
    //
    //   try {
    //     console.log('Starting reasoning loop for multi-step thinking...')
    //     try {
    //       const finalReply = await Promise.race([
    //         runReasoningLoop(openai, systemPrompt, history, query, message, toolResults),
    //         new Promise((_, reject) =>
    //           setTimeout(() => reject(new Error('Reasoning loop timeout')), 60000)
    //         )
    //       ])
    //       return { reply: finalReply }
    //     } catch (timeoutError) {
    //       console.error('Reasoning loop failed:', timeoutError.message)
    //       return {
    //         reply: 'I retrieved your data but encountered an issue finishing the reasoning process.'
    //       }
    //     }
    //
    //   } catch (timeoutError) {
    //     console.error('Final OpenAI call failed:', timeoutError.message)
    //
    //     // If OpenAI times out, generate a simple response from tool results
    //     const summaryData = toolResults.map(tr => {
    //       try {
    //         return JSON.parse(tr.content)
    //       } catch {
    //         return tr.content
    //       }
    //     })
    //
    //     return {
    //       reply: `I retrieved your data but had trouble formatting the response. Here's what I found: ${JSON.stringify(summaryData, null, 2)}`
    //     }
    //   }
    // }
    // If no tool calls, return the direct response
    return { reply: message.content?.trim() || 'I need more information to help you.' }

  } catch (error) {
    console.error('Chat error:', error)
    return { 
      reply: 'Based on available data… I encountered an issue processing your request. Please try again.' 
    }
  }
})

// Helper function to call our ThriveCart MCP server
async function callThriveCartMCP(toolName: string, args: any): Promise<any> {
  // Import the ThriveCart client functions directly instead of spawning the MCP server
  const { 
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
  } = await import('../lib/thrivecart')
  
  // Helper to clean query parameters
  function cleanQuery(params: any) {
    const cleaned: any = {}
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && value !== '') {
        cleaned[key] = value
      }
    }
    return cleaned
  }
  
  try {
    let result
    
    switch (toolName) {
      case 'list_products':
        result = await getProducts({ status: args.status || 'live' })
        break
        
      case 'get_product':
        result = await getProduct(args.id)
        break
        
      case 'get_product_pricing':
        result = await getProductPricing(args.id)
        break
        
      case 'list_transactions':
        result = await listTransactions(cleanQuery(args))
        break
        
      case 'get_customer_by_email':
        result = await getCustomerByEmail(args.email)
        break
        
      case 'list_affiliates':
        result = await listAffiliates(cleanQuery(args))
        break
        
      case 'list_upsells':
        result = await getUpsells({})
        break
        
      case 'get_upsell_pricing':
        result = await getUpsellPricing(args.id)
        break
        
      case 'list_bumps':
        result = await getBumps({})
        break
        
      case 'get_bump_pricing':
        result = await getBumpPricing(args.id)
        break
        
      case 'list_downsells':
        result = await getDownsells({})
        break
        
      case 'get_downsell_pricing':
        result = await getDownsellPricing(args.id)
        break
        
      default:
        throw new Error(`Unknown ThriveCart tool: ${toolName}`)
    }
    
    return result
    
  } catch (error) {
    console.error(`ThriveCart MCP call failed for ${toolName}:`, error)
    throw new Error(`ThriveCart API call failed: ${error.message}`)
  }
}

async function runReasoningLoop(
  openai,
  systemPrompt,
  history,
  query,
  initialMessage,
  initialToolResults = [],
  tools = [],
  maxDepth = 6
) {
  // Base conversation
  const conversation = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: query }
  ]

  // Track pending calls & results
  let msg = initialMessage
  let toolResults = initialToolResults

  // If the first model message had tool calls, execute them before first reflect
  if (msg?.tool_calls?.length) {
    const executed = await executeToolCalls(msg.tool_calls)
    toolResults = executed
    conversation.push(msg, ...toolResults)
  } else if (msg) {
    conversation.push(msg)
  }

  for (let depth = 0; depth < maxDepth; depth++) {
    // Ask the model again, always passing tools so it can call them
    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      messages: conversation,
      tools
    })

    msg = res.choices[0]?.message
    if (!msg) return 'No response from OpenAI.'

    // If model wants to call more tools, execute and continue
    if (msg.tool_calls?.length) {
      const executed = await executeToolCalls(msg.tool_calls)
      conversation.push(msg, ...executed)
      continue
    }

    // No more tool calls → done
    if (msg.content) conversation.push(msg)
    return msg.content?.trim() || 'No final content returned.'
  }

  return 'I reached my reasoning limit before producing a final result.'
}

// helper to execute tool calls (reuses your callThriveCartMCP)
async function executeToolCalls(toolCalls) {
  const outputs = []
  for (const call of toolCalls) {
    try {
      const args = JSON.parse(call.function.arguments || '{}')
      const result =
        call.function.name === 'call_mcp_tool'
          ? { status: 'Stripe MCP integration needed', tool: args.name, input: args.input }
          : await callThriveCartMCP(call.function.name, args)

      outputs.push({
        tool_call_id: call.id,
        role: 'tool',
        content: JSON.stringify(result, null, 2)
      })
    } catch (err) {
      outputs.push({
        tool_call_id: call.id,
        role: 'tool',
        content: JSON.stringify({ error: (err as Error).message })
      })
    }
  }
  return outputs
}


