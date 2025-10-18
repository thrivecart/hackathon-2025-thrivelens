import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import OpenAI from 'openai'

// Import the new modular architecture
import {
  getThrivelensSystemPrompt,
  getStreamingStatusPrompt
} from '../lib/prompts/thrivelens-prompts'
import { ALL_TOOL_DEFINITIONS, routeToolCall } from '../lib/mcp/tools-registry'
import { runReasoningLoop } from '../lib/mcp/reasoning-loop'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ 
    query: string; 
    history?: Array<{role: string, content: string}>
    imageData?: string
  }>(event)
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
    const messages: Array<{ type: string, content: string, status?: string }> = []
    
    // Use centralized system prompt
    const systemPrompt = getThrivelensSystemPrompt()

    // Build conversation with history
    let userMessage = query
    
    // If image is provided, add context to the query
    if (imageData) {
      userMessage = query ? `${query} [User has provided an image for analysis]` : 'Analyze the provided image for UX and conversion optimization.'
    }
    
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage }
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

    // Create a custom router that injects imageData if needed
    const customRouter = async (toolName: string, args: any) => {
      // CRITICAL: OpenAI truncates large strings in function args
      // If calling analyze_image_ux, ALWAYS inject the full imageData from context
      if (toolName === 'analyze_image_ux' && imageData) {
        // Replace any truncated imageData with the full version
        args = { ...args, imageData }
      }
      
      return await routeToolCall(toolName, args)
    }
    
    // Start reasoning loop with streaming updates
    const finalContent = await runReasoningLoop(
      openai,
      systemPrompt,
      history,
      userMessage,
      message,
      messages,
      ALL_TOOL_DEFINITIONS,
      customRouter,
      12  // Max iterations
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
