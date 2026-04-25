'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { StaffForm } from '@/components/staff/StaffForm'
import { InviteStaffModal } from '@/components/staff/InviteStaffModal'

export function StaffActions({ homeId }: { homeId: string }) {
    const [showAdd, setShowAdd] = useState(false)
    const [showInvite, setShowInvite] = useState(false)

    return (
        <>
            <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowInvite(true)}>
                    ✉ Invite Staff
                </Button>
                <Button variant="primary" onClick={() => setShowAdd(true)}>
                    + Add Staff Member
                </Button>
            </div>
            <StaffForm homeId={homeId} open={showAdd} onClose={() => setShowAdd(false)} />
            {showInvite && (
                <InviteStaffModal homeId={homeId} onClose={() => setShowInvite(false)} />
            )}
        </>
    )
}
