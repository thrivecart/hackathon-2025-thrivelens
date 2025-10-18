// Generic Reasoning Loop for MCP Tools
// Works with any tool definitions and routing function

import { getAnalyzingPrompt } from '../prompts/thrivelens-prompts'

export interface StreamMessage {
  type: string
  content: string
  status?: string
}

export type ToolCallRouter = (toolName: string, args: any) => Promise<any>

// Generic streaming reasoning loop that works with any MCP tools
export async function runReasoningLoop(
  openai: any,
  systemPrompt: string,
  history: Array<{role: string, content: string}>,
  userQuery: string,
  initialMessage: any,
  messages: StreamMessage[],
  tools: any[],
  routeToolCall: ToolCallRouter,
  maxIterations: number = 6
): Promise<string> {
  const conversationHistory = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userQuery }
  ]
  
  let currentMessage = initialMessage
  let iteration = 0
  
  while (iteration < maxIterations) {
    // If the current message has no tool calls, we're done
    if (!currentMessage.tool_calls || currentMessage.tool_calls.length === 0) {
      return currentMessage.content?.trim() || 'I processed your request but couldn\'t generate a response.'
    }
    
    messages.push({ 
      type: 'progress', 
      content: `Making ${currentMessage.tool_calls.length} data requests...`,
      status: 'working'
    })
    
    // Add the assistant's message (with tool calls) to the conversation
    conversationHistory.push(currentMessage)
    
    // Execute all tool calls in this iteration
    const toolResults = []
    for (let i = 0; i < currentMessage.tool_calls.length; i++) {
      const toolCall = currentMessage.tool_calls[i]
      const { name, arguments: args } = toolCall.function
      
      messages.push({ 
        type: 'progress', 
        content: `Step ${i + 1}: Calling ${name}...`,
        status: 'working'
      })
      
      try {
        // Use the provided routing function to call the appropriate tool
        const result = await routeToolCall(name, JSON.parse(args))
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool' as const,
          content: JSON.stringify(result, null, 2)
        })
        
        // Handle UX audit results specially
        if (name === 'audit_website_ux' && result.success) {
          messages.push({ 
            type: 'progress', 
            content: `✓ UX audit completed - Screenshot captured and analyzed`,
            status: 'success',
            screenshotUrl: result.screenshotPath,
            uxAnalysis: result.analysis
          })
        } else {
          messages.push({ 
            type: 'progress', 
            content: `✓ ${name} completed`,
            status: 'success'
          })
        }
        
      } catch (error) {
        messages.push({ 
          type: 'progress', 
          content: `✗ ${name} failed: ${error.message}`,
          status: 'error'
        })
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool' as const,
          content: JSON.stringify({ error: error.message })
        })
      }
    }
    
    // Add tool results to conversation
    conversationHistory.push(...toolResults)
    
    // Get the AI's next response
    messages.push({ 
      type: 'progress', 
      content: getAnalyzingPrompt(),
      status: 'thinking'
    })
    
    try {
      const nextResponse = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        temperature: 0.2,
        messages: conversationHistory,
        tools: tools
      })
      
      currentMessage = nextResponse.choices[0]?.message
      if (!currentMessage) {
        break
      }
      
    } catch (error) {
      console.error(`Error in reasoning iteration ${iteration + 1}:`, error)
      break
    }
    
    iteration++
  }
  
  if (iteration >= maxIterations) {
    messages.push({ 
      type: 'progress', 
      content: 'Reached reasoning limit, providing response...',
      status: 'thinking'
    })
  }
  
  // Return the final message content
  const finalContent = currentMessage?.content?.trim()
  if (finalContent) {
    return finalContent
  }
  
  // Fallback: try to extract useful information from the conversation
  const toolData = conversationHistory
    .filter(msg => msg.role === 'tool')
    .map(msg => {
      try {
        return JSON.parse(msg.content as string)
      } catch {
        return msg.content
      }
    })
  
  if (toolData.length > 0) {
    return `I gathered the requested data through multiple steps. Here's what I found: ${JSON.stringify(toolData, null, 2)}`
  }
  
  return 'I processed your request but encountered an issue generating the final response.'
}