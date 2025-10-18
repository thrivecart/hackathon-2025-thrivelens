import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import OpenAI from 'openai'

import {
  getThrivelensSystemPrompt,
  getStreamingStatusPrompt
} from '../lib/prompts/thrivelens-prompts'
import { ALL_TOOL_DEFINITIONS, routeToolCall } from '../lib/mcp/tools-registry'
import { runReasoningLoop, StreamMessage } from '../lib/mcp/reasoning-loop'

interface ChatRequest {
  query: string
  history?: Array<{role: string, content: string}>
  imageData?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ChatRequest>(event)
  const query = (body?.query || '').trim()
  const history = body?.history || []
  const imageData = body?.imageData

  if (!query && !imageData) {
    return { messages: [{ type: 'error', content: 'Please ask a question or provide an image.' }] }
  }

  const cfg = useRuntimeConfig()
  const apiKey = cfg.openai?.apiKey as string | undefined
  if (!apiKey) {
    return { messages: [{ type: 'error', content: 'OpenAI is not configured.' }] }
  }

  try {
    const openai = new OpenAI({ apiKey })
    const messages: StreamMessage[] = []
    
    const systemPrompt = getThrivelensSystemPrompt()

    // Prepare user message (add image context if needed)
    const userMessage = imageData 
      ? (query ? `${query} [User has provided an image for analysis]` : 'Analyze the provided image for UX and conversion optimization.')
      : query
    
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage }
    ]
    
    console.log('[DEBUG] Conversation history length:', history.length)
    console.log('[DEBUG] Last few history items:', JSON.stringify(history.slice(-3), null, 2))

    // Get initial AI response with potential tool calls
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

    // Custom router to inject full imageData for image analysis
    const customRouter = async (toolName: string, args: any) => {
      if (toolName === 'analyze_image_ux' && imageData) {
        args = { ...args, imageData } // Inject full imageData
      }
      return await routeToolCall(toolName, args)
    }
    
    // Execute reasoning loop to handle tool calls and generate response
    const finalContent = await runReasoningLoop(
      openai,
      systemPrompt,
      history,
      userMessage,
      message,
      messages,
      ALL_TOOL_DEFINITIONS,
      customRouter,
      12
    )
    
    messages.push({ 
      type: 'final', 
      content: finalContent,
      status: 'complete'
    })

    return { messages }

  } catch (error) {
    console.error('Streaming chat error:', error)
    return { 
      messages: [
        { type: 'error', content: 'I encountered an issue processing your request.' }
      ]
    }
  }
})
