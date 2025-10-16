import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import OpenAI from 'openai'

// Import the new modular architecture
import {
  getThriveBotSystemPrompt,
  getStreamingStatusPrompt
} from '../lib/prompts/thrivebot-prompts'
import { ALL_TOOL_DEFINITIONS, routeToolCall } from '../lib/mcp/tools-registry'
import { runReasoningLoop } from '../lib/mcp/reasoning-loop'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ query: string; history?: Array<{role: string, content: string}> }>(event)
  const query = (body?.query || '').trim()
  const history = body?.history || []

  if (!query) {
    return { messages: [{ type: 'error', content: 'Please ask a question.' }] }
  }

  const cfg = useRuntimeConfig()
  const apiKey = cfg.openai?.apiKey as string | undefined
  if (!apiKey) {
    return { messages: [{ type: 'error', content: 'OpenAI is not configured.' }] }
  }

  try {
    const openai = new OpenAI({ apiKey })
    const messages: Array<{ type: string, content: string, status?: string }> = []
    
    // Use centralized system prompt
    const systemPrompt = getThriveBotSystemPrompt()

    // Build conversation with history
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: query }
    ]

    // Step 1: Get initial AI response with potential tool calls
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

    // Start reasoning loop with streaming updates
    const finalContent = await runReasoningLoop(
      openai,
      systemPrompt,
      history,
      query,
      message,
      messages,
      ALL_TOOL_DEFINITIONS,
      routeToolCall,
      10  // Max iterations
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
