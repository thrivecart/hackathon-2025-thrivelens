import { generateAuditReportPDF, type AuditReportInput } from '../pdf/audit-report-generator'

// PDF Export Tool Definition for OpenAI function calling
export const PDF_EXPORT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'export_audit_pdf',
      description: 'Generate a professional PDF export of a UX audit report using data from a previous audit analysis. This tool can be called immediately after a UX audit in the same conversation, or later in the conversation if audit data is available in conversation history. Do NOT fabricate or make up audit data - only use real audit results.',
      parameters: {
        type: 'object',
        properties: {
          audit: {
            type: 'object',
            description: 'The complete UX audit payload to render into the PDF. Optional if audit data is available in conversation history.',
            properties: {
              metadata: {
                type: 'object',
                properties: {
                  url: { type: 'string', description: 'The URL that was audited' },
                  date: { type: 'string', description: 'ISO date string of when the audit was performed' },
                  deviceType: { type: 'string', description: 'Primary device type or "multi-device" if multiple devices analyzed' },
                  pageType: { type: 'string', description: 'Type of page audited (e.g., checkout, landing, product)' }
                },
                required: ['url', 'date', 'deviceType']
              },
              combinedScore: { type: 'number', description: 'Overall UX score across all devices (0-100)' },
              combinedSummary: { type: 'string', description: 'Executive summary covering all device analyses' },
              deviceAnalyses: {
                type: 'array',
                description: 'Array of device-specific analyses',
                items: {
                  type: 'object',
                  properties: {
                    deviceType: { type: 'string', enum: ['desktop', 'mobile', 'tablet'], description: 'Device type' },
                    overallScore: { type: 'number', description: 'UX score for this device (0-100)' },
                    summary: { type: 'string', description: 'Summary for this device' },
                    categoryScores: {
                      type: 'array',
                      description: 'Category scores for this device',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string', description: 'Category name' },
                          score: { type: 'number', description: 'Category score (0-100)' }
                        },
                        required: ['name', 'score']
                      }
                    },
                    strengths: {
                      type: 'array',
                      description: 'Key strengths for this device',
                      items: { type: 'string' }
                    },
                    weaknesses: {
                      type: 'array',
                      description: 'Key weaknesses for this device',
                      items: { type: 'string' }
                    },
                    recommendations: {
                      type: 'array',
                      description: 'UX recommendations for this device',
                      items: {
                        type: 'object',
                        properties: {
                          title: { type: 'string', description: 'Recommendation title' },
                          description: { type: 'string', description: 'Detailed description' },
                          expectedImpact: { type: 'string', description: 'Expected impact on conversions/UX' },
                          priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority level' }
                        },
                        required: ['title', 'description', 'expectedImpact', 'priority']
                      }
                    }
                  },
                  required: ['deviceType', 'overallScore', 'summary', 'recommendations']
                }
              },
            },
            required: ['metadata', 'combinedScore', 'combinedSummary', 'deviceAnalyses']
          }
        },
        required: []
      }
    }
  }
]

export const PDF_EXPORT_TOOL_NAMES = PDF_EXPORT_TOOLS.map(tool => tool.function.name)

// Main tool call handler
export async function callPDFExportTool(toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case 'export_audit_pdf':
      return await exportAuditPdf(args)
    default:
      throw new Error(`Unknown PDF export tool: ${toolName}`)
  }
}

// Export audit PDF implementation
async function exportAuditPdf(args: { audit?: AuditReportInput, conversationHistory?: Array<{role: string, content: string}> }): Promise<any> {
  try {
    let { audit } = args
    const { conversationHistory } = args
    
    // If no audit data provided directly, try to extract from conversation history
    if (!audit && conversationHistory) {
      console.log('[PDF DEBUG] No direct audit data, searching conversation history...')
      for (const message of conversationHistory.slice().reverse()) {
        if (message.role === 'assistant' && message.content.includes('[FULL_AUDIT_DATA:')) {
          const match = message.content.match(/\[FULL_AUDIT_DATA: (.+?)\](?:\s|$)/)
          if (match) {
            try {
              audit = JSON.parse(match[1])
              console.log('[PDF DEBUG] Found audit data in conversation history')
              break
            } catch (e) {
              console.log('[PDF DEBUG] Failed to parse audit data from history:', e)
            }
          }
        }
      }
    }
    
    console.log('[PDF DEBUG] === PDF Export Called ===')
    console.log('[PDF DEBUG] Has audit data:', !!audit)
    
    if (!audit) {
      return {
        ok: false,
        error: 'Missing audit data. Please run a UX audit first before generating a PDF.'
      }
    }
    
    console.log('[PDF DEBUG] Audit structure:')
    console.log('[PDF DEBUG] - URL:', audit.metadata?.url)
    console.log('[PDF DEBUG] - Combined Score:', audit.combinedScore)
    console.log('[PDF DEBUG] - Combined Summary length:', audit.combinedSummary?.length)
    console.log('[PDF DEBUG] - Device Analyses count:', audit.deviceAnalyses?.length)
    
    if (audit.deviceAnalyses) {
      for (let i = 0; i < audit.deviceAnalyses.length; i++) {
        const device = audit.deviceAnalyses[i]
        console.log(`[PDF DEBUG] Device ${i + 1} (${device.deviceType}):`)  
        console.log(`[PDF DEBUG] - Score: ${device.overallScore}`)
        console.log(`[PDF DEBUG] - Summary length: ${device.summary?.length}`)
        console.log(`[PDF DEBUG] - Recommendations count: ${device.recommendations?.length}`)
        console.log(`[PDF DEBUG] - Category scores count: ${device.categoryScores?.length}`)
        console.log(`[PDF DEBUG] - Category scores:`, device.categoryScores)
      }
    }
    
    // Validate required fields for multi-device structure
    if (!audit.metadata?.url) {
      return {
        ok: false,
        error: 'audit.metadata.url is required'
      }
    }

    if (typeof audit.combinedScore !== 'number') {
      return {
        ok: false,
        error: 'audit.combinedScore must be a number (0-100)'
      }
    }

    if (!audit.deviceAnalyses || !Array.isArray(audit.deviceAnalyses) || audit.deviceAnalyses.length === 0) {
      return {
        ok: false,
        error: 'audit.deviceAnalyses must be a non-empty array'
      }
    }

    // Validate that this is real audit data, not AI-generated fake data
    if (audit.metadata.url.includes('example.com') || 
        audit.metadata.url === 'website-from-audit' ||
        audit.combinedSummary?.includes('Generic') || 
        audit.combinedSummary?.length < 50) {
      return {
        ok: false,
        error: 'No recent UX audit data found. Please run a website audit first, then request the PDF export.'
      }
    }
    
    // If audit data came from conversation history, update metadata URL
    if (audit.metadata.url === 'website-from-audit' && conversationHistory) {
      // Try to extract the real URL from conversation history
      for (const message of conversationHistory.slice().reverse()) {
        if (message.role === 'user') {
          const urlMatch = message.content.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/)
          if (urlMatch) {
            audit.metadata.url = urlMatch[0]
            break
          }
        }
      }
    }

    // Validate required fields
    if (!audit.metadata?.url) {
      return {
        ok: false,
        error: 'audit.metadata.url is required'
      }
    }


    // Generate the PDF
    const result = await generateAuditReportPDF(audit)

    return {
      ok: true,
      filename: result.filename,
      url: result.publicUrl,
      message: `📄 Your audit report is ready!`
    }
  } catch (error: any) {
    console.error('PDF export error:', error)
    return {
      ok: false,
      error: error.message || 'Failed to generate PDF report'
    }
  }
}
