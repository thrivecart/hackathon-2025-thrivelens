import { readSessionHistory } from '../session-manager'
import { useRuntimeConfig } from '#imports'
import OpenAI from 'openai'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { getVisualQAPrompt } from '../prompts/thrivelens-prompts'

// Visual Q&A Tool Definition for OpenAI function calling
export const VISUAL_QA_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'answer_visual_question',
      description: 'Answer specific visual questions about a previously audited website/image by retrieving the screenshot and analyzing it with GPT-4V. Use this when user asks detailed questions about visual elements that weren\'t covered in the original audit (e.g., "do you see the affiliate link?", "what color is the logo?", "what items are in the menu?"). This tool retrieves the actual screenshot from session history and re-analyzes it to answer the specific question. If no previous screenshot exists, it can capture a new one.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The specific visual question to answer (e.g., "Do you see help centre, affiliate, and member discount in the menu?", "What color is the logo?", "What text is in the header?")'
          },
          messageId: {
            type: 'string',
            description: 'Optional: The ID of the assistant message containing the audit. Look for [AUDIT_AVAILABLE: messageId=...] tags in history.'
          },
          url: {
            type: 'string',
            description: 'Optional: The website URL to analyze. Used to search for existing screenshots or to capture a new one if needed.'
          }
        },
        required: ['question']
      }
    }
  }
]

export const VISUAL_QA_TOOL_NAMES = VISUAL_QA_TOOLS.map(tool => tool.function.name)

// Main tool call handler
export async function callVisualQATool(
  toolName: string,
  args: any,
  sessionId: string
): Promise<any> {
  console.log(`[VISUAL_QA] Tool: ${toolName}`, { question: args.question, messageId: args.messageId, url: args.url })
  switch (toolName) {
    case 'answer_visual_question':
      return await answerVisualQuestion(args, sessionId)
    default:
      throw new Error(`Unknown visual Q&A tool: ${toolName}`)
  }
}

// Answer visual question implementation
async function answerVisualQuestion(
  args: { question: string; messageId?: string; url?: string },
  sessionId: string
): Promise<any> {
  try {
    const { question, messageId, url } = args
    
    if (!question) {
      return {
        success: false,
        error: 'Question is required'
      }
    }
    
    // Try to find existing screenshot in session history
    let screenshotPath: string | undefined
    let screenshotSource: 'session' | 'new' = 'session'
    
    const history = await readSessionHistory(sessionId)
    
    if (history.length > 0) {
      // Find the message with screenshot
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
      } else {
        // Find most recent audit with screenshot
        for (let i = history.length - 1; i >= 0; i--) {
          const msg = history[i]
          if (msg.role === 'assistant' && msg.assets && msg.assets.length > 0) {
            const hasScreenshot = msg.assets.some(asset => 
              asset.screenshotPath || asset.screenshotUrl
            )
            if (hasScreenshot) {
              targetMessage = msg
              break
            }
          }
        }
      }
      
      if (targetMessage && targetMessage.assets && targetMessage.assets.length > 0) {
        const screenshotAsset = targetMessage.assets.find(asset => 
          asset.screenshotPath || asset.screenshotUrl
        )
        
        if (screenshotAsset) {
          screenshotPath = screenshotAsset.screenshotPath || screenshotAsset.screenshotUrl
          
          // Also capture the URL from the asset if not provided
          if (!url && screenshotAsset.url) {
            args.url = screenshotAsset.url
          }
        }
      }
    }
    
    // If no screenshot found in session, try to capture a new one
    if (!screenshotPath && url) {
      console.log(`[VISUAL_QA] No screenshot found, capturing new screenshot for ${url}...`)
      screenshotPath = await captureScreenshotForVisualQA(url)
      screenshotSource = 'new'
    } else if (screenshotPath) {
      console.log(`[VISUAL_QA] Using existing screenshot: ${screenshotPath}`)
    }
    
    // If still no screenshot, return error with helpful message
    if (!screenshotPath) {
      return {
        success: false,
        error: 'No screenshot available to answer visual question',
        suggestion: 'Please provide a URL or upload an image for me to analyze'
      }
    }
    
    // Read the screenshot file
    const fullPath = join(process.cwd(), 'public', screenshotPath)
    const screenshotBuffer = await readFile(fullPath)
    const base64Image = screenshotBuffer.toString('base64')
    
    // Get OpenAI API key
    const cfg = useRuntimeConfig()
    const apiKey = cfg.openai?.apiKey as string | undefined
    
    if (!apiKey) {
      return {
        success: false,
        error: 'OpenAI API key is not configured'
      }
    }
    
    // Use GPT-4V to answer the specific question
    console.log(`[VISUAL_QA] Calling GPT-4V for question: "${question}"`)
    const openai = new OpenAI({ apiKey })
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: getVisualQAPrompt()
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: question },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }
      ]
    })
    
    const answer = response.choices[0]?.message?.content
    
    if (!answer) {
      return {
        success: false,
        error: 'Failed to get answer from GPT-4V'
      }
    }
    
    return {
      success: true,
      question,
      answer,
      screenshotPath,
      screenshotSource,
      url: args.url,
      message: screenshotSource === 'new' 
        ? `Captured new screenshot and analyzed to answer: "${question}"`
        : `Analyzed existing screenshot to answer: "${question}"`
    }
    
  } catch (error: any) {
    console.error('Visual Q&A error:', error)
    return {
      success: false,
      error: error.message || 'Failed to answer visual question'
    }
  }
}

// Capture screenshot specifically for visual Q&A (simplified, no full audit)
async function captureScreenshotForVisualQA(url: string): Promise<string> {
  let browser
  
  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      timeout: 60000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    })
    
    const page = await browser.newPage()
    await page.setViewportSize({ width: 1200, height: 800 })
    
    // Navigate to page with timeout
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    // Wait a bit for any animations
    await page.waitForTimeout(2000)
    
    // Ensure screenshots directory exists
    const screenshotsDir = join(process.cwd(), 'public', 'screenshots')
    if (!existsSync(screenshotsDir)) {
      await mkdir(screenshotsDir, { recursive: true })
    }
    
    // Save screenshot
    const timestamp = Date.now()
    const filename = `visual-qa-${timestamp}-desktop.png`
    const screenshotPath = `/screenshots/${filename}`
    const fullPath = join(screenshotsDir, filename)
    
    await page.screenshot({ 
      path: fullPath,
      fullPage: true 
    })
    
    await browser.close()
    
    return screenshotPath
    
  } catch (error: any) {
    if (browser) {
      await browser.close()
    }
    
    console.error('Screenshot capture error:', error)
    
    if (error.message.includes('Timeout')) {
      throw new Error('Website took too long to load. Please check if the site is accessible.')
    }
    
    throw new Error(`Failed to capture screenshot: ${error.message}`)
  }
}
