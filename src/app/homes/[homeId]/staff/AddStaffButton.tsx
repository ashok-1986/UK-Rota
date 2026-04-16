'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { StaffForm } from '@/components/staff/StaffForm'

export function AddStaffButton({ homeId }: { homeId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        + Add Staff Member
      </Button>
      <StaffForm homeId={homeId} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
