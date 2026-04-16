import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'CareRota — Staff Scheduling for Care Homes',
  description: 'UK care home rota management. Replace spreadsheets with a simple, compliant scheduling tool.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en-GB">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
