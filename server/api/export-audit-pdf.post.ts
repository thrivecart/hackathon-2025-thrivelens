import { defineEventHandler, readBody } from 'h3'
import { generateAuditReportPDF, type AuditReportInput } from '../lib/pdf/audit-report-generator'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    if (!body || !body.audit) {
      return { ok: false, error: 'Missing audit data in request body (expected { audit: {...} })' }
    }

    const audit = body.audit as AuditReportInput

    // Basic validation
    if (!audit?.metadata?.url) {
      return { ok: false, error: 'audit.metadata.url is required' }
    }
    if (typeof audit.overallScore !== 'number') {
      return { ok: false, error: 'audit.overallScore must be a number (0-100)' }
    }

    const result = await generateAuditReportPDF(audit)

    return {
      ok: true,
      filename: result.filename,
      url: result.publicUrl
    }
  } catch (err: any) {
    console.error('export-audit-pdf error:', err)
    return { ok: false, error: 'Failed to generate PDF report' }
  }
})
