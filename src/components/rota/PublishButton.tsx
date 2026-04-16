'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { formatWeekRange } from '@/lib/utils'
import type { RulesViolation } from '@/types'

interface PublishButtonProps {
  homeId: string
  weekStart: string
  draftCount: number
  onPublished: () => void
}

interface ViolationShift {
  shiftId: string
  staffId: string
  violations: { rule: string; message: string }[]
}

export function PublishButton({ homeId, weekStart, draftCount, onPublished }: PublishButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ published: number; unfilled: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [violations, setViolations] = useState<ViolationShift[]>([])
  const [showViolations, setShowViolations] = useState(false)

  async function handlePublish(override = false) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/rota/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeId, weekStart, override }),
      })
      const data = await res.json()
      
      if (res.status === 409 && data.code === 'RULES_VIOLATIONS') {
        setViolations(data.violations)
        setShowViolations(true)
        return
      }
      
      if (!res.ok) throw new Error(data.error ?? 'Failed to publish')
      setResult(data)
      onPublished()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleOverride() {
    await handlePublish(true)
    setShowViolations(false)
  }

  return (
    <>
      <Button
        variant="primary"
        size="md"
        disabled={draftCount === 0}
        onClick={() => setOpen(true)}
      >
        Publish Rota ({draftCount} draft{draftCount !== 1 ? 's' : ''})
      </Button>

      {/* Rule Violations Modal */}
      <Modal
        open={showViolations}
        onClose={() => setShowViolations(false)}
        title="Rules Violations Detected"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowViolations(false); setViolations([]) }}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleOverride}>
              Publish Anyway (Override)
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-amber-700">
            Some shift assignments violate UK Working Time Regulations:
          </p>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {violations.map((v, i) => (
              <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                <p className="font-medium text-red-800">Shift #{i + 1}</p>
                {v.violations.map((violation, j) => (
                  <p key={j} className="text-red-600">• {violation.message}</p>
                ))}
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-xs">
            Publishing anyway may expose the home to employment law risks. 
            Consider adjusting shifts to comply with regulations.
          </p>
        </div>
      </Modal>

      {/* Publish Confirmation Modal */}
      <Modal
        open={open}
        onClose={() => { setOpen(false); setResult(null); setError(null) }}
        title="Publish Rota"
        footer={
          result ? (
            <Button variant="primary" onClick={() => { setOpen(false); setResult(null) }}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" loading={loading} onClick={() => handlePublish(false)}>
                Confirm & Publish
              </Button>
            </>
          )
        }
      >
        {result ? (
          <div className="space-y-2">
            <p className="text-green-700 font-semibold">
              Rota published — {result.published} shift{result.published !== 1 ? 's' : ''} notified.
            </p>
            {result.unfilled > 0 && (
              <p className="text-amber-600">
                Warning: {result.unfilled} unfilled shift{result.unfilled !== 1 ? 's' : ''} remain.
                Managers have been alerted.
              </p>
            )}
          </div>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <div className="space-y-3">
            <p>
              You are about to publish the rota for the week of{' '}
              <strong>{formatWeekRange(weekStart)}</strong>.
            </p>
            <p>
              <strong>{draftCount}</strong> draft shift{draftCount !== 1 ? 's' : ''} will be marked
              as <em>Published</em> and staff will be notified.
            </p>
            <p className="text-gray-500 text-xs">
              Once published, staff can confirm their shifts. You can still edit assignments if needed.
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}