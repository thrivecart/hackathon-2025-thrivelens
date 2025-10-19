import { readSessionHistory } from '../session-manager'

// Session Retrieval Tool Definition for OpenAI function calling
export const SESSION_RETRIEVAL_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'retrieve_audit_details',
      description: 'Retrieve complete UX audit details (screenshots, scores, categoryScores, recommendations, strengths, weaknesses) from a previous message in this session. Use this when the user asks follow-up questions about a prior audit (e.g., "what were the recommendations?", "help me rewrite the text", "what was the score?"). ALWAYS call this before answering questions that reference past audit data.',
      parameters: {
        type: 'object',
        properties: {
          messageId: {
            type: 'string',
            description: 'The ID of the assistant message containing the audit data. You can find this in [AUDIT_AVAILABLE: messageId=...] tags in conversation history.'
          },
          url: {
            type: 'string',
            description: 'Optional: The URL that was audited. Use this if messageId is not available - will retrieve the most recent audit for this URL.'
          }
        },
        required: []
      }
    }
  }
]

export const SESSION_RETRIEVAL_TOOL_NAMES = SESSION_RETRIEVAL_TOOLS.map(tool => tool.function.name)

// Main tool call handler
export async function callSessionRetrievalTool(
  toolName: string, 
  args: any,
  sessionId: string
): Promise<any> {
  switch (toolName) {
    case 'retrieve_audit_details':
      return await retrieveAuditDetails(args, sessionId)
    default:
      throw new Error(`Unknown session retrieval tool: ${toolName}`)
  }
}

// Retrieve audit details implementation
async function retrieveAuditDetails(
  args: { messageId?: string; url?: string },
  sessionId: string
): Promise<any> {
  try {
    const { messageId, url } = args
    
    if (!messageId && !url) {
      return {
        success: false,
        error: 'Either messageId or url is required'
      }
    }
    
    // Read session history
    const history = await readSessionHistory(sessionId)
    
    if (history.length === 0) {
      return {
        success: false,
        error: 'No audit data found in session history'
      }
    }
    
    // Find the message with audit data
    let targetMessage = null
    
    if (messageId) {
      // Search by message ID
      targetMessage = history.find(msg => msg.id === messageId && msg.role === 'assistant')
    } else if (url) {
      // Search by URL (most recent)
      for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i]
        if (msg.role === 'assistant' && msg.assets && msg.assets.length > 0) {
          const hasMatchingUrl = msg.assets.some(asset => 
            asset.url && asset.url.toLowerCase().includes(url.toLowerCase())
          )
          if (hasMatchingUrl) {
            targetMessage = msg
            break
          }
        }
      }
    }
    
    if (!targetMessage || !targetMessage.assets || targetMessage.assets.length === 0) {
      return {
        success: false,
        error: 'No audit data found for the specified criteria',
        suggestion: 'Would you like me to run a fresh UX audit? Please provide the URL or upload an image.'
      }
    }
    
    // Extract and structure audit details
    const auditDetails: any = {
      messageId: targetMessage.id,
      timestamp: targetMessage.timestamp,
      devices: []
    }
    
    for (const asset of targetMessage.assets) {
      if (asset.uxAnalysis) {
        const device = asset.device || asset.uxAnalysis.device || 'desktop'
        auditDetails.devices.push({
          deviceType: device,
          url: asset.url,
          screenshotPath: asset.screenshotPath || asset.screenshotUrl,
          overallScore: asset.uxAnalysis.overallScore || asset.uxAnalysis.score,
          categoryScores: asset.uxAnalysis.categoryScores || [],
          summary: asset.uxAnalysis.summary || '',
          strengths: asset.uxAnalysis.strengths || [],
          weaknesses: asset.uxAnalysis.weaknesses || [],
          recommendations: asset.uxAnalysis.recommendations || [],
          pageType: asset.pageType || asset.uxAnalysis.pageType || 'general'
        })
      }
    }
    
    if (auditDetails.devices.length === 0) {
      return {
        success: false,
        error: 'Message found but contains no UX analysis data'
      }
    }
    
    // Calculate combined score if multiple devices
    if (auditDetails.devices.length > 1) {
      auditDetails.combinedScore = Math.round(
        auditDetails.devices.reduce((sum: number, d: any) => sum + (d.overallScore || 0), 0) / 
        auditDetails.devices.length
      )
    }
    
    return {
      success: true,
      audit: auditDetails,
      message: `Retrieved ${auditDetails.devices.length} device audit(s) from ${new Date(targetMessage.timestamp).toLocaleString()}`
    }
    
  } catch (error: any) {
    console.error('Retrieve audit details error:', error)
    return {
      success: false,
      error: error.message || 'Failed to retrieve audit details'
    }
  }
}
