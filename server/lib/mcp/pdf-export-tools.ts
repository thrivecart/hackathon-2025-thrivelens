import { generateAuditReportPDF, type AuditReportInput } from '../pdf/audit-report-generator'

// PDF Export Tool Definition for OpenAI function calling
export const PDF_EXPORT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'export_audit_pdf',
      description: 'Generate a professional PDF export of a UX audit report. Automatically extracts audit data from the current conversation session. Can export all devices (desktop + mobile) or a specific device only.',
      parameters: {
        type: 'object',
        properties: {
          deviceFilter: {
            type: 'string',
            enum: ['all', 'desktop', 'mobile', 'tablet'],
            description: 'Which device(s) to include in the PDF. Use "all" for all available devices (default), or specify "desktop", "mobile", or "tablet" for single-device export. Default: all'
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
  console.log(`[PDF_EXPORT] Tool: ${toolName}`)
  switch (toolName) {
    case 'export_audit_pdf':
      return await exportAuditPdf(args)
    default:
      throw new Error(`Unknown PDF export tool: ${toolName}`)
  }
}

// Helper to extract the MOST RECENT audit for a single URL from session assets
function extractLatestAuditFromSessionAssets(conversationHistory: Array<any>, targetUrl?: string, deviceFilter?: string): AuditReportInput | null {
  const audits: Array<any> = []
  let primaryUrl = targetUrl || ''
  const filterDevice = deviceFilter && deviceFilter !== 'all' ? deviceFilter.toLowerCase() : null
  let foundFirstAudit = false
  
  // Collect audits from most recent assistant messages
  // Strategy: Keep collecting until we've checked enough messages to find all devices from the same audit session
  let messagesWithoutAuditCount = 0
  
  for (const message of conversationHistory.slice().reverse()) {
    if (message.role === 'assistant' && message.assets) {
      let foundAuditInThisMessage = false
      
      for (const asset of message.assets) {
        if (asset.uxAnalysis && asset.device) {
          const auditUrl = asset.uxAnalysis.url || asset.url || ''
          const deviceType = asset.device.toLowerCase()
          
          // If targetUrl specified, only include matching audits
          if (targetUrl && auditUrl && !auditUrl.includes(targetUrl)) {
            continue
          }
          
          // If deviceFilter specified, only include matching device
          if (filterDevice && deviceType !== filterDevice) {
            continue
          }
          
          // Set primaryUrl from first matching audit
          if (!primaryUrl && auditUrl) {
            primaryUrl = auditUrl
          }
          
          // Only collect audits for the same URL as the first one found
          if (primaryUrl && auditUrl && auditUrl === primaryUrl) {
            // Check if we already have this device (avoid duplicates)
            const isDuplicate = audits.some(a => a.deviceType.toLowerCase() === deviceType && a.url === auditUrl)
            if (!isDuplicate) {
              audits.push({
                deviceType: asset.device,
                overallScore: asset.uxAnalysis.overallScore || 0,
                summary: asset.uxAnalysis.summary || '',
                categoryScores: asset.uxAnalysis.categoryScores || [],
                strengths: asset.uxAnalysis.strengths || [],
                weaknesses: asset.uxAnalysis.weaknesses || [],
                recommendations: asset.uxAnalysis.recommendations || [],
                url: auditUrl
              })
              foundFirstAudit = true
              foundAuditInThisMessage = true
            }
          } else if (primaryUrl && auditUrl && auditUrl !== primaryUrl) {
            // Found an audit for a different URL - stop collecting
            messagesWithoutAuditCount = 999 // Force break
            break
          }
        }
      }
      
      // Track messages without relevant audits
      if (!foundAuditInThisMessage && foundFirstAudit) {
        messagesWithoutAuditCount++
      } else if (foundAuditInThisMessage) {
        messagesWithoutAuditCount = 0 // Reset counter when we find audits
      }
    } else if (foundFirstAudit) {
      // Non-assistant message after finding audits
      messagesWithoutAuditCount++
    }
    
    // Stop after we've gone through 2 messages without finding relevant audits for the primary URL
    // This ensures we collect all devices from the same audit session
    if (messagesWithoutAuditCount >= 2) {
      break
    }
  }
  
  if (audits.length === 0) {
    return null
  }
  
  // Calculate combined score (average of all device scores)
  const combinedScore = Math.round(
    audits.reduce((sum, a) => sum + a.overallScore, 0) / audits.length
  )
  
  const deviceTypes = audits.map(a => a.deviceType).join(', ')
  const combinedSummary = `Comprehensive UX audit analysis across ${audits.length} device${audits.length > 1 ? 's' : ''} (${deviceTypes}). Average score: ${combinedScore}/100.`
  
  return {
    metadata: {
      url: primaryUrl || 'Unknown',
      date: new Date().toISOString(),
      deviceType: audits.length > 1 ? 'multi-device' : audits[0].deviceType,
      pageType: audits[0].pageType || 'general'
    },
    combinedScore,
    combinedSummary,
    deviceAnalyses: audits
  }
}

// Export audit PDF implementation
async function exportAuditPdf(args: { audit?: AuditReportInput, conversationHistory?: Array<{role: string, content: string}>, deviceFilter?: string }): Promise<any> {
  try {
    let { audit, deviceFilter } = args
    const { conversationHistory } = args
    
    // Log device filter for debugging
    if (deviceFilter) {
      console.log(`[PDF_EXPORT] Device filter requested: ${deviceFilter}`)
    }
    
    // If no audit data provided directly, try to extract from conversation history
    if (!audit && conversationHistory) {
      // First try the [FULL_AUDIT_DATA:] tag format
      for (const message of conversationHistory.slice().reverse()) {
        if (message.role === 'assistant' && message.content.includes('[FULL_AUDIT_DATA:')) {
          const match = message.content.match(/\[FULL_AUDIT_DATA: (.+?)\](?:\s|$)/)
          if (match) {
            try {
              audit = JSON.parse(match[1])
              break
            } catch (e) {
              // Continue searching if JSON parse fails
            }
          }
        }
      }
      
      // If still no audit, try to extract most recent audit from session assets
      if (!audit) {
        console.log('[PDF_EXPORT] Attempting to extract most recent audit data from session assets')
        audit = extractLatestAuditFromSessionAssets(conversationHistory, undefined, deviceFilter)
        if (audit) {
          const deviceList = audit.deviceAnalyses.map(d => d.deviceType).join(', ')
          console.log(`[PDF_EXPORT] Successfully extracted audit data: ${audit.metadata.url} - ${audit.deviceAnalyses.length} device(s): ${deviceList}, ${audit.deviceAnalyses.reduce((sum, d) => sum + d.recommendations.length, 0)} total recommendations`)
        }
      }
    }
    
    if (!audit) {
      return {
        ok: false,
        error: 'Missing audit data. Please run a UX audit first before generating a PDF.'
      }
    }

    // Validate required audit structure
    if (!audit.metadata?.url) {
      return { ok: false, error: 'audit.metadata.url is required' }
    }
    if (typeof audit.combinedScore !== 'number') {
      return { ok: false, error: 'audit.combinedScore must be a number (0-100)' }
    }
    if (!audit.deviceAnalyses || !Array.isArray(audit.deviceAnalyses) || audit.deviceAnalyses.length === 0) {
      return { ok: false, error: 'audit.deviceAnalyses must be a non-empty array' }
    }

    // Validate that this is real audit data, not fabricated
    if (audit.metadata.url.includes('example.com') || 
        audit.metadata.url === 'website-from-audit' ||
        audit.metadata.url === 'Unknown') {
      return {
        ok: false,
        error: 'No recent UX audit data found. Please run a website audit first, then request the PDF export.'
      }
    }

    // Extract real URL from conversation history if needed
    if (audit.metadata.url === 'website-from-audit' && conversationHistory) {
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

    // Generate the PDF
    console.log(`[PDF_EXPORT] Generating PDF for ${audit.metadata.url}`)
    const result = await generateAuditReportPDF(audit)

    console.log(`[PDF_EXPORT] PDF generated successfully: ${result.filename}`)
    
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
