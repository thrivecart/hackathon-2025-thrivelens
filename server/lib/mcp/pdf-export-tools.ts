import { generateAuditReportPDF, type AuditReportInput } from '../pdf/audit-report-generator'

// PDF Export Tool Definition for OpenAI function calling
export const PDF_EXPORT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'export_audit_pdf',
      description: 'Generate a professional PDF export of a UX audit report (scores, summary, recommendations with priorities, and square screenshots). Call this when the user asks to export an audit, generate a PDF, or download a report.',
      parameters: {
        type: 'object',
        properties: {
          audit: {
            type: 'object',
            description: 'The complete UX audit payload to render into the PDF.',
            properties: {
              metadata: {
                type: 'object',
                properties: {
                  url: { type: 'string', description: 'The URL that was audited' },
                  date: { type: 'string', description: 'ISO date string of when the audit was performed' },
                  deviceType: { type: 'string', enum: ['desktop', 'mobile', 'tablet'], description: 'Device type used for the audit' },
                  pageType: { type: 'string', description: 'Type of page audited (e.g., checkout, landing, product)' }
                },
                required: ['url', 'date', 'deviceType']
              },
              overallScore: { type: 'number', description: 'Overall UX score (0-100)' },
              summary: { type: 'string', description: 'Executive summary of the UX audit' },
              categoryScores: {
                type: 'array',
                description: 'Detailed category scores',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Category name (e.g., Visual Design, Conversion Readiness)' },
                    score: { type: 'number', description: 'Category score (0-100)' }
                  },
                  required: ['name', 'score']
                }
              },
              recommendations: {
                type: 'array',
                description: 'List of UX recommendations with priorities',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Recommendation title' },
                    description: { type: 'string', description: 'Detailed description of the recommendation' },
                    expectedImpact: { type: 'string', description: 'Expected impact on conversions/UX' },
                    priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority level' }
                  },
                  required: ['title', 'description', 'expectedImpact', 'priority']
                }
              },
              screenshots: {
                type: 'array',
                description: 'Array of screenshot URLs to include in the PDF',
                items: {
                  type: 'object',
                  properties: {
                    url: { type: 'string', description: 'Full URL to the screenshot image' },
                    deviceType: { type: 'string', enum: ['desktop', 'mobile', 'tablet'], description: 'Device type for the screenshot' },
                    label: { type: 'string', description: 'Optional label for the screenshot' }
                  },
                  required: ['url', 'deviceType']
                }
              }
            },
            required: ['metadata', 'overallScore', 'summary', 'recommendations']
          }
        },
        required: ['audit']
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
async function exportAuditPdf(args: { audit: AuditReportInput }): Promise<any> {
  try {
    const { audit } = args
    
    if (!audit) {
      return {
        ok: false,
        error: 'Missing audit data. Please provide the complete audit payload.'
      }
    }

    // Validate required fields
    if (!audit.metadata?.url) {
      return {
        ok: false,
        error: 'audit.metadata.url is required'
      }
    }

    if (typeof audit.overallScore !== 'number') {
      return {
        ok: false,
        error: 'audit.overallScore must be a number (0-100)'
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
