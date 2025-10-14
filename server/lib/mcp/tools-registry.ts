// Central MCP Tools Registry - Manages all tool routing and definitions

import { callThriveCartTool, THRIVECART_TOOLS, THRIVECART_TOOL_NAMES } from './thrivecart-tools'
import { callUXAuditTool, UX_AUDIT_TOOLS, UX_AUDIT_TOOL_NAMES } from './ux-audit-tools'
// Import other MCP tool handlers here as needed:
// import { callStripeTool, STRIPE_TOOLS, STRIPE_TOOL_NAMES } from './stripe-tools'
// import { callSlackTool, SLACK_TOOLS, SLACK_TOOL_NAMES } from './slack-tools'

// Combine all tool definitions from different services
export const ALL_TOOL_DEFINITIONS = [
  ...THRIVECART_TOOLS,
  ...UX_AUDIT_TOOLS,
  // ...STRIPE_TOOLS,      // Add when Stripe tools are created
  // ...SLACK_TOOLS,       // Add when Slack tools are created
]

// Central tool router - determines which MCP handler to use
export async function routeToolCall(toolName: string, args: any): Promise<any> {
  // Route to ThriveCart tools
  if (THRIVECART_TOOL_NAMES.includes(toolName)) {
    return await callThriveCartTool(toolName, args)
  }
  
  // Route to UX Audit tools
  if (UX_AUDIT_TOOL_NAMES.includes(toolName)) {
    return await callUXAuditTool(toolName, args)
  }
  
  // Route to Stripe tools (when implemented)
  // if (STRIPE_TOOL_NAMES.includes(toolName)) {
  //   return await callStripeTool(toolName, args)
  // }
  
  // Route to Slack tools (when implemented)  
  // if (SLACK_TOOL_NAMES.includes(toolName)) {
  //   return await callSlackTool(toolName, args)
  // }
  
  throw new Error(`Unknown tool: ${toolName}`)
}

// Get tools for specific services (useful for context-specific prompts)
export function getToolsForService(serviceName: 'thrivecart' | 'ux-audit' | 'stripe' | 'slack' | 'all' = 'all') {
  switch (serviceName) {
    case 'thrivecart':
      return THRIVECART_TOOLS
    case 'ux-audit':
      return UX_AUDIT_TOOLS
    // case 'stripe':
    //   return STRIPE_TOOLS
    // case 'slack':
    //   return SLACK_TOOLS
    case 'all':
    default:
      return ALL_TOOL_DEFINITIONS
  }
}

// Get available tool names (useful for validation)
export function getAvailableToolNames(): string[] {
  return [
    ...THRIVECART_TOOL_NAMES,
    ...UX_AUDIT_TOOL_NAMES,
    // ...STRIPE_TOOL_NAMES,    // Add when implemented
    // ...SLACK_TOOL_NAMES,     // Add when implemented
  ]
}

// Check if a tool exists
export function isValidTool(toolName: string): boolean {
  return getAvailableToolNames().includes(toolName)
}