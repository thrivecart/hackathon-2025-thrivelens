<template>
  <div class="flex flex-col min-h-full">
    <!-- Loading older messages indicator -->
    <div v-if="loadingOlder" class="flex justify-center py-2">
      <div class="flex items-center gap-2 text-muted text-sm">
        <span class="w-2 h-2 bg-muted rounded-full animate-bounce" style="animation-delay:0ms"></span>
        <span class="w-2 h-2 bg-muted rounded-full animate-bounce" style="animation-delay:150ms"></span>
        <span class="w-2 h-2 bg-muted rounded-full animate-bounce" style="animation-delay:300ms"></span>
        <span class="ml-1">Loading older messages...</span>
      </div>
    </div>
    
    <div class="flex-1 flex flex-col items-center w-full pt-4 pb-[200px] space-y-4">
      <div v-for="m in messages" :key="m.id" class="flex gap-2.5 max-w-screen-lg w-full px-4"
           :class="m.role === 'assistant' ? 'justify-start' : 'justify-end'">
        <div class="px-3 py-2.5 rounded-message border border-border"
             :class="m.role === 'assistant' ? 'bg-bg-soft' : 'bg-accent text-white'">
          <div class="text-xs text-muted mb-1.5"
               :class="m.role === 'assistant' ? 'text-text' : 'text-white'"
          >
            {{ m.role === 'assistant' ? 'ThriveLens' : 'You' }}
          </div>
          <div class="whitespace-pre-wrap break-words">
            <template v-if="m.assets && m.assets.length">
              <div v-for="(asset, j) in m.assets" :key="j">
                <!-- PDF Export Link -->
                <div v-if="asset.pdfUrl" class="my-3 p-3 border border-border rounded-lg bg-bg-soft">
                  <div class="flex items-center gap-3">
                    <div class="text-2xl">📄</div>
                    <div class="flex-1">
                      <div class="font-semibold text-text mb-1">Your audit report is ready!</div>
                      <a :href="asset.pdfUrl"
                         target="_blank"
                         rel="noopener noreferrer"
                         download
                         class="inline-flex items-center gap-2 text-accent hover:underline font-medium">
                        <span>{{ asset.pdfFilename || 'ThriveLens-Audit.pdf' }}</span>
                        <Icon icon="line-md:download-outline-loop" class="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                </div>
                <div v-if="asset.screenshotUrl" class="my-3">
                  <button type="button" @click="openLightbox(asset.screenshotUrl)"
                          class="group block rounded-lg border border-border overflow-hidden bg-bg-soft w-64 h-64 md:w-80 md:h-80">
                    <img :src="asset.screenshotUrl" alt="Website screenshot"
                         class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                         @load="onImageLoad" />
                  </button>
                  <div class="text-xs text-muted mt-1 capitalize">{{
                      asset.uxAnalysis?.device ? (asset.uxAnalysis.device + ' screenshot') : 'Screenshot'
                                                                  }}
                  </div>
                </div>
                <div v-if="asset.uxAnalysis" class="my-4 p-4 border border-border rounded-lg"
                     style="background: var(--bg)">
                  <div v-if="(asset.uxAnalysis.overallScore || asset.uxAnalysis.score)"
                       class="mb-3 score-badge"
                       :class="bandClass(asset.uxAnalysis.overallScore || asset.uxAnalysis.score)">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="text-xs font-medium opacity-70 mb-1">Overall UX Score</div>
                        <div class="flex items-baseline gap-1">
                          <span class="score-number">{{ asset.uxAnalysis.overallScore || asset.uxAnalysis.score }}</span>
                          <span class="score-denom">/100</span>
                          <span class="score-label">{{ bandLabel(asset.uxAnalysis.overallScore || asset.uxAnalysis.score) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-if="asset.uxAnalysis.summary" class="mb-4 p-3 rounded leading-relaxed"
                       style="background: var(--bg-soft)">{{ asset.uxAnalysis.summary }}
                  </div>
                  <div v-if="asset.uxAnalysis.recommendations && asset.uxAnalysis.recommendations.length" class="mt-4">
                    <h4 class="m-0 mb-3 text-text text-lg">Recommendations ({{
                        asset.uxAnalysis.device || 'page'
                                                           }}):</h4>
                    <div v-for="(rec, idx) in asset.uxAnalysis.recommendations" :key="idx"
                         class="my-3 p-3 rounded border-l-4"
                         :class="{
                           'border-l-red-500 bg-red-50 dark:bg-red-950 dark:border-l-red-400': rec.priority.toLowerCase() === 'high',
                           'border-l-amber-500 bg-amber-50 dark:bg-amber-950 dark:border-l-amber-400': rec.priority.toLowerCase() === 'medium',
                           'border-l-green-500 bg-green-50 dark:bg-green-950 dark:border-l-green-400': rec.priority.toLowerCase() === 'low',
                           'border-l-gray-500': !rec.priority || (rec.priority.toLowerCase() !== 'high' && rec.priority.toLowerCase() !== 'medium' && rec.priority.toLowerCase() !== 'low')
                         }"
                         :style="!rec.priority || (rec.priority !== 'high' && rec.priority !== 'medium' && rec.priority !== 'low') ? 'background: var(--bg-soft)' : ''">
                      <div class="flex justify-between items-center mb-2">
                        <strong>{{ rec.title }}</strong>
                        <span class="text-xs px-2 py-0.5 rounded-xl uppercase font-semibold"
                              :class="{
                                'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200': rec.priority.toLowerCase() === 'high',
                                'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200': rec.priority.toLowerCase() === 'medium',
                                'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200': rec.priority.toLowerCase() === 'low'
                              }">{{ rec.priority }}</span>
                      </div>
                      <p class="my-2 leading-relaxed text-text">{{ rec.description }}</p>
                      <div v-if="rec.expectedImpact || rec.impact" class="mt-2 text-sm text-muted">💡 {{
                          rec.expectedImpact || rec.impact
                                                                                                   }}
                      </div>
                      <!-- Alternatives section -->
                      <div v-if="rec.alternatives && rec.alternatives.length" class="mt-3 pt-3 border-t border-border">
                        <div class="text-xs font-semibold text-text mb-2 uppercase opacity-70">A/B Test Alternatives:</div>
                        <ul class="space-y-2">
                          <li v-for="(alt, altIdx) in rec.alternatives" :key="altIdx" 
                              class="text-sm text-text pl-4 relative before:content-['▸'] before:absolute before:left-0 before:text-accent before:font-bold">
                            {{ alt }}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            
            <!-- Show typing animation or full content -->
            <template v-if="m.isTyping && m.displayedContent !== undefined">
              {{ m.displayedContent }}<span class="inline-block w-1 h-4 bg-text animate-pulse ml-0.5"></span>
            </template>
            <template v-else>
              <span v-html="linkifyContent(m.content, m.role)"></span>
            </template>
          </div>
        </div>
      </div>
      <div v-if="loading" class="flex gap-2.5 w-full px-4 max-w-screen-lg w-full px-4 justify-start">
        <div class="px-3 py-2.5 rounded-message border border-border bg-bg-soft">
          <div class="text-xs text-muted mb-1.5">ThriveLens</div>
          <div class="flex items-center gap-1" aria-live="polite" aria-label="Thinking">
            <span class="w-2 h-2 bg-muted rounded-full animate-bounce" style="animation-delay:0ms"></span>
            <span class="w-2 h-2 bg-muted rounded-full animate-bounce" style="animation-delay:150ms"></span>
            <span class="w-2 h-2 bg-muted rounded-full animate-bounce" style="animation-delay:300ms"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Sticky input area with backdrop -->
    <div class="fixed bottom-0 left-0 right-0">
      <div class="max-w-screen-lg mx-auto px-4 py-4 pt-0 bg-bg">
        <!-- Image preview -->
        <div v-if="imagePreviewUrl" class="mb-2 relative inline-block">
          <img :src="imagePreviewUrl" alt="Preview"
               class="max-w-[200px] max-h-[200px] rounded-lg border border-border" />
          <button
              @click="removeImage"
              class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
              aria-label="Remove image"
          >×
          </button>
        </div>

        <div class="bg-bg-soft border border-border rounded-full py-2 px-5 flex flex-row align-middle gap-2 items-end">
          <!-- Hidden file input -->
          <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              @change="handleFileSelect"
              class="hidden"
          />

          <button
              type="button"
              @click="triggerFileInput"
              :disabled="loading"
              class="dark:text-white rounded-full w-12 h-12 text-muted hover:text-text transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Icon icon="line-md:plus" class="w-7 h-7" />
          </button>

          <textarea
              v-model="prompt"
              class="flex-1 resize-none bg-transparent text-text border-0 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              placeholder="Enter your prompt here or paste an image..."
              rows="1"
              style="min-height: 35px; max-height: 160px; overflow: auto;"
              @keydown.enter.exact.prevent="run"
              @paste="handlePaste"
              :disabled="loading"
          ></textarea>

          <div class="flex gap-2 items-center">
            <!-- Send button -->
            <button
                class="w-[150px] bg-accent text-white border border-transparent px-3.5 py-2.5 rounded-full font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                @click="run"
                :disabled="loading"
            >{{ loading ? 'Processing...' : 'Send' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Lightbox overlay -->
    <div v-if="lightboxUrl" class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
         @click="closeLightbox" role="dialog" aria-modal="true">
      <div class="relative" @click.stop>
        <button class="absolute -top-3 -right-3 z-10 bg-white/90 text-gray-900 rounded-full w-8 h-8 shadow hover:bg-white"
                @click="closeLightbox" aria-label="Close">✕
        </button>
        <!-- Scrollable container for image -->
        <div class="overflow-auto rounded-lg shadow-xl border border-border bg-bg overscroll-contain" style="max-width: 90vw; max-height: 90vh;">
          <img :src="lightboxUrl" alt="Screenshot preview" 
               class="block select-none" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from "@iconify/vue";

interface MessageAsset {
  screenshotUrl?: string
  pdfUrl?: string
  pdfFilename?: string
  uxAnalysis?: {
    overallScore?: number | null
    score?: number | null
    device?: string | null
    summary?: string
    recommendations?: Array<{
      title: string
      description: string
      priority: string
      expectedImpact?: string
      impact?: string
      resources?: string[]
      links?: string[]
    }>
  } | null
}

interface Message {
  id?: string
  role: 'user' | 'assistant' | 'progress'
  content: string
  assets?: MessageAsset[]
  status?: string
  isTyping?: boolean
  displayedContent?: string
  timestamp?: string
}
// Component state
const sessionId = ref<string>('')
const prompt = ref('')
const loading = ref(false)
const loadingOlder = ref(false)
const shouldAutoScroll = ref(true) // Flag to control auto-scroll behavior
const uploadedImage = ref<string | null>(null)
const imagePreviewUrl = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const lightboxUrl = ref<string | null>(null)
const isTyping = ref(false)

// Pagination state
const hasMore = ref(false)
const oldestMessageId = ref<string | null>(null)

// Chat messages
const messages = ref<Message[]>([
  {
    role: 'assistant',
    content: 'How can I help you?'
  }
])

const props = defineProps<{
  scrollContainer?: HTMLElement | null
  loadSessionId?: string
}>()

const emit = defineEmits<{
  'session-updated': [sessionId: string]
}>()

function openLightbox(url: string) {
  lightboxUrl.value = url
}

function closeLightbox() {
  lightboxUrl.value = null
}

function scrollToBottom() {
  nextTick(() => {
    const container = props.scrollContainer
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
    }
  })
}

function onImageLoad() {
  // Only scroll to bottom if we're not loading older messages
  if (!loadingOlder.value && shouldAutoScroll.value) {
    scrollToBottom()
  }
}

// Only auto-scroll when not typing AND not loading older messages
watch(messages, () => {
  if (!isTyping.value && !loadingOlder.value && shouldAutoScroll.value) {
    scrollToBottom()
  }
}, { deep: true })

watch(loading, () => {
  if (!isTyping.value && !loadingOlder.value && shouldAutoScroll.value) {
    nextTick(scrollToBottom)
  }
})

// Load session messages when loadSessionId changes
watch(() => props.loadSessionId, async (newSessionId, oldSessionId) => {
  console.log('[ChatStream] loadSessionId changed:', { newSessionId, oldSessionId })
  
  if (!newSessionId) {
    // Clear messages for new session
    messages.value = [{ role: 'assistant', content: 'How can I help you?' }]
    sessionId.value = ''
    hasMore.value = false
    oldestMessageId.value = null
    return
  }
  
  if (newSessionId === oldSessionId) return
  
  // Load messages for the selected session
  try {
    const response = await fetch(`/api/sessions/${newSessionId}/messages?limit=20`)
    const data = await response.json()
    
    if (data.messages && data.messages.length > 0) {
      messages.value = data.messages
      hasMore.value = data.hasMore || false
      oldestMessageId.value = data.messages[0]?.id || null
      sessionId.value = newSessionId
      scrollToBottom()
    }
  } catch (error) {
    console.error('Failed to load session messages:', error)
    messages.value = [{ role: 'assistant', content: 'Failed to load session. Please try again.' }]
  }
}, { immediate: true })

// Infinite scroll for loading older messages
let scrollTimeout: number | null = null
const TOP_SCROLL_THRESHOLD = 100

let currentScrollContainer: HTMLElement | null = null
let currentScrollListener: ((e: Event) => void) | null = null

function detachScrollListener() {
  if (currentScrollContainer && currentScrollListener) {
    currentScrollContainer.removeEventListener('scroll', currentScrollListener as EventListener)
  }
  currentScrollContainer = null
  currentScrollListener = null
}

function attachScrollListener(el: HTMLElement) {
  detachScrollListener()
  currentScrollContainer = el

  currentScrollListener = () => {
    if (!currentScrollContainer) return

    // Throttle using existing scrollTimeout
    if (scrollTimeout) return
    scrollTimeout = window.setTimeout(async () => {
      scrollTimeout = null
      if (!currentScrollContainer) return
      if (loadingOlder.value || !hasMore.value) return

      // Within 100px of top? Load older messages
      if (currentScrollContainer.scrollTop <= TOP_SCROLL_THRESHOLD) {
        await loadOlderMessages()
      }
    }, 150)
  }

  el.addEventListener('scroll', currentScrollListener as EventListener, { passive: true })
}

// React to the scrollContainer ref availability/changes
watch(
  () => props.scrollContainer,
  (el, prev) => {
    // Clean up old listener if container changed or became null
    if (prev && prev !== el) {
      detachScrollListener()
    }
    if (!el) {
      // Container not mounted yet or got removed
      detachScrollListener()
      return
    }
    // Attach to new container
    attachScrollListener(el as HTMLElement)
  },
  { immediate: true }
)

// Load older messages with scroll position preservation
async function loadOlderMessages() {
  if (!oldestMessageId.value || !sessionId.value || loadingOlder.value) return
  
  // Disable auto-scroll during this operation
  shouldAutoScroll.value = false
  loadingOlder.value = true
  
  const container = props.scrollContainer
  if (!container) {
    loadingOlder.value = false
    shouldAutoScroll.value = true
    return
  }
  
  const previousScrollHeight = container.scrollHeight
  const previousScrollTop = container.scrollTop
  
  try {
    const response = await fetch(
      `/api/sessions/${sessionId.value}/messages?limit=20&before=${oldestMessageId.value}`
    )
    const data = await response.json()
    
    if (data.messages && data.messages.length > 0) {
      // Prepend older messages
      messages.value = [...data.messages, ...messages.value]
      hasMore.value = data.hasMore || false
      oldestMessageId.value = data.messages[0]?.id || null
      
      // Wait for DOM to update, then preserve scroll position
      await nextTick()
      
      // Use requestAnimationFrame to ensure scroll happens after browser layout
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight
            const heightDifference = newScrollHeight - previousScrollHeight
            const newScrollTop = previousScrollTop + heightDifference
            
            // Maintain user's relative position by offsetting by the height added
            container.scrollTop = newScrollTop
            
            // Wait one more frame to ensure scroll position is applied
            requestAnimationFrame(() => {
              resolve()
            })
          } else {
            resolve()
          }
        })
      })
    } else {
      hasMore.value = false
    }
  } catch (error) {
    console.error('Failed to load older messages:', error)
  } finally {
    // Reset flags after scroll position is set
    await nextTick()
    loadingOlder.value = false
    shouldAutoScroll.value = true
  }
}

