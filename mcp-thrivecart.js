#!/usr/bin/env node

/**
 * ThriveCart MCP Server
 * 
 * Exposes ThriveCart API endpoints as MCP tools so AI can intelligently
 * decide which API calls to make based on the context and user queries.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ofetch } from 'ofetch';
import { config } from 'dotenv';

// Load environment variables
config();

// ThriveCart API client setup
function createThriveCartClient() {
  const apiKey = process.env.NUXT_THRIVECART_API_KEY;
  const baseUrl = process.env.NUXT_THRIVECART_BASE_URL || 'https://thrivecart.com';
  const mode = process.env.NUXT_THRIVECART_MODE || 'live';
  
  if (!apiKey) {
    throw new Error('NUXT_THRIVECART_API_KEY is required');
  }
  
  return ofetch.create({
    baseURL: baseUrl + '/api/external',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-TC-Mode': mode,
      'X-TC-Sdk': 'mcp-server/1.0',
      'X-TC-Version': '1.0.0'
    }
  });
}

// Helper to clean query parameters
function cleanQuery(params) {
  const cleaned = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// MCP Server setup
const server = new Server(
  {
    name: 'thrivecart-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define all ThriveCart API tools
const TOOLS = [
  // Products
  {
    name: 'list_products',
    description: 'List all products in ThriveCart. Returns product IDs, names, and basic info.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['live', 'test'],
          description: 'Filter by product status'
        }
      }
    }
  },
  {
    name: 'get_product',
    description: 'Get detailed information about a specific product.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The product ID'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'get_product_pricing',
    description: 'Get pricing options for a specific product.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The product ID'
        }
      },
      required: ['id']
    }
  },
  
  // Transactions
  {
    name: 'list_transactions',
    description: 'List transactions (orders/sales). Useful for revenue analysis and sales data.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for transactions'
        },
        transactionType: {
          type: 'string',
          enum: ['any', 'charge', 'rebill', 'refund', 'cancel'],
          description: 'Filter by transaction type'
        },
        perPage: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Number of results per page'
        },
        page: {
          type: 'integer',
          minimum: 1,
          description: 'Page number'
        }
      }
    }
  },
  
  // Customers
  {
    name: 'get_customer_by_email',
    description: 'Look up customer information by email address.',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
          description: 'Customer email address'
        }
      },
      required: ['email']
    }
  },
  
  // Affiliates
  {
    name: 'list_affiliates',
    description: 'List affiliates with pagination support.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'integer',
          description: 'Filter by product ID'
        },
        query: {
          type: 'string',
          description: 'Search query for affiliates'
        },
        perPage: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Number of results per page'
        },
        page: {
          type: 'integer',
          minimum: 1,
          description: 'Page number'
        }
      }
    }
  },
  
  // Upsells, Bumps, Downsells
  {
    name: 'list_upsells',
    description: 'List all upsell offers.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_upsell_pricing',
    description: 'Get pricing for a specific upsell.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The upsell ID'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'list_bumps',
    description: 'List all order bumps.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_bump_pricing',
    description: 'Get pricing for a specific order bump.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The bump ID'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'list_downsells',
    description: 'List all downsell offers.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_downsell_pricing',
    description: 'Get pricing for a specific downsell.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The downsell ID'
        }
      },
      required: ['id']
    }
  }
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS
  };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const client = createThriveCartClient();
  
  try {
    let result;
    
    switch (name) {
      case 'list_products':
        result = await client('/products', { 
          query: cleanQuery(args || {}) 
        });
        break;
        
      case 'get_product':
        result = await client(`/products/${args.id}`);
        break;
        
      case 'get_product_pricing':
        result = await client(`/products/${args.id}/pricing_options`);
        break;
        
      case 'list_transactions':
        result = await client('/transactions', { 
          query: cleanQuery(args || {}) 
        });
        break;
        
      case 'get_customer_by_email':
        result = await client('/customer', { 
          method: 'POST', 
          body: { email: args.email } 
        });
        break;
        
      case 'list_affiliates':
        result = await client('/affiliates', { 
          query: cleanQuery(args || {}) 
        });
        break;
        
      case 'list_upsells':
        result = await client('/upsells');
        break;
        
      case 'get_upsell_pricing':
        result = await client(`/upsells/${args.id}/pricing_options`);
        break;
        
      case 'list_bumps':
        result = await client('/bumps');
        break;
        
      case 'get_bump_pricing':
        result = await client(`/bumps/${args.id}/pricing_options`);
        break;
        
      case 'list_downsells':
        result = await client('/downsells');
        break;
        
      case 'get_downsell_pricing':
        result = await client(`/downsells/${args.id}/pricing_options`);
        break;
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
    
  } catch (error) {
    return {
      content: [
        {
          type: 'text', 
          text: JSON.stringify({
            error: error.message,
            status: error.status || error.statusCode,
            tool: name,
            arguments: args
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ThriveCart MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});