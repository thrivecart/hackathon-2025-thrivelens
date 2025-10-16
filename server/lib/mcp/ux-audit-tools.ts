// UX Audit Tools for Website Screenshot and Conversion Analysis

import { useRuntimeConfig } from '#imports'
import { chromium } from 'playwright'
import OpenAI from 'openai'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Tool definitions for OpenAI function calling
export const UX_AUDIT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'audit_website_ux',
      description: 'Take a screenshot of a website and analyze its UX for conversion optimization. Perfect for auditing checkout pages, landing pages, and product pages.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the website to audit (must include http:// or https://)'
          },
          pageType: {
            type: 'string',
            enum: ['checkout', 'landing', 'product', 'homepage', 'signup', 'general'],
            description: 'Type of page being audited to provide targeted feedback. Default: general'
          },
          viewport: {
            type: 'object',
            properties: {
              width: { type: 'number', description: 'Viewport width in pixels. Default: 1200' },
              height: { type: 'number', description: 'Viewport height in pixels. Default: 800' }
            },
            description: 'Viewport size for screenshot capture'
          },
          device: {
            type: 'string',
            enum: ['desktop', 'mobile', 'tablet'],
            description: 'Device type for responsive analysis. Default: desktop'
          },
          focusAreas: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific areas to focus on (e.g., "call-to-action buttons", "form design", "trust signals")'
          }
        },
        required: ['url']
      }
    }
  }
]

export const UX_AUDIT_TOOL_NAMES = UX_AUDIT_TOOLS.map(tool => tool.function.name)

// Device presets
const DEVICE_PRESETS = {
  desktop: { width: 1200, height: 800 },
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 }
}

// UX audit prompt templates
const UX_AUDIT_PROMPTS = {
  checkout: `Analyze this checkout page screenshot for conversion optimization. Focus on:
- Form usability and field reduction
- Trust signals (security badges, testimonials)
- Payment options and clarity
- Error handling and validation
- Mobile responsiveness
- Urgency and scarcity elements
- Exit-intent prevention
- Progress indicators
Provide 3-5 specific, actionable recommendations to increase conversion rates.`,

  landing: `Analyze this landing page screenshot for conversion optimization. Focus on:
- Value proposition clarity and positioning
- Hero section effectiveness
- Call-to-action prominence and copy
- Social proof and testimonials
- Page flow and information hierarchy
- Mobile optimization
- Loading speed indicators
- Lead capture forms
Provide 3-5 specific, actionable recommendations to increase conversion rates.`,

  product: `Analyze this product page screenshot for conversion optimization. Focus on:
- Product imagery and gallery effectiveness
- Price presentation and positioning
- Add-to-cart button prominence
- Product descriptions and benefits
- Reviews and ratings display
- Trust signals and guarantees
- Cross-sell and upsell opportunities
- Mobile shopping experience
Provide 3-5 specific, actionable recommendations to increase conversion rates.`,

  homepage: `Analyze this homepage screenshot for conversion optimization. Focus on:
- Value proposition communication
- Navigation clarity
- Hero section impact
- Key conversion paths
- Trust building elements
- Content hierarchy
- Mobile experience
- Loading performance indicators
Provide 3-5 specific, actionable recommendations to improve user engagement and conversions.`,

  signup: `Analyze this signup page screenshot for conversion optimization. Focus on:
- Form simplification and field reduction
- Value proposition for signing up
- Social login options
- Privacy and security messaging
- Progress indicators
- Error handling
- Mobile form usability
- Incentives and benefits
Provide 3-5 specific, actionable recommendations to increase signup conversions.`,

  general: `Analyze this website screenshot for overall UX and conversion optimization. Focus on:
- Visual hierarchy and design clarity
- Navigation and user flow
- Call-to-action effectiveness
- Mobile responsiveness
- Trust signals
- Page loading indicators
- Content organization
- User engagement elements
Provide 3-5 specific, actionable recommendations to improve user experience and conversions.`
}

// Main tool call handler
export async function callUXAuditTool(toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case 'audit_website_ux':
      return await auditWebsiteUX(args)
    default:
      throw new Error(`Unknown UX audit tool: ${toolName}`)
  }
}

