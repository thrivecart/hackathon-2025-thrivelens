import path from 'path'
import fs from 'fs'
import fsp from 'fs/promises'
import { jsPDF } from 'jspdf'
export type DeviceType = 'desktop' | 'mobile' | 'tablet'

export interface AuditMetadata {
  url: string
  date: string // ISO
  deviceType: DeviceType | 'multi-device'
  pageType?: string
}

export interface CategoryScore {
  name: string
  score: number // 0-100
  summary?: string
}

export interface Recommendation {
  title: string
  description: string
  expectedImpact: string
  priority: 'high' | 'medium' | 'low'
}

export interface AuditReportInput {
  metadata: AuditMetadata
  overallScore: number        // 0-100
  summary: string
  categoryScores?: CategoryScore[]
  strengths?: string[]
  weaknesses?: string[]
  recommendations: Recommendation[]
}

export interface GeneratePdfResult {
  filename: string
  filePath: string
  publicUrl: string
}

const ACCENT = '#28c8c6'
const COLORS = {
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  lightBg: '#F9FAFB',
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981'
}

function sanitizeDomain(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/[^a-z0-9.-]/gi, '-').replace(/\.+/g, '.')
  } catch {
    return 'website'
  }
}

async function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    await fsp.mkdir(dirPath, { recursive: true })
  }
}

