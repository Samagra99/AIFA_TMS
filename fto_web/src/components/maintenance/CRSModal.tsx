import { useState } from 'react'
import { useIssueCRS } from '@/api/hooks/useMaintenance'
import { Modal, Button } from '@/components/ui'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { fmt } from '@/lib/utils'
import type { MaintenanceRecord } from '@/api/hooks/useMaintenance'

interface Props { record: MaintenanceRecord; open: boolean; onClose: () => void }

export function CRSModal({ record, open, onClose }: Props) {
  const issueCRS = useIssueCRS()
  const [confirmed, setConfirmed] = useState(false)

  const handleIssue = async () => {
    try {
      const res = await issueCRS.mutateAsync(record.id)
      toast.success(res.detail)
      onClose()
    } catch { toast.error('Failed to issue CRS') }
  }

  return (
    <Modal open={open} onClose={onClose} title="Issue Certificate of Release to Service" size="md">
      <div className="space-y-5">
        {/* Warning */}
        <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 dark:bg-amber-950 dark:border-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold mb-1">Regulatory Action</p>
            <p>Issuing a CRS confirms this aircraft is airworthy and legally cleared for flight under CAR-M regulations. The aircraft will be immediately available for scheduling across all bases.</p>
          </div>
        </div>

        {/* Record summary */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Aircraft',        record.aircraft_tail ?? record.aircraft],
            ['Maintenance type',record.maintenance_type.replace(/_/g,' ')],
            ['Performed',       fmt.date(record.performed_at_date)],
            ['At hours',        `${record.performed_at_hours} hr`],
            ['Next due hours',  record.next_due_hours ? `${record.next_due_hours} hr` : '—'],
            ['Next due date',   record.next_due_date  ? fmt.date(record.next_due_date) : '—'],
            ['AME Licence',     record.ame_licence_number ?? '—'],
            ['Work order',      record.work_order_number ?? '—'],
          ].map(([l,v]) => (
            <div key={String(l)}>
              <p className="text-xs text-slate-500">{l}</p>
              <p className="font-medium text-slate-900 dark:text-white capitalize">{v}</p>
            </div>
          ))}
        </div>

        {/* Confirmation checkbox */}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-primary-600" />
          <span className="text-sm text-slate-700 dark:text-slate-300">
            I certify that all maintenance tasks have been completed in accordance with the approved data, and the aircraft is fit for release to service.
          </span>
        </label>

        <div className="flex gap-3">
          <Button onClick={handleIssue} disabled={!confirmed} loading={issueCRS.isPending}
            className="flex-1 gap-2">
            <ShieldCheck className="h-4 w-4" />
            Issue CRS
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}
