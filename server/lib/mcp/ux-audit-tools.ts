import { useRuntimeConfig } from '#imports'
import { chromium } from 'playwright'
import OpenAI from 'openai'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getUXRefinementPrompt } from '../prompts/thrivelens-prompts'

// Simple in-memory caches (per server process)
const SIX_HOURS = 6 * 60 * 60 * 1000

type Viewport = { width: number; height: number }

type ScreenshotCacheEntry = {
  path: string
  url: string
  device: string
  viewport: Viewport
  timestamp: number
}

// key: `${url}|${device}|${viewport.width}x${viewport.height}`
const SCREENSHOT_CACHE = new Map<string, ScreenshotCacheEntry>()

// Cache UX analyses to avoid re-analyzing when focus areas/pageType repeat
// key: `${screenshotPath}|${device}|${pageType}|${JSON.stringify(sortedFocusAreas)}`
const ANALYSIS_CACHE = new Map<string, any>()

// Cache raw vision analysis (before refinement) for debugging/comparison
const RAW_VISION_CACHE = new Map<string, any>()

function screenshotKey(url: string, device: string, viewport: Viewport) {
  return `${url}|${device}|${viewport.width}x${viewport.height}`
}

function analysisKey(screenshotPath: string, device: string, pageType: string, focusAreas: string[]) {
  const sorted = [...(focusAreas || [])].sort()
  return `${screenshotPath}|${device}|${pageType}|${JSON.stringify(sorted)}`
}

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
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_image_ux',
      description: 'Analyze an uploaded image/screenshot for UX and conversion optimization. Use when the user provides an image. Note: imageData will be automatically provided from the uploaded image.',
      parameters: {
        type: 'object',
        properties: {
          pageType: {
            type: 'string',
            enum: ['checkout', 'landing', 'product', 'homepage', 'signup', 'general'],
            description: 'Type of page being audited to provide targeted feedback. Default: general'
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
        required: []
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
export function getPrompt(device:string, pageType: string, focusAreas: string[]) : string {
  return  `
      You are a senior UX and conversion optimization expert specializing in e-commerce and digital experiences.  
      Analyze the provided webpage screenshot from a ${device} perspective.  
      The page type is: ${pageType || 'general'}.
      
      Your goal is to objectively evaluate the page's **user experience, clarity, and conversion effectiveness**, 
      focusing on checkout flows, sales pages, landing pages, and e-commerce experiences.
      
      ---
      ### Focus Areas:
      1. **Visual Design & Layout**
         - Consistency, spacing, contrast, visual hierarchy, readability.
      2. **Information Architecture**
         - Logical grouping, scanning patterns, and clarity of key messages.
      3. **Conversion Optimization**
         - Call-to-action prominence, form usability, pricing clarity, trust signals, and urgency elements.
      4. **Responsiveness & Accessibility**
         - Mobile friendliness, tap targets, legibility, keyboard/screen reader readiness.
      5. **Trust & Credibility**
         - Social proof, reviews, payment confidence, policy visibility.
      6. **Performance & Perceived Speed**
         - Indicators of loading state, lazy loading, image optimization.
      7. **User Flow**
         - Ease of progression toward primary goal (purchase, signup, etc.).
      ---
      
      ### Requirements:
      - Be **objective** and **data-driven**, not purely aesthetic.
      - Identify **strengths** and **weaknesses**.
      - Every **recommendation** must point to at least one identifiable on-screen element  (e.g., “green CTA button in hero section,” “pricing table header text,” “email field placeholder,” etc.).
      - Provide **clear numeric scores (1–100)** for:
        - Overall UX
        - Visual design
        - Conversion readiness
        - Mobile optimization (if applicable)
        - Focus areas: ${JSON.stringify(focusAreas || [])}
      - Suggest **actionable, prioritized recommendations** to improve conversions and UX.
      - It is important if you can point a specific element (a button, a header, a text etc,.) on the page that needs improvement. This will make the analysis more precise and objective.
      
      Return your analysis strictly in **valid JSON** format as follows:
      
      {
        "overallScore": 85/100 (100 if perfect),
        "categoryScores": {
          "visualDesign": 80,
          "conversionReadiness": 90,
          "mobileOptimization": 75,
          "trustAndCredibility": 88,
          "accessibility": 70,
        },
        "summary": "Brief executive summary (2–3 sentences).",
        "strengths": ["List of key positives"],
        "weaknesses": ["List of key negatives"],
        "recommendations": [
          {
            "title": "Action title",
            "description": "Concise explanation of why and how to improve it",
            "priority": "high|medium|low",
            "expectedImpact": "Description of potential impact on conversion rate"
          }
        ],
        "device": "${device}",
        "pageType": "${pageType}",
        "focusAreas": ${JSON.stringify(focusAreas || [])}
      }
      
      ### Guidance
      While high-level feedback is acceptable, **prioritize precision** — e.g.  
      DO - "The green CTA button in the hero section has low contrast against the white background, making it less noticeable."
      DONT - "Make buttons stand out more"
      
      If two screenshots (desktop & mobile) are provided, highlight **differences** in usability and consistency.
      
      `
}

// Main tool call handler
export async function callUXAuditTool(toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case 'audit_website_ux':
      return await auditWebsiteUX(args)
    case 'analyze_image_ux':
      return await analyzeImageUX(args)
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

    // Try to reuse a recent screenshot for the same URL/device/viewport
    let screenshotPath: string | undefined
    const sKey = screenshotKey(url, device, viewport)
    const cached = SCREENSHOT_CACHE.get(sKey)
    const now = Date.now()

    if (cached && existsSync(cached.path) && (now - cached.timestamp) < SIX_HOURS) {
      console.log(`Reusing cached ${device} screenshot for ${url}: ${cached.path}`)
      screenshotPath = cached.path
    } else {
      // Take screenshot with retry logic
      console.log(`Taking ${device} screenshot of ${url}...`)
      let retryCount = 0
      const maxRetries = 2

      while (retryCount <= maxRetries) {
        try {
          screenshotPath = await captureScreenshot(url, viewport, device)
          // Save to cache
          SCREENSHOT_CACHE.set(sKey, { path: screenshotPath, url, device, viewport, timestamp: now })
          break
        } catch (error: any) {
          retryCount++
          console.log(`Screenshot attempt ${retryCount} failed: ${error.message}`)

          if (retryCount > maxRetries) {
            if (error.message.includes('Timeout')) {
              throw new Error(
                `The webpage took too long to load (tried ${maxRetries + 1} times). ` +
                'This might be due to slow loading, heavy JavaScript, or network issues. ' +
                'Please try again or check if the website is accessible.'
              )
            }
            throw error
          }

          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      if (!screenshotPath) {
        throw new Error('Failed to capture screenshot after multiple attempts')
      }
    }

    // Analyze with GPT-4V (reuse analysis if same screenshot + params)
    console.log(`Analyzing UX for ${pageType} page...`)
    const aKey = analysisKey(screenshotPath, device, pageType, focusAreas)
    let analysis: any
    const cachedAnalysis = ANALYSIS_CACHE.get(aKey)
    if (cachedAnalysis) {
      console.log(`Reusing cached UX analysis for ${url} (${device}/${pageType})`)
      analysis = cachedAnalysis
    } else {
      analysis = await analyzeScreenshotWithGPTV(screenshotPath, device, pageType, focusAreas, apiKey)
      ANALYSIS_CACHE.set(aKey, analysis)
    }

    // Normalize analysis (handles cases where model returned JSON inside a code block)
    analysis = normalizeUxAnalysis(analysis)

    return {
      success: true,
      url,
      pageType,
      device,
      viewport,
      screenshotPath,
      analysis,
      recommendations: Array.isArray(analysis?.recommendations) ? analysis.recommendations : [],
      score: analysis?.overallScore ?? analysis?.score ?? null,
      focusAreas,
      message: `UX audit completed for ${pageType} page${cached ? ' (reused screenshot)' : ''}`
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

// Image UX audit implementation (for uploaded images)
async function analyzeImageUX(args: {
  imageData: string
  pageType?: 'checkout' | 'landing' | 'product' | 'homepage' | 'signup' | 'general'
  device?: 'desktop' | 'mobile' | 'tablet'
  focusAreas?: string[]
}): Promise<any> {
  const { 
    imageData,
    pageType = 'general', 
    device = 'desktop',
    focusAreas = []
  } = args

  if (!imageData) {
    throw new Error('Image data is required')
  }

  const cfg = useRuntimeConfig()
  const apiKey = cfg.openai?.apiKey as string | undefined
  
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured')
  }

  try {
    // Detect MIME type from data URI
    let mimeType = 'image/png'
    if (imageData.startsWith('data:')) {
      const mimeMatch = imageData.match(/^data:([^;]+);/)
      if (mimeMatch) {
        mimeType = mimeMatch[1]
      }
    }
    
    // Save uploaded image for display
    const screenshotsDir = join(process.cwd(), 'public', 'screenshots')
    if (!existsSync(screenshotsDir)) {
      await mkdir(screenshotsDir, { recursive: true })
    }
    
    // Determine file extension from MIME type
    const ext = mimeType.split('/')[1] || 'png'
    const timestamp = Date.now()
    const filename = `uploaded-${timestamp}-${device}.${ext}`
    const screenshotPath = `/screenshots/${filename}`
    const fullPath = join(screenshotsDir, filename)
    
    // Remove data URI prefix if present and clean base64 data
    let base64Data = imageData.trim()
    
    // Remove data URL prefix (e.g., data:image/png;base64,)
    if (base64Data.startsWith('data:')) {
      const base64Index = base64Data.indexOf('base64,')
      if (base64Index !== -1) {
        base64Data = base64Data.substring(base64Index + 7) // Skip 'base64,'
      }
    }
    
    // Remove any whitespace or newlines
    base64Data = base64Data.replace(/\s/g, '')
    
    // Basic validation: check if it looks like base64
    // Allow A-Z, a-z, 0-9, +, /, and = for padding
    // Don't validate the entire string with regex (too slow for large images)
    if (!base64Data || base64Data.length < 100) {
      throw new Error('Image data appears to be empty or too short')
    }
    
    // Check first few characters are valid base64
    const sample = base64Data.substring(0, 100)
    if (!/^[A-Za-z0-9+/]+/.test(sample)) {
      throw new Error('Invalid base64 image data format')
    }
    
    // Save image file
    const fs = await import('fs/promises')
    await fs.writeFile(fullPath, Buffer.from(base64Data, 'base64'))
    
    // Analyze with GPT-4V using the core reusable function
    const analysis = await analyzeImageWithGPTV(base64Data, device, pageType, focusAreas, apiKey, mimeType)
    
    // Normalize analysis
    const normalizedAnalysis = normalizeUxAnalysis(analysis)

    return {
      success: true,
      pageType,
      device,
      screenshotPath,
      analysis: normalizedAnalysis,
      recommendations: Array.isArray(normalizedAnalysis?.recommendations) ? normalizedAnalysis.recommendations : [],
      score: normalizedAnalysis?.overallScore ?? normalizedAnalysis?.score ?? null,
      focusAreas,
      message: `UX audit completed for uploaded ${pageType} image (${device})`
    }

  } catch (error: any) {
    console.error('Image UX audit error:', error)
    throw new Error(error.message || 'Failed to analyze uploaded image')
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

// Core UX analysis function with dual-pass architecture (Vision + Reasoning)
async function analyzeImageWithGPTV(
  base64Image: string,
  device: string,
  pageType: string,
  focusAreas: string[],
  apiKey: string,
  mimeType: string = 'image/png'
): Promise<any> {
  const openai = new OpenAI({ apiKey })
  
  // Build analysis prompt
  const prompt = getPrompt(device, pageType, focusAreas)
  
  // Ensure we have clean base64 without any prefix
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '')

  // PASS 1: GPT-4V Vision Analysis
  console.log('🔍 Pass 1: Running GPT-4V vision analysis...')
  const visionResponse = await openai.chat.completions.create({
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
              url: `data:${mimeType};base64,${cleanBase64}`,
              detail: 'high'
            }
          }
        ]
      }
    ]
  })
  
  const visionContent = visionResponse.choices[0]?.message?.content
  if (!visionContent) {
    throw new Error('No analysis received from OpenAI vision model')
  }
  
  // Parse raw vision output
  let rawAnalysis: any
  try {
    rawAnalysis = JSON.parse(visionContent)
  } catch {
    // Try to extract code-fenced JSON from the content
    const fenced = visionContent.match(/```json\s*([\s\S]*?)```/i)
    if (fenced && fenced[1]) {
      try { 
        rawAnalysis = JSON.parse(fenced[1]) 
      } catch {
        // Fallback to unstructured response
        rawAnalysis = {
          score: null,
          summary: visionContent,
          recommendations: [],
          strengths: [],
          weaknesses: [],
          mobileReadiness: 'Analysis provided in summary'
        }
      }
    } else {
      rawAnalysis = {
        score: null,
        summary: visionContent,
        recommendations: [],
        strengths: [],
        weaknesses: [],
        mobileReadiness: 'Analysis provided in summary'
      }
    }
  }

  // Uncomment the return below to disable dual-pass analysis
  // return rawAnalysis

  // Store raw vision output for debugging/comparison
  const cacheKey = `${device}|${pageType}|${JSON.stringify(focusAreas)}`
  RAW_VISION_CACHE.set(cacheKey, rawAnalysis)

  // PASS 2: GPT-4.1-mini Refinement & Validation
  console.log('✨ Pass 2: Refining analysis with GPT-4.1-mini...')
  try {
    const refinementResponse = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0,      // eliminate randomness
      top_p: 1,            // deterministic sampling
      seed: 42,            // ensures reproducibility if supported
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: getUXRefinementPrompt()
        },
        {
          role: 'user',
          content: [
            'Raw UX audit analysis to refine:',
            '',
            '```json',
            JSON.stringify(rawAnalysis, null, 2),
            '```',
            '',
            `Context: ${device} device, ${pageType} page type`,
            focusAreas.length > 0 ? `Focus areas: ${focusAreas.join(', ')}` : '',
            '',
            'Validate scores, ensure recommendations reference specific elements, normalize language, and fix any structural issues.'
          ].filter(Boolean).join('\n')
        }
      ]
    })

    const refinedContent = refinementResponse.choices[0]?.message?.content
    if (!refinedContent) {
      console.warn('⚠️  No refinement received, returning raw vision analysis')
      return rawAnalysis
    }

    const refinedAnalysis = JSON.parse(refinedContent)
    console.log('✅ Dual-pass analysis complete')
    return refinedAnalysis

  } catch (error: any) {
    console.warn('⚠️  Refinement pass failed, falling back to raw vision analysis:', error.message)
    return rawAnalysis
  }
}