async function loadLogoBase64(): Promise<string | null> {
  const logoPath = path.resolve(process.cwd(), 'public', 'images', 'logo.png')
  try {
    const buf = await fsp.readFile(logoPath)
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}


function nowTimestamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function addSectionTitle(doc: jsPDF, text: string, x: number, y: number): number {
  doc.setTextColor(COLORS.text)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(text, x, y)
  return y + 8
}

function addKeyValue(doc: jsPDF, key: string, value: string, x: number, y: number, pageWidth: number, margin: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(COLORS.muted)
  doc.text(key, x, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(COLORS.text)
  const valY = y
  const maxWidth = pageWidth - margin - x
  const lines = doc.splitTextToSize(value, maxWidth)
  doc.text(lines, x + 80, valY)
  const addY = Math.max(14, (lines.length * 12))
  return y + addY
}

function addProgressBar(doc: jsPDF, x: number, y: number, width: number, height: number, percent: number, color = ACCENT) {
  doc.setDrawColor(COLORS.border)
  doc.setFillColor('#FFFFFF')
  doc.roundedRect(x, y, width, height, 2, 2, 'S')

  const fillWidth = Math.max(0, Math.min(width, (percent / 100) * width))
  doc.setFillColor(color)
  doc.roundedRect(x, y, fillWidth, height, 2, 2, 'F')

  doc.setTextColor(COLORS.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${Math.round(percent)}%`, x + width + 8, y + height - 2)
}

function ensureSpace(doc: jsPDF, needed: number, y: number, margin: number): number {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - margin) {
    doc.addPage()
    return margin
  }
  return y
}

function addFooterToAllPages(doc: jsPDF, disclaimer: string, generatedAt: string) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 48

    // Separator line
    doc.setDrawColor(COLORS.border)
    doc.setLineWidth(0.5)
    doc.line(margin, pageHeight - margin - 20, pageWidth - margin, pageHeight - margin - 20)

    // Disclaimer
    doc.setTextColor(COLORS.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(disclaimer, pageWidth - margin * 2)
    doc.text(lines, margin, pageHeight - margin - 8)

    // Timestamp and page number
    const pageLabel = `Page ${i} of ${pageCount}`
    doc.text(generatedAt, margin, pageHeight - margin + 8)
    const metrics = doc.getTextDimensions(pageLabel)
    doc.text(pageLabel, pageWidth - margin - metrics.w, pageHeight - margin + 8)
  }
}

function normalizePriority(priority?: string): 'high' | 'medium' | 'low' {
  const p = (priority || 'low').toLowerCase()
  if (p === 'high') return 'high'
  if (p === 'medium') return 'medium'
  return 'low'
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export async function generateAuditReportPDF(audit: AuditReportInput): Promise<GeneratePdfResult> {
  // Prep filesystem
  const outDir = path.resolve(process.cwd(), 'public', 'exports')
  await ensureDir(outDir)

  const domain = sanitizeDomain(audit.metadata.url)
  const timestamp = nowTimestamp()
  // Unique filename to avoid collisions while retaining requested base format
  const filename = `ThriveLens-Audit-${domain}-${timestamp}.pdf`
  const filePath = path.join(outDir, filename)
  const publicUrl = `/exports/${filename}`

  // Init PDF
  const doc = new jsPDF({ unit: 'pt', format: 'letter' }) // 612 x 792 pt
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  let y = margin

  // Header
  const logoBase64 = await loadLogoBase64()
  const logoSize = 36
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, y, logoSize, logoSize, undefined, 'FAST')
  } else {
    // Placeholder if logo missing
    doc.setFillColor(ACCENT)
    doc.circle(margin + logoSize / 2, y + logoSize / 2, logoSize / 2, 'F')
  }

  // Title block
  doc.setTextColor(ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text('ThriveLens', margin + logoSize + 12, y + 24)

  doc.setTextColor(COLORS.text)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('UX Audit Report', margin + logoSize + 15, y + 42)

  y += logoSize + 40

  // Metadata
  y = addKeyValue(doc, 'URL:', audit.metadata.url, margin, y, pageWidth, margin)
  y = addKeyValue(doc, 'Date:', new Date(audit.metadata.date || Date.now()).toLocaleString(), margin, y, pageWidth, margin)
  if (audit.metadata.deviceType) y = addKeyValue(doc, 'Device:', capitalizeFirst(audit.metadata.deviceType), margin, y, pageWidth, margin)
  if (audit.metadata.pageType) y = addKeyValue(doc, 'Page Type:', capitalizeFirst(audit.metadata.pageType), margin, y, pageWidth, margin)

  y = ensureSpace(doc, 24, y + 8, margin) + 10

  // Executive Summary
  y = addSectionTitle(doc, 'Executive Summary', margin, y)
  y += 20

  // Overall Score
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(COLORS.text)
  doc.setFontSize(12)
  doc.text(`Overall UX Score: ${Math.round(audit.overallScore)}/100`, margin, y)

  // Score progress bar
  y += 10
  addProgressBar(doc, margin, y, 240, 12, audit.overallScore, ACCENT)
  y += 35

  // Summary paragraph
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const summaryLines = doc.splitTextToSize(audit.summary || 'No summary provided.', pageWidth - margin * 2)
  doc.text(summaryLines, margin, y)
  y += summaryLines.length * 14 + 15

  // Category scores grid (2 columns)
  if (audit.categoryScores?.length) {
    y = ensureSpace(doc, 24, y, margin)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Category Scores', margin, y)
    y += 25

    const colWidth = (pageWidth - margin * 2 - 24) / 2
    const rowHeight = 40
    for (let i = 0; i < audit.categoryScores.length; i++) {
      const col = i % 2
      if (col === 0) {
        y = ensureSpace(doc, rowHeight + 12, y, margin)
      }
      const x = margin + col * (colWidth + 24)

      const cs = audit.categoryScores[i]
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(COLORS.text)
      doc.setFontSize(11)
      doc.text(cs.name, x, y)

      addProgressBar(doc, x, y + 6, colWidth - 60, 10, cs.score, ACCENT)

      if (col === 1) {
        y += rowHeight
      }
    }
    if (audit.categoryScores.length % 2 === 1) {
      y += rowHeight
    }
  }

  y = ensureSpace(doc, 24, y + 8, margin)

  // Strengths
  if (audit.strengths && audit.strengths.length > 0) {
    y = addSectionTitle(doc, 'Strengths', margin, y)
    y += 10

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(COLORS.text)

    for (const strength of audit.strengths) {
      y = ensureSpace(doc, 20, y, margin)
      
      // Bullet point
      doc.setFillColor(ACCENT)
      doc.circle(margin + 3, y - 3, 2, 'F')
      
      // Text
      const lines = doc.splitTextToSize(strength, pageWidth - margin * 2 - 15)
      doc.text(lines, margin + 12, y)
      y += lines.length * 14 + 4
    }

    y += 10
  }

  // Weaknesses
  if (audit.weaknesses && audit.weaknesses.length > 0) {
    y = ensureSpace(doc, 24, y, margin)
    y = addSectionTitle(doc, 'Weaknesses', margin, y)
    y += 10

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(COLORS.text)

    for (const weakness of audit.weaknesses) {
      y = ensureSpace(doc, 20, y, margin)
      
      // Bullet point
      doc.setFillColor(COLORS.high)
      doc.circle(margin + 3, y - 3, 2, 'F')
      
      // Text
      const lines = doc.splitTextToSize(weakness, pageWidth - margin * 2 - 15)
      doc.text(lines, margin + 12, y)
      y += lines.length * 14 + 4
    }

    y += 10
  }

  y = ensureSpace(doc, 24, y, margin)

  // Recommendations
  y = addSectionTitle(doc, 'Recommendations', margin, y)
  y += 6

  const badgeColor = (p: 'high' | 'medium' | 'low') => {
    if (p === 'high') return COLORS.high
    if (p === 'medium') return COLORS.medium
    return COLORS.low
  }

  for (const rec of (audit.recommendations || [])) {
    y = ensureSpace(doc, 90, y + 6, margin)

    // Card
    const cardX = margin
    const cardW = pageWidth - margin * 2

    // Title
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(COLORS.text)
    doc.text(rec.title, cardX, y)

    // Priority badge
    const priority = normalizePriority(rec.priority)
    const badge = capitalizeFirst(priority)
    const badgeW = Math.max(42, doc.getTextDimensions(badge).w + 12)
    doc.setFillColor(badgeColor(priority))
    doc.roundedRect(cardX + cardW - badgeW, y - 10, badgeW, 16, 4, 4, 'F')
    doc.setTextColor('#FFFFFF')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(badge, cardX + cardW - badgeW + 6, y + 2)

    y += 20

    // Description
    doc.setTextColor(COLORS.text)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    const descLines = doc.splitTextToSize(rec.description || 'No description provided.', cardW)
    doc.text(descLines, cardX, y)
    y += descLines.length * 14 + 4

    // Expected impact
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(COLORS.muted)
    doc.text('Expected impact:', cardX, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(COLORS.text)
    doc.setFontSize(11)
    // Calculate remaining width after the label (96px offset + some padding)
    const impactLines = doc.splitTextToSize(rec.expectedImpact || 'Not specified.', cardW - 100)
    doc.text(impactLines, cardX + 100, y)
    y += impactLines.length * 14 + 10

    // Divider
    doc.setDrawColor(COLORS.border)
    doc.setLineWidth(0.5)
    doc.line(cardX, y, cardX + cardW, y)
    y += 15
  }


  // Footer across all pages
  const disclaimer = 'This automated UX audit is provided for informational purposes. Please review recommendations carefully before implementation.'
  const generatedAt = new Date().toLocaleString()
  addFooterToAllPages(doc, disclaimer, generatedAt)

  // Save to disk (Node)
  const arrayBuffer = doc.output('arraybuffer')
  await fsp.writeFile(filePath, Buffer.from(arrayBuffer))

  return { filename, filePath, publicUrl }
}