// Setup keyboard listener on mount
let escHandler: ((e: KeyboardEvent) => void) | null = null
onMounted(() => {
  escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox()
  }
  window.addEventListener('keydown', escHandler)
})

onBeforeUnmount(() => {
  // Detach scroll listener safely
  detachScrollListener()
  
  // Clear throttle timeout if pending
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
    scrollTimeout = null
  }
  
  // Clean up Escape key listener
  if (escHandler) {
    window.removeEventListener('keydown', escHandler)
    escHandler = null
  }
})

// Utility functions
function addUserMessage(content: string) {
  messages.value.push({ role: 'user', content })
}

function startTypingAnimation(msgIndex: number, content: string) {
  isTyping.value = true
  
  const chunkSize = 7
  const typingSpeed = 30
  let currentIndex = 0
  
  const typeInterval = setInterval(() => {
    if (currentIndex < content.length) {
      const nextIndex = Math.min(currentIndex + chunkSize, content.length)
      const displayText = content.substring(0, nextIndex)
      if (messages.value[msgIndex]) {
        messages.value[msgIndex].displayedContent = displayText
      }
      currentIndex = nextIndex
    } else {
      if (messages.value[msgIndex]) {
        messages.value[msgIndex].isTyping = false
        messages.value[msgIndex].displayedContent = content
      }
      isTyping.value = false
      clearInterval(typeInterval)
    }
  }, typingSpeed)
}

