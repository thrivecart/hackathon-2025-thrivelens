import { defineEventHandler } from 'h3'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { getSessionMetadata } from '../lib/session-manager'

const SESSIONS_DIR = join(process.cwd(), 'server', 'sessions')

export default defineEventHandler(async (event) => {
  try {
    // Read all session files
    const files = await readdir(SESSIONS_DIR)
    const sessionFiles = files.filter(f => f.endsWith('.jsonl'))
    
    // Extract metadata for each session
    const sessionsPromises = sessionFiles.map(async (file) => {
      const sessionId = file.replace('.jsonl', '')
      const metadata = await getSessionMetadata(sessionId)
      
      if (!metadata) {
        return null
      }
      
      return {
        sessionId,
        firstUserMessage: metadata.firstUserMessage,
        lastActivity: metadata.lastActivity
      }
    })
    
    const sessionsWithNulls = await Promise.all(sessionsPromises)
    const sessions = sessionsWithNulls.filter(s => s !== null)
    
    // Sort by lastActivity descending (most recent first)
    sessions.sort((a, b) => {
      const dateA = new Date(a!.lastActivity).getTime()
      const dateB = new Date(b!.lastActivity).getTime()
      return dateB - dateA
    })
    
    console.log(`[API] Retrieved ${sessions.length} sessions`)
    
    return { sessions }
  } catch (error: any) {
    // Handle case where sessions directory doesn't exist yet
    if (error.code === 'ENOENT') {
      console.log('[API] Sessions directory not found, returning empty list')
      return { sessions: [] }
    }
    
    console.error('Error reading sessions:', error)
    return { sessions: [] }
  }
})