// Website UX audit implementation
async function auditWebsiteUX(args: {
  url: string
  pageType?: 'checkout' | 'landing' | 'product' | 'homepage' | 'signup' | 'general'
  viewport?: { width: number; height: number }
  device?: 'desktop' | 'mobile' | 'tablet'
  focusAreas?: string[]
}): Promise<any> {
  const { 
    url, 
    pageType = 'general', 
    device = 'desktop',
    focusAreas = []
  } = args

  // Validate URL
  if (!url || !isValidUrl(url)) {
    throw new Error('Please provide a valid URL (must include http:// or https://)')
  }

  const cfg = useRuntimeConfig()
  const apiKey = cfg.openai?.apiKey as string | undefined
  
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured')
  }

  try {
    // Determine viewport size
    const viewport = args.viewport || DEVICE_PRESETS[device]
    
    // Take screenshot with retry logic
    console.log(`Taking ${device} screenshot of ${url}...`)
    let screenshotPath
    let retryCount = 0
    const maxRetries = 2
    
    while (retryCount <= maxRetries) {
      try {
        screenshotPath = await captureScreenshot(url, viewport, device)
        break
      } catch (error: any) {
        retryCount++
        console.log(`Screenshot attempt ${retryCount} failed: ${error.message}`)
        
        if (retryCount > maxRetries) {
          // Final attempt failed, provide helpful error message
          if (error.message.includes('Timeout')) {
            throw new Error(
              `The webpage took too long to load (tried ${maxRetries + 1} times). ` +
              'This might be due to slow loading, heavy JavaScript, or network issues. ' +
              'Please try again or check if the website is accessible.'
            )
          }
          throw error
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    if (!screenshotPath) {
      throw new Error('Failed to capture screenshot after multiple attempts')
    }
    
    // Analyze with GPT-4V
    console.log(`Analyzing UX for ${pageType} page...`)
    const analysis = await analyzeScreenshotWithGPTV(screenshotPath, pageType, focusAreas, apiKey)
    
    return {
      success: true,
      url,
      pageType,
      device,
      viewport,
      screenshotPath,
      analysis,
      recommendations: analysis.recommendations || [],
      score: analysis.score || null,
      focusAreas,
      message: `UX audit completed for ${pageType} page`
    }

  } catch (error: any) {
    console.error('UX audit error:', error)
    
    let errorMessage = 'Failed to audit website UX. Please try again.'
    
    if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      errorMessage = 'Could not reach the website. Please check the URL and try again.'
    } else if (error.message.includes('net::ERR_CERT_')) {
      errorMessage = 'SSL certificate error. The website may not be secure.'
    } else if (error.message.includes('Timeout')) {
      errorMessage = 'Website took too long to load. Please try again or check if the site is responsive.'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    throw new Error(errorMessage)
  }
}

// Screenshot capture function
async function captureScreenshot(
  url: string, 
  viewport: { width: number; height: number },
  device: string
): Promise<string> {
  let browser
  
  try {
    // Launch browser with settings optimized for stability and timeout handling
    browser = await chromium.launch({
      headless: true,
      timeout: 60000,  // Increase browser launch timeout
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--disable-notifications',
        '--disable-default-apps',
        '--no-first-run',
        '--memory-pressure-off'
      ]
    })
    
    const context = await browser.newContext({
      viewport,
      userAgent: device === 'mobile' 
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    })
    
    const page = await context.newPage()
    
    // Try multiple loading strategies with increasing timeout
    let loadSuccess = false
    const strategies = [
      { waitUntil: 'domcontentloaded' as const, timeout: 15000, name: 'DOM ready' },
      { waitUntil: 'load' as const, timeout: 30000, name: 'Full load' },
      { waitUntil: 'networkidle' as const, timeout: 45000, name: 'Network idle' }
    ]
    
    for (const strategy of strategies) {
      try {
        console.log(`Trying ${strategy.name} strategy...`)
        await page.goto(url, { waitUntil: strategy.waitUntil, timeout: strategy.timeout })
        loadSuccess = true
        console.log(`✓ Page loaded successfully with ${strategy.name} strategy`)
        break
      } catch (error: any) {
        console.log(`✗ ${strategy.name} strategy failed: ${error.message}`)
        
        // If this is the last strategy, try one final attempt without waiting
        if (strategy === strategies[strategies.length - 1]) {
          console.log('Attempting final fallback: basic navigation without waiting...')
          try {
            await page.goto(url, { timeout: 60000 })
            // Give it a few seconds to render whatever it can
            await page.waitForTimeout(5000)
            loadSuccess = true
            console.log('✓ Fallback navigation succeeded')
          } catch (fallbackError: any) {
            console.log(`✗ Final fallback failed: ${fallbackError.message}`)
            throw new Error(
              `Failed to load the page after trying multiple strategies. ` +
              `The website may be experiencing issues or may be very slow to load. ` +
              `Last error: ${error.message}`
            )
          }
        }
      }
    }
    
    if (!loadSuccess) {
      throw new Error('Failed to load page with all strategies')
    }
    
    // Wait for dynamic content and collect page info
    try {
      await page.waitForTimeout(3000)
      
      // Try to get basic page info for context
      const title = await page.title().catch(() => 'Unknown')
      const url = page.url()
      console.log(`✓ Successfully loaded: "${title}" at ${url}`)
    } catch {
      // Continue even if timeout fails
      console.log('Page loaded with basic rendering - proceeding with screenshot')
    }
    
    // Create screenshots directory if it doesn't exist
    const screenshotsDir = join(process.cwd(), 'public', 'screenshots')
    if (!existsSync(screenshotsDir)) {
      await mkdir(screenshotsDir, { recursive: true })
    }
    
    // Generate filename
    const timestamp = Date.now()
    const filename = `ux-audit-${timestamp}-${device}.png`
    const screenshotPath = join(screenshotsDir, filename)
    
    // Capture full page screenshot
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: 'png'
    })
    
    return `/screenshots/${filename}`
    
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// GPT-4V analysis function
async function analyzeScreenshotWithGPTV(
  screenshotPath: string,
  pageType: string,
  focusAreas: string[],
  apiKey: string
): Promise<any> {
  const openai = new OpenAI({ apiKey })
  
  // Read screenshot file
  const fs = await import('fs/promises')
  const screenshotBuffer = await fs.readFile(join(process.cwd(), 'public', screenshotPath))
  const base64Image = screenshotBuffer.toString('base64')
  
  // Build analysis prompt
  let prompt = UX_AUDIT_PROMPTS[pageType as keyof typeof UX_AUDIT_PROMPTS] || UX_AUDIT_PROMPTS.general
  
  if (focusAreas.length > 0) {
    prompt += `\n\nPay special attention to these areas: ${focusAreas.join(', ')}`
  }
  
  prompt += `\n\nReturn your analysis in this JSON format:
{
  "score": 75,
  "summary": "Brief overall assessment",
  "recommendations": [
    {
      "title": "Recommendation title",
      "description": "Detailed explanation",
      "priority": "high|medium|low",
      "impact": "Expected conversion impact"
    }
  ],
  "strengths": ["What's working well"],
  "weaknesses": ["Areas for improvement"],
  "mobileReadiness": "Assessment of mobile optimization"
}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: 'You are a conversion optimization expert specializing in UX audits. Provide specific, actionable recommendations based on conversion rate optimization best practices.'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
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
  
  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No analysis received from OpenAI')
  }
  
  try {
    return JSON.parse(content)
  } catch {
    // If JSON parsing fails, return structured response
    return {
      score: null,
      summary: content,
      recommendations: [],
      strengths: [],
      weaknesses: [],
      mobileReadiness: 'Analysis provided in summary'
    }
  }
}

// URL validation helper
function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}

// Helper to detect UX audit intent from user queries
export function detectUXAuditIntent(query: string): boolean {
  const uxKeywords = [
    'audit', 'analyze', 'review', 'check',
    'ux', 'ui', 'design', 'conversion',
    'screenshot', 'capture',
    'checkout', 'landing page', 'website',
    'optimize', 'improve', 'feedback'
  ]
  
  const lowerQuery = query.toLowerCase()
  const hasUrl = /https?:\/\//.test(query)
  const hasKeyword = uxKeywords.some(keyword => lowerQuery.includes(keyword))
  
  return hasUrl && hasKeyword
}

// Helper to extract URL from user message
export function extractUrlFromMessage(message: string): string | null {
  const urlRegex = /https?:\/\/[^\s]+/g
  const matches = message.match(urlRegex)
  return matches ? matches[0] : null
}