// Handle file upload
function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      uploadedImage.value = result
      imagePreviewUrl.value = result
    }
    reader.readAsDataURL(file)
  }
}

// Handle paste from clipboard
function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault()
      const file = item.getAsFile()
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          uploadedImage.value = result
          imagePreviewUrl.value = result
        }
        reader.readAsDataURL(file)
      }
      break
    }
  }
}

// Remove uploaded image
function removeImage() {
  uploadedImage.value = null
  imagePreviewUrl.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

// Trigger file input
function triggerFileInput() {
  fileInputRef.value?.click()
}

// Score band helpers
function bandClass(s: number): string {
  if (s >= 80) return 'band-green'
  if (s >= 60) return 'band-blue'
  if (s >= 40) return 'band-amber'
  return 'band-red'
}

function bandLabel(s: number): string {
  if (s >= 80) return 'Excellent'
  if (s >= 60) return 'Strong'
  if (s >= 40) return 'Needs polish'
  return 'Needs work'
}

// Convert URLs and Markdown lists to HTML
function linkifyContent(text: string, role?: string): string {
  if (!text) return ''
  
  // Use white text for user messages (which have accent background), accent color for others
  const linkClass = role === 'user' ? 'text-white hover:underline' : 'text-accent hover:underline'
  
  // Step 1: Convert links
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi
  let formatted = text.replace(urlRegex, (url) => {
    const href = url.startsWith('www.') ? `https://${url}` : url
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${linkClass}">${url}</a>`
  })
  
  // Step 2: Convert unordered lists (-, *, _)
  // Match lines starting with -, *, or _ followed by space
  const unorderedListRegex = /^([\-\*_])\s+(.+)$/gm
  const ulItems: string[] = []
  let inUl = false
  
  formatted = formatted.split('\n').map(line => {
    const ulMatch = line.match(/^([\-\*_])\s+(.+)$/)
    if (ulMatch) {
      ulItems.push(`<li class="ml-5">${ulMatch[2]}</li>`)
      inUl = true
      return '___UL_ITEM___' // Placeholder
    } else if (inUl && ulItems.length > 0) {
      // End of list
      const listHtml = `<ul class="list-disc my-1 ml-4">${ulItems.join('')}</ul>`
      ulItems.length = 0
      inUl = false
      return line.trim() ? listHtml + '\n' + line : listHtml
    }
    return line
  }).join('\n')
  
  // Handle case where list is at the end
  if (ulItems.length > 0) {
    formatted = formatted.replace(/___UL_ITEM___/g, '')
    formatted += `<ul class="list-disc my-1 ml-4">${ulItems.join('')}</ul>`
  } else {
    formatted = formatted.replace(/___UL_ITEM___/g, '')
  }
  
  // Step 3: Convert ordered lists (1. 2. 3.)
  const orderedListRegex = /^\d+\.\s+(.+)$/gm
  const olItems: string[] = []
  let inOl = false
  
  formatted = formatted.split('\n').map(line => {
    const olMatch = line.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      olItems.push(`<li class="ml-5">${olMatch[1]}</li>`)
      inOl = true
      return '___OL_ITEM___' // Placeholder
    } else if (inOl && olItems.length > 0) {
      // End of list
      const listHtml = `<ol class="list-decimal my-1 ml-4">${olItems.join('')}</ol>`
      olItems.length = 0
      inOl = false
      return line.trim() ? listHtml + '\n' + line : listHtml
    }
    return line
  }).join('\n')
  
  // Handle case where list is at the end
  if (olItems.length > 0) {
    formatted = formatted.replace(/___OL_ITEM___/g, '')
    formatted += `<ol class="list-decimal my-1 ml-4">${olItems.join('')}</ol>`
  } else {
    formatted = formatted.replace(/___OL_ITEM___/g, '')
  }
  
  // Step 4: Clean up multiple consecutive newlines (reduce to max 2)
  formatted = formatted.replace(/\n{3,}/g, '\n\n')
  
  return formatted
}

