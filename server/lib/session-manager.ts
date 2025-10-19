import { mkdir, appendFile, readFile, access } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

// Session directory (relative to project root)
const SESSIONS_DIR = join(process.cwd(), 'server', 'sessions')

// UUID v4 validation regex
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface MessageAsset {
  // Screenshot details
  screenshotUrl?: string
  screenshotPath?: string
  
  // UX Analysis (complete object for UI recreation)
  uxAnalysis?: {
    overallScore?: number | null
    score?: number | null
    device?: string | null
    pageType?: string | null
    summary?: string
    categoryScores?: Record<string, number>
    strengths?: string[]
    weaknesses?: string[]
    recommendations?: Array<{
      title: string
      description: string
      priority: string
      expectedImpact?: string
      impact?: string
      resources?: string[]
      links?: string[]
    }>
  } | null
  
  // PDF export details
  pdfUrl?: string
  pdfFilename?: string
  
  // User-uploaded image
  userImagePath?: string
  userImageData?: string // Base64 data (optional, for recreation)
  
  // Metadata for context
  url?: string
  device?: string
  viewport?: { width: number; height: number }
  pageType?: string
}

export interface SessionMessage {
  id: string // Unique message ID for ordering
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  assets?: MessageAsset[]
}

export interface SessionAssets {
  screenshots: Array<{
    path: string
    url?: string
    device?: string
    timestamp: string
    messageId: string
  }>
  analyses: Array<{
    analysis: any
    screenshotPath?: string
    timestamp: string
    messageId: string
  }>
  pdfs: Array<{
    url: string
    filename?: string
    timestamp: string
    messageId: string
  }>
  userImages: Array<{
    path: string
    timestamp: string
    messageId: string
  }>
}

/**
 * Ensure the sessions directory exists
 */
async function ensureSessionsDirectory(): Promise<void> {
  try {
    await mkdir(SESSIONS_DIR, { recursive: true })
  } catch (error: any) {
    console.error('Failed to create sessions directory:', error.message)
    throw new Error('Session directory initialization failed')
  }
}

/**
 * Validate sessionId format (UUID v4)
 */
export function isValidSessionId(sessionId: string): boolean {
  return typeof sessionId === 'string' && UUID_V4_REGEX.test(sessionId)
}

/**
 * Get the file path for a session
 */
function getSessionFilePath(sessionId: string): string {
  if (!isValidSessionId(sessionId)) {
    throw new Error('Invalid sessionId format')
  }
  return join(SESSIONS_DIR, `${sessionId}.jsonl`)
}

/**
 * Create a new session and return the sessionId
 */
export async function createSession(): Promise<string> {
  await ensureSessionsDirectory()
  
  const sessionId = randomUUID()
  const filePath = getSessionFilePath(sessionId)
  
  try {
    // Touch the file to create it (write empty string)
    await appendFile(filePath, '')
    console.log(`[Session] Created new session: ${sessionId}`)
    return sessionId
  } catch (error: any) {
    console.error('Failed to create session file:', error.message)
    throw new Error('Session creation failed')
  }
}

/**
 * Check if a session exists
 */