// GPT-4V analysis function for screenshots (wrapper for DRY)
async function analyzeScreenshotWithGPTV(
  screenshotPath: string,
  device: string,
  pageType: string,
  focusAreas: string[],
  apiKey: string
): Promise<any> {
  // Read screenshot file
  const fs = await import('fs/promises')
  const screenshotBuffer = await fs.readFile(join(process.cwd(), 'public', screenshotPath))
  const base64Image = screenshotBuffer.toString('base64')
  
  // Use the core analysis function
  return await analyzeImageWithGPTV(base64Image, device, pageType, focusAreas, apiKey)
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

// Normalization helpers (placed here for reuse)
function tryParseJSON(input: string): any | null { try { return JSON.parse(input) } catch { return null } }
function extractJSONFromText(text: string): any | null {
  if (!text || typeof text !== 'string') return null
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) {
    const parsed = tryParseJSON(fenced[1])
    if (parsed) return parsed
  }
  const braceIdx = text.indexOf('{')
  if (braceIdx !== -1) {
    const possible = text.slice(braceIdx)
    const parsed = tryParseJSON(possible)
    if (parsed) return parsed
  }
  return null
}
function normalizeUxAnalysis(analysis: any): any {
  if (!analysis) return analysis
  if (typeof analysis === 'string') {
    const parsed = extractJSONFromText(analysis)
    return parsed || { summary: analysis }
  }
  if (typeof analysis.summary === 'string') {
    const embedded = extractJSONFromText(analysis.summary)
    if (embedded && typeof embedded === 'object') {
      analysis = { ...embedded, ...analysis }
      if (embedded.summary) analysis.summary = embedded.summary
    }
  }
  if (!Array.isArray(analysis.recommendations)) analysis.recommendations = []
  analysis.recommendations = analysis.recommendations.map((r: any) => {
    if (!r) return r
    if (Array.isArray(r.links) && (!r.resources || r.resources.length === 0)) {
      r.resources = r.links
    }
    return r
  })
  return analysis
}