async function run() {
  const q = prompt.value.trim()
  const hasImage = !!uploadedImage.value

  if (!q && !hasImage) return
  if (loading.value) return

  // Add user message with image indicator if present
  const userMsg = hasImage ? (q || 'Analyze this image') + ' 📷' : q
  addUserMessage(userMsg)

  const imageToSend = uploadedImage.value

  prompt.value = ''
  removeImage() // Clear image after sending
  loading.value = true
  scrollToBottom()

  try {
    // Send sessionId and query only (backend manages context)
    const requestBody: any = {
      sessionId: sessionId.value,
      query: q || 'Analyze the provided image'
    }

    // Add image data if present
    if (imageToSend) {
      requestBody.imageData = imageToSend
    }

    const response = await fetch('/api/chat-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    // Store sessionId from server and emit to parent
    if (result.sessionId) {
      if (!sessionId.value) {
        sessionId.value = result.sessionId
        console.log('[ChatStream] Received sessionId from server:', sessionId.value)
      }
      // Emit to parent so sidebar can refresh
      emit('session-updated', result.sessionId)
    }

    let content = ''
    const assets: MessageAsset[] = []

    if (Array.isArray(result.messages)) {
      const final = result.messages.find((msg: any) => msg.type === 'final') || result.messages[result.messages.length - 1]
      if (final) {
        content = final.content || ''
      }
      for (const msg of result.messages) {
        // Handle PDF exports
        if (msg && msg.type === 'pdf_export' && msg.pdfUrl) {
          assets.push({ pdfUrl: msg.pdfUrl, pdfFilename: msg.pdfFilename })
        }
        // Handle UX audit results
        if (msg && (msg.screenshotUrl || msg.uxAnalysis)) {
          let ux = msg.uxAnalysis
          try {
            if (ux && typeof ux === 'string') ux = JSON.parse(ux)
            if (ux && typeof ux.recommendations === 'string') ux.recommendations = JSON.parse(ux.recommendations)
          } catch {
          }
          // Map "links" to "resources" inside recommendations for uniform rendering
          try {
            if (ux && Array.isArray(ux.recommendations)) {
              ux.recommendations = ux.recommendations.map((r: any) => {
                if (r && Array.isArray(r.links) && (!r.resources || r.resources.length === 0)) {
                  return { ...r, resources: r.links }
                }
                return r
              })
            }
          } catch {
          }
          assets.push({ screenshotUrl: msg.screenshotUrl, uxAnalysis: ux })
        }
      }
    } else if (result.message || result.content) {
      content = result.message || result.content
      const ux = (result as any).uxAnalysis
      let normUx = ux
      try {
        if (normUx && typeof normUx === 'string') normUx = JSON.parse(normUx)
        if (normUx && typeof normUx.recommendations === 'string') normUx.recommendations = JSON.parse(normUx.recommendations)
        if (normUx && Array.isArray(normUx.recommendations)) {
          normUx.recommendations = normUx.recommendations.map((r: any) => {
            if (r && Array.isArray(r.links) && (!r.resources || r.resources.length === 0)) {
              return { ...r, resources: r.links }
            }
            return r
          })
        }
      } catch {
      }
      if ((result as any).screenshotUrl || normUx) assets.push({
        screenshotUrl: (result as any).screenshotUrl,
        uxAnalysis: normUx
      })
    } else {
      throw new Error('Invalid response format')
    }

    // Add assistant message with assets immediately visible, text with typing effect
    const msgIndex = messages.value.length
    messages.value.push({ 
      role: 'assistant', 
      content, 
      assets, // Assets appear immediately
      isTyping: content.length > 0, // Only enable typing if there's text content
      displayedContent: ''
    })

    loading.value = false
    scrollToBottom() // Scroll to show assets immediately

    // Start typing animation for text content
    if (content.length > 0) {
      startTypingAnimation(msgIndex, content)
    } else {
      // No text content, just show assets
      if (messages.value[msgIndex]) {
        messages.value[msgIndex].isTyping = false
        messages.value[msgIndex].displayedContent = content
      }
    }

  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `Error: ${e?.message || 'Something went wrong.'}` })
    loading.value = false
  }
}
</script>

