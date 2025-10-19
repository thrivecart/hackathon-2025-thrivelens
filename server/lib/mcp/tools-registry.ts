// Central MCP Tools Registry - Manages all tool routing and definitions

import { callUXAuditTool, UX_AUDIT_TOOLS, UX_AUDIT_TOOL_NAMES } from './ux-audit-tools'
import { callPDFExportTool, PDF_EXPORT_TOOLS, PDF_EXPORT_TOOL_NAMES } from './pdf-export-tools'
import { callSessionRetrievalTool, SESSION_RETRIEVAL_TOOLS, SESSION_RETRIEVAL_TOOL_NAMES } from './session-retrieval-tools'
import { callVisualQATool, VISUAL_QA_TOOLS, VISUAL_QA_TOOL_NAMES } from './visual-qa-tools'
// Import other MCP tool handlers here as needed:
// import { callStripeTool, STRIPE_TOOLS, STRIPE_TOOL_NAMES } from './stripe-tools'
// import { callSlackTool, SLACK_TOOLS, SLACK_TOOL_NAMES } from './slack-tools'

// Combine all tool definitions from different services
export const ALL_TOOL_DEFINITIONS = [
  ...UX_AUDIT_TOOLS,
  ...PDF_EXPORT_TOOLS,
  ...SESSION_RETRIEVAL_TOOLS,
  ...VISUAL_QA_TOOLS,
  // ...STRIPE_TOOLS,      // Add when Stripe tools are created
  // ...SLACK_TOOLS,       // Add when Slack tools are created
]

// Central tool router - determines which MCP handler to use
// sessionId is injected by the reasoning loop for session-aware tools
export async function routeToolCall(toolName: string, args: any, sessionId?: string): Promise<any> {
  console.log(`[TOOL] Calling: ${toolName}`, args)
  
  // Route to UX Audit tools
  if (UX_AUDIT_TOOL_NAMES.includes(toolName)) {
    return await callUXAuditTool(toolName, args)
  }
  
  // Route to PDF Export tools
  if (PDF_EXPORT_TOOL_NAMES.includes(toolName)) {
    return await callPDFExportTool(toolName, args)
  }
  
  // Route to Session Retrieval tools
  if (SESSION_RETRIEVAL_TOOL_NAMES.includes(toolName)) {
    if (!sessionId) {
      throw new Error('Session retrieval tools require sessionId')
    }
    return await callSessionRetrievalTool(toolName, args, sessionId)
  }
  
  // Route to Visual Q&A tools
  if (VISUAL_QA_TOOL_NAMES.includes(toolName)) {
    if (!sessionId) {
      throw new Error('Visual Q&A tools require sessionId')
    }
    return await callVisualQATool(toolName, args, sessionId)
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
export function getToolsForService(serviceName: 'ux-audit' | 'stripe' | 'slack' | 'all' = 'all') {
  switch (serviceName) {
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
    ...UX_AUDIT_TOOL_NAMES,
    ...PDF_EXPORT_TOOL_NAMES,
    ...SESSION_RETRIEVAL_TOOL_NAMES,
    ...VISUAL_QA_TOOL_NAMES,
    // ...STRIPE_TOOL_NAMES,    // Add when implemented
    // ...SLACK_TOOL_NAMES,     // Add when implemented
  ]
}

// Check if a tool exists
export function isValidTool(toolName: string): boolean {
  return getAvailableToolNames().includes(toolName)
}
