// =============================================================
// PDF generation — weekly rota
// Uses @react-pdf/renderer (pure Node, Vercel-compatible)
// =============================================================
import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import type { WeekView } from '@/types'
import { WeeklyRotaPDF } from '@/components/pdf/WeeklyRotaPDF'

/**
 * Renders a WeekView as a PDF buffer.
 * Call from a Next.js API route and stream the result.
 */
export async function generateWeeklyPDF(data: WeekView, homeName: string): Promise<Buffer> {
  const element = React.createElement(WeeklyRotaPDF, { data, homeName }) as React.ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)
  return buffer as unknown as Buffer
}