<style scoped>
.score-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.08);
  font-weight: 700;
  line-height: 1.2;
}
.score-number { 
  font-size: 28px; 
  font-weight: 800; 
}
.score-denom { 
  opacity: 0.7; 
  font-weight: 600; 
  font-size: 16px;
}
.score-label { 
  margin-left: 8px; 
  font-weight: 600; 
  opacity: 0.9; 
  font-size: 14px;
}

/* Color bands */
.band-green { 
  background-color: rgba(16,185,129,0.12); 
  border-color: rgba(16,185,129,0.35); 
  color: #0f9d75; 
}
.band-blue { 
  background-color: rgba(59,130,246,0.12); 
  border-color: rgba(59,130,246,0.35); 
  color: #2f6df6; 
}
.band-amber { 
  background-color: rgba(245,158,11,0.12); 
  border-color: rgba(245,158,11,0.35); 
  color: #b26b00; 
}
.band-red { 
  background-color: rgba(239,68,68,0.12); 
  border-color: rgba(239,68,68,0.35); 
  color: #b63232; 
}

/* Dark mode adjustments */
:root.dark .band-green {
  background-color: rgba(16,185,129,0.15);
  border-color: rgba(16,185,129,0.4);
  color: #34d399;
}
:root.dark .band-blue {
  background-color: rgba(59,130,246,0.15);
  border-color: rgba(59,130,246,0.4);
  color: #60a5fa;
}
:root.dark .band-amber {
  background-color: rgba(245,158,11,0.15);
  border-color: rgba(245,158,11,0.4);
  color: #fbbf24;
}
:root.dark .band-red {
  background-color: rgba(239,68,68,0.15);
  border-color: rgba(239,68,68,0.4);
  color: #f87171;
}
</style>
