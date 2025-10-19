import { defineEventHandler, getRouterParam, getQuery } from 'h3'
import { isValidSessionId, readSessionHistory, type SessionMessage } from '../../../lib/session-manager'

export default defineEventHandler(async (event) => {
  const sessionId = getRouterParam(event, 'sessionId')
  const query = getQuery(event)
  
  // Parse query parameters
  const limit = Math.min(parseInt(query.limit as string) || 20, 100) // Cap at 100
  const before = query.before as string | undefined
  
  if (!sessionId || !isValidSessionId(sessionId)) {
    return { messages: [], hasMore: false, error: 'Invalid session ID' }
  }
  
  try {
    // Read full session history
    const allMessages = await readSessionHistory(sessionId)
    
    if (allMessages.length === 0) {
      return { messages: [], hasMore: false }
    }
    
    let startIndex = 0
    let endIndex = allMessages.length
    
    if (before) {
      // Find the message with the given ID
      const beforeIndex = allMessages.findIndex(m => m.id === before)
      
      if (beforeIndex === -1) {
        // Message not found, return empty
        return { messages: [], hasMore: false }
      }
      
      // Return up to `limit` messages before this one
      endIndex = beforeIndex
      startIndex = Math.max(0, beforeIndex - limit)
    } else {
      // No "before" parameter: return the last `limit` messages
      startIndex = Math.max(0, allMessages.length - limit)
    }
    
    const messages = allMessages.slice(startIndex, endIndex)
    const hasMore = startIndex > 0
    
    console.log(`[API] Retrieved ${messages.length} messages for session ${sessionId.substring(0, 8)}... (hasMore: ${hasMore})`)
    
    return { messages, hasMore }
  } catch (error: any) {
    console.error(`Error reading session messages for ${sessionId}:`, error)
    return { messages: [], hasMore: false, error: 'Failed to load messages' }
  }
})
