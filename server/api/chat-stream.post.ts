import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import OpenAI from 'openai'
import { writeFile } from 'fs/promises'
import { join } from 'path'

import {
  getThrivelensSystemPrompt,
  getStreamingStatusPrompt
} from '../lib/prompts/thrivelens-prompts'
import { ALL_TOOL_DEFINITIONS, routeToolCall } from '../lib/mcp/tools-registry'
import { runReasoningLoop, StreamMessage } from '../lib/mcp/reasoning-loop'
import {
  createSession,
  isValidSessionId,
  sessionExists,
  appendMessage,
  readSessionHistory,
  convertToOpenAIMessages,
  type MessageAsset
} from '../lib/session-manager'

interface ChatRequest {
  sessionId?: string
  query: string
  history?: Array<{role: string, content: string}> // Deprecated, kept for backward compat
  imageData?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ChatRequest>(event)
  const query = (body?.query || '').trim()
  const imageData = body?.imageData
  let sessionId = body?.sessionId

  if (!query && !imageData) {
    return { messages: [{ type: 'error', content: 'Please ask a question or provide an image.' }] }
  }

  const cfg = useRuntimeConfig()
  const apiKey = cfg.openai?.apiKey as string | undefined
  if (!apiKey) {
    return { messages: [{ type: 'error', content: 'OpenAI is not configured.' }] }
  }

  try {
    console.log(`[API] Chat request received (sessionId: ${sessionId || 'none'}, hasImage: ${!!imageData})`)
    
    // Validate or create session
    if (!sessionId || !isValidSessionId(sessionId)) {
      console.log('[API] Invalid or missing sessionId, creating new session')
      sessionId = await createSession()
    } else if (!(await sessionExists(sessionId))) {
      console.log('[API] Session does not exist, creating new session')
      sessionId = await createSession()
    }

    const openai = new OpenAI({ apiKey })
    const messages: StreamMessage[] = []
    
    const systemPrompt = getThrivelensSystemPrompt()

    // Read session history
    const sessionHistory = await readSessionHistory(sessionId)
    console.log(`[API] Loaded ${sessionHistory.length} messages from session`)

    // Handle user-uploaded image if provided
    let userImagePath: string | undefined
    if (imageData) {
      // Save the image to public/screenshots for persistence
      const screenshotsDir = join(process.cwd(), 'public', 'screenshots')
      const timestamp = Date.now()
      const filename = `user-upload-${timestamp}.png`
      userImagePath = `/screenshots/${filename}`
      const fullPath = join(screenshotsDir, filename)
      
      // Extract base64 data
      let base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      await writeFile(fullPath, buffer)
      console.log(`[API] Saved user image: ${userImagePath}`)
    }

    // Prepare user message (add image context if needed)
    const userMessageContent = imageData 
      ? (query ? `${query} [User has provided an image for analysis]` : 'Analyze the provided image for UX and conversion optimization.')
      : query
    
    // Append user message to session BEFORE processing (Option B)
    const userMessageAssets: MessageAsset[] = userImagePath ? [
      { userImagePath }
    ] : []
    
    await appendMessage(sessionId, {
      role: 'user',
      content: userMessageContent,
      assets: userMessageAssets
    })
    
    // Convert session history to OpenAI format
    const historyMessages = convertToOpenAIMessages(sessionHistory)
    
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessageContent }
    ]
    
    // Get initial AI response with potential tool calls
    console.log(`[API] Calling OpenAI with ${conversationMessages.length} messages`)
    messages.push({ type: 'status', content: getStreamingStatusPrompt(), status: 'thinking' })
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      messages: conversationMessages,
      tools: ALL_TOOL_DEFINITIONS
    })

    const message = response.choices[0]?.message
    if (!message) {
      return { messages: [{ type: 'error', content: 'Failed to get AI response' }] }
    }

    // Custom router to inject full imageData for image analysis and sessionId for session-aware tools
    const customRouter = async (toolName: string, args: any, routerSessionId?: string) => {
      if (toolName === 'analyze_image_ux' && imageData) {
        args = { ...args, imageData } // Inject full imageData
      }
      return await routeToolCall(toolName, args, routerSessionId)
    }
    
    // Execute reasoning loop to handle tool calls and generate response
    const finalContent = await runReasoningLoop(
      openai,
      systemPrompt,
      historyMessages,
      userMessageContent,
      message,
      messages,
      ALL_TOOL_DEFINITIONS,
      customRouter,
      12,
      sessionId // Pass sessionId for session-aware tools
    )
    
    console.log(`[API] Response complete, persisting to session`)
    
    messages.push({ 
      type: 'final', 
      content: finalContent,
      status: 'complete'
    })

    // Extract assets from tool execution messages
    const assistantAssets: MessageAsset[] = []
    for (const msg of messages) {
      if (msg.type === 'progress' && (msg as any).screenshotUrl) {
        assistantAssets.push({
          screenshotUrl: (msg as any).screenshotUrl,
          screenshotPath: (msg as any).screenshotUrl,
          uxAnalysis: (msg as any).uxAnalysis,
          device: (msg as any).uxAnalysis?.device,
          url: (msg as any).uxAnalysis?.url,
          pageType: (msg as any).uxAnalysis?.pageType
        })
      }
      if (msg.type === 'pdf_export' && (msg as any).pdfUrl) {
        assistantAssets.push({
          pdfUrl: (msg as any).pdfUrl,
          pdfFilename: (msg as any).pdfFilename
        })
      }
    }

    // Persist assistant response to session
    await appendMessage(sessionId, {
      role: 'assistant',
      content: finalContent,
      assets: assistantAssets
    })

    return { messages, sessionId }

  } catch (error) {
    console.error('Streaming chat error:', error)
    return { 
      messages: [
        { type: 'error', content: 'I encountered an issue processing your request.' }
      ]
    }
  }
})