export async function sessionExists(sessionId: string): Promise<boolean> {
  if (!isValidSessionId(sessionId)) {
    return false
  }
  
  try {
    const filePath = getSessionFilePath(sessionId)
    await access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Append a message to the session file
 * Assets array format matches the frontend MessageAsset interface for easy recreation
 */
export async function appendMessage(
  sessionId: string,
  message: Omit<SessionMessage, 'id' | 'timestamp'>
): Promise<void> {
  if (!isValidSessionId(sessionId)) {
    throw new Error('Invalid sessionId format')
  }
  
  // Validate message structure
  if (!message.role || !['user', 'assistant'].includes(message.role)) {
    throw new Error('Invalid message role')
  }
  
  if (typeof message.content !== 'string') {
    throw new Error('Message content must be a string')
  }
  
  await ensureSessionsDirectory()
  const filePath = getSessionFilePath(sessionId)
  
  try {
    // Enrich message with ID and timestamp
    const enrichedMessage: SessionMessage = {
      id: randomUUID(),
      role: message.role,
      content: message.content,
      timestamp: new Date().toISOString(),
      assets: message.assets || []
    }
    
    // Append as JSONL (one line per message)
    const line = JSON.stringify(enrichedMessage) + '\n'
    await appendFile(filePath, line, 'utf-8')
    console.log(`[Session] Appended ${message.role} message to ${sessionId} (id: ${enrichedMessage.id})`)
  } catch (error: any) {
    console.error('Failed to append message to session:', error.message)
    throw new Error('Failed to write to session file')
  }
}

/**
 * Read the full session history
 * Returns messages in chronological order with all assets for UI recreation
 */
export async function readSessionHistory(sessionId: string): Promise<SessionMessage[]> {
  if (!isValidSessionId(sessionId)) {
    console.warn(`[Session] Invalid sessionId format: ${sessionId}`)
    return []
  }
  
  const filePath = getSessionFilePath(sessionId)
  
  try {
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n').filter(line => line.trim())
    
    const messages: SessionMessage[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      try {
        const message = JSON.parse(line) as SessionMessage
        
        // Validate structure
        if (message.role && message.content && message.id) {
          messages.push(message)
        } else {
          console.warn(`[Session] Skipping malformed message at line ${i + 1}`)
        }
      } catch (parseError) {
        console.warn(`[Session] Failed to parse line ${i + 1}, skipping`)
      }
    }
    
    console.log(`[Session] Read ${messages.length} messages from ${sessionId}`)
    return messages
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(`[Session] Session file not found: ${sessionId}, returning empty history`)
      return []
    }
    
    console.error('Failed to read session history:', error.message)
    return []
  }
}

/**
 * Aggregate all assets from a session
 * Useful for finding existing screenshots/analyses without full message parsing
 */
export async function getSessionAssets(sessionId: string): Promise<SessionAssets> {
  const history = await readSessionHistory(sessionId)
  
  const assets: SessionAssets = {
    screenshots: [],
    analyses: [],
    pdfs: [],
    userImages: []
  }
  
  for (const message of history) {
    if (!message.assets || message.assets.length === 0) continue
    
    const timestamp = message.timestamp
    const messageId = message.id
    
    for (const asset of message.assets) {
      // Collect screenshots
      if (asset.screenshotPath || asset.screenshotUrl) {
        assets.screenshots.push({
          path: asset.screenshotPath || asset.screenshotUrl || '',
          url: asset.url,
          device: asset.device,
          timestamp,
          messageId
        })
      }
      
      // Collect UX analyses
      if (asset.uxAnalysis) {
        assets.analyses.push({
          analysis: asset.uxAnalysis,
          screenshotPath: asset.screenshotPath,
          timestamp,
          messageId
        })
      }
      
      // Collect PDFs
      if (asset.pdfUrl) {
        assets.pdfs.push({
          url: asset.pdfUrl,
          filename: asset.pdfFilename,
          timestamp,
          messageId
        })
      }
      
      // Collect user-uploaded images
      if (asset.userImagePath) {
        assets.userImages.push({
          path: asset.userImagePath,
          timestamp,
          messageId
        })
      }
    }
  }
  
  console.log(`[Session] Assets summary for ${sessionId}:`, {
    screenshots: assets.screenshots.length,
    analyses: assets.analyses.length,
    pdfs: assets.pdfs.length,
    userImages: assets.userImages.length
  })
  
  return assets
}

/**
 * Convert session history to OpenAI message format
 * Enriches assistant messages with asset context for AI awareness
 * Uses lightweight references with messageId for lazy loading full audit data
 */
export function convertToOpenAIMessages(
  history: SessionMessage[]
): Array<{ role: string; content: string }> {
  return history.map(msg => {
    let content = msg.content
    
    // Enrich assistant messages with asset references for AI context
    if (msg.role === 'assistant' && msg.assets && msg.assets.length > 0) {
      const assetRefs: string[] = []
      let hasAuditData = false
      
      for (const asset of msg.assets) {
        if (asset.screenshotPath) {
          const device = asset.device || 'desktop'
          const url = asset.url || 'website'
          assetRefs.push(`[SCREENSHOT: ${asset.screenshotPath} - ${device} view of ${url}]`)
        }
        
        if (asset.uxAnalysis) {
          const score = asset.uxAnalysis.overallScore || asset.uxAnalysis.score
          const device = asset.uxAnalysis.device || 'page'
          const url = asset.url || 'website'
          assetRefs.push(`[UX_ANALYSIS: ${device} scored ${score}/100 for ${url}]`)
          hasAuditData = true
        }
        
        if (asset.pdfUrl) {
          assetRefs.push(`[PDF_REPORT: ${asset.pdfUrl}]`)
        }
        
        if (asset.userImagePath) {
          assetRefs.push(`[USER_IMAGE: ${asset.userImagePath}]`)
        }
      }
      
      // Add audit availability tag with messageId for retrieval
      if (hasAuditData) {
        assetRefs.push(`[AUDIT_AVAILABLE: messageId=${msg.id}]`)
      }
      
      if (assetRefs.length > 0) {
        content = `${assetRefs.join(' ')} ${content}`
      }
    }
    
    return {
      role: msg.role,
      content
    }
  })
}

/**
 * Find the most recent screenshot for a given URL in the session
 * Useful for AI to determine if recapture is needed
 */
export async function findRecentScreenshot(
  sessionId: string,
  url: string,
  device: string = 'desktop'
): Promise<{ screenshotPath: string; timestamp: string; messageId: string } | null> {
  const assets = await getSessionAssets(sessionId)
  
  // Filter screenshots matching URL and device
  const matching = assets.screenshots.filter(
    ss => ss.url === url && ss.device === device
  )
  
  if (matching.length === 0) {
    return null
  }
  
  // Return the most recent one
  const sorted = matching.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  
  return {
    screenshotPath: sorted[0].path,
    timestamp: sorted[0].timestamp,
    messageId: sorted[0].messageId
  }
}
