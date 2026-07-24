import { useState } from 'react'
import { Modal, Button } from '@/components/ui'
import apiClient from '@/api/client'
import { Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  open: boolean
  onClose: () => void
  targetType: 'student' | 'instructor'
  targetId: string
  pilotName: string
}

export function ImportEGCALogbookModal({ open, onClose, targetType, targetId, pilotName }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported_count: number; previous_hours_total: number } | null>(null)
  const qc = useQueryClient()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select an eGCA Excel file (.xls or .xlsx).')
      return
    }

    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    const endpoint = targetType === 'student'
      ? `/users/students/${targetId}/import-egca-logbook/`
      : `/users/instructors/${targetId}/import-egca-logbook/`

    try {
      const res = await apiClient.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data)
      toast.success(res.data.detail || 'eGCA flight logbook imported successfully!')
      qc.invalidateQueries({ queryKey: [targetType === 'student' ? 'students' : 'instructors'] })
      qc.invalidateQueries({ queryKey: [targetType === 'student' ? 'student' : 'instructor', targetId] })
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to import eGCA Excel file.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Import Prior eGCA Logbook — ${pilotName}`} size="md">
      <div className="space-y-4">
        {/* Info box */}
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-3.5 dark:border-primary-800 dark:bg-primary-950">
          <div className="flex items-center gap-2 font-bold text-xs text-primary-900 dark:text-primary-100">
            <FileSpreadsheet className="h-4 w-4 text-primary-600" /> Official DGCA eGCA Flight Log Import
          </div>
          <p className="mt-1 text-xs text-primary-800 dark:text-primary-200">
            Upload the official 36-column DGCA eGCA flight log Excel export (.xls or .xlsx). The system will automatically parse past flight hours and update FDTL duty window limits.
          </p>
        </div>

        {/* File Dropzone */}
        <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
            {file ? file.name : 'Select or drag your eGCA Excel file here'}
          </p>
          <p className="text-[11px] text-slate-400 mb-3">Supports .xls and .xlsx formats (up to 10MB)</p>
          <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
            Browse File
            <input type="file" accept=".xls,.xlsx" onChange={handleFileChange} className="hidden" />
          </label>
        </div>

        {/* Result Callout */}
        {result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 dark:border-emerald-800 dark:bg-emerald-950/50">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-100">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Import Complete
            </div>
            <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
              Successfully imported <strong>{result.imported_count}</strong> flight log records. Baseline prior flying total updated to <strong>{result.previous_hours_total} hrs</strong>.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          {!result && (
            <Button size="sm" onClick={handleImport} loading={loading} disabled={!file}>
              Import eGCA Logbook
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
