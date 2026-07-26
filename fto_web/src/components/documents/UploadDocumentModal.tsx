import { useState } from 'react'
import { Modal, Button } from '@/components/ui'
import { Upload, FileText } from 'lucide-react'
import { toast } from 'sonner'
import apiClient from '@/api/client'

interface UploadDocumentModalProps {
  open: boolean
  onClose: () => void
  targetType: 'instructor' | 'student'
  targetId: string
  userName: string
  onSuccess?: () => void
}

export function UploadDocumentModal({
  open, onClose, targetType, targetId, userName, onSuccess,
}: UploadDocumentModalProps) {
  const [docType, setDocType] = useState('spl')
  const [docNumber, setDocNumber] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please attach a scanned document file (PDF, JPG, PNG)')
      return
    }

    const formData = new FormData()
    formData.append('document_type', docType)
    if (docNumber) formData.append('document_number', docNumber)
    if (issueDate) formData.append('issue_date', issueDate)
    if (expiryDate) formData.append('expiry_date', expiryDate)
    if (notes) formData.append('notes', notes)
    formData.append('file', file)

    setLoading(true)
    try {
      const endpoint = targetType === 'instructor'
        ? `/users/instructors/${targetId}/documents/`
        : `/users/students/${targetId}/documents/`

      await apiClient.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      toast.success(`Scanned document uploaded successfully for ${userName}`)
      onSuccess?.()
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to upload document')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Upload Scanned Document — ${userName}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Document Type *</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="spl">Student Pilot Licence (SPL)</option>
              <option value="cpl">Commercial Pilot Licence (CPL)</option>
              <option value="atpl">Airline Transport Pilot Licence (ATPL)</option>
              <option value="fir_afir">Flight Instructor Rating (AFIR / FIR)</option>
              <option value="medical_class1">Class 1 Medical Certificate</option>
              <option value="medical_class2">Class 2 Medical Certificate</option>
              <option value="frtol">FRTOL Licence</option>
              <option value="ir_certificate">Instrument Rating (IR)</option>
              <option value="other">Other Credential</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Document / Licence #</label>
            <input
              type="text"
              value={docNumber}
              onChange={e => setDocNumber(e.target.value)}
              placeholder="e.g. CPL-12345 or MED-987"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Issue Date</label>
            <input
              type="date"
              value={issueDate}
              onChange={e => setIssueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Expiry Date</label>
            <input
              type="date"
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Scanned Document File (PDF / Image) *</label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 dark:file:bg-primary-950 dark:file:text-primary-300"
            />
          </div>
          {file && (
            <p className="text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Selected: {file.name} ({Math.round(file.size / 1024)} KB)
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Notes / Remarks</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional verification remarks…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={loading} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Upload Document
          </Button>
        </div>
      </form>
    </Modal>
  )
}
