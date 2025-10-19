// ThriveCart MCP Tool Handlers

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
} from '../thrivecart'

// Helper function to clean query parameters
function cleanQuery(params: any) {
  const cleaned: any = {}
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value
    }
  }
  return cleaned
}

// ThriveCart tool call handler
export async function callThriveCartTool(toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case 'list_products':
      return await getProducts({ status: args.status || 'live' })
      
    case 'get_product':
      return await getProduct(args.id, { mode: args.mode })
      
    case 'get_product_pricing_by_name':
      // Find product by name first, then get pricing
      const productsForName = await getProducts({ status: 'live' })
      const productArray = productsForName?.data || productsForName?.items || productsForName?.results || productsForName
      
      if (Array.isArray(productArray)) {
        const searchName = args.product_name.toLowerCase()
        let foundProduct = null
        
        for (const product of productArray) {
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
      
    case 'get_upsell_pricing':
      return await getUpsellPricing(args.id, { mode: args.mode })
      
    case 'list_bumps':
      return await getBumps({})
      
    case 'get_bump_pricing':
      return await getBumpPricing(args.id, { mode: args.mode })
      
    case 'list_downsells':
      return await getDownsells({})
      
    case 'get_downsell_pricing':
      return await getDownsellPricing(args.id, { mode: args.mode })
      
    default:
      throw new Error(`Unknown ThriveCart tool: ${toolName}`)
  }
}

// ThriveCart tool definitions (all available tools)
const THRIVECART_ALL_TOOLS = [
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
      name: 'get_product',
      description: 'Get detailed information for a specific product by ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The product ID' },
          mode: { type: 'string', enum: ['live', 'test'], description: 'Optional mode override' }
        },
        required: ['id']
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
  },
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
      name: 'get_upsell_pricing',
      description: 'Get pricing options for a specific upsell by ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The upsell ID' },
          mode: { type: 'string', enum: ['live', 'test'], description: 'Optional mode override' }
        },
        required: ['id']
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
      name: 'get_bump_pricing',
      description: 'Get pricing options for a specific order bump by ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The bump ID' },
          mode: { type: 'string', enum: ['live', 'test'], description: 'Optional mode override' }
        },
        required: ['id']
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
  },
  {
    type: 'function',
    function: {
      name: 'get_downsell_pricing',
      description: 'Get pricing options for a specific downsell by ID',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The downsell ID' },
          mode: { type: 'string', enum: ['live', 'test'], description: 'Optional mode override' }
        },
        required: ['id']
      }
    }
  }
]

// ThriveCart tool names for routing
export const THRIVECART_TOOL_NAMES = [
  'list_products',
  'get_product',
  'get_product_pricing_by_name', 
  'list_transactions',
  'get_customer_by_email',
  'list_affiliates',
  'list_upsells',
  'get_upsell_pricing',
  'list_bumps',
  'get_bump_pricing',
  'list_downsells',
  'get_downsell_pricing'
]

// Exposed ThriveCart tools (subset for AI context)
// All tools above remain functional via routing, but only these are exposed to the AI
const EXPOSED_TOOL_NAMES = [
  'list_products',
  'get_product',
  'get_product_pricing_by_name',
  'list_transactions',
  'list_upsells',
  'get_upsell_pricing',
  'list_downsells',
  'get_downsell_pricing'
]

export const THRIVECART_TOOLS = THRIVECART_ALL_TOOLS.filter(
  tool => EXPOSED_TOOL_NAMES.includes(tool.function.name)
)
