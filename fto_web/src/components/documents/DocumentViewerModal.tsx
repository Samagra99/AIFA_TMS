import { useState } from 'react'
import { Modal, Badge } from '@/components/ui'
import { FileText, ExternalLink } from 'lucide-react'
import type { UserDocument } from '@/api/types'
import { fmt } from '@/lib/utils'

interface DocumentViewerModalProps {
  open: boolean
  onClose: () => void
  userName: string
  documents: UserDocument[]
}

export function DocumentViewerModal({
  open, onClose, userName, documents,
}: DocumentViewerModalProps) {
  const [selectedDoc, setSelectedDoc] = useState<UserDocument | null>(
    documents && documents.length > 0 ? documents[0] : null
  )

  const activeDoc = selectedDoc || (documents && documents.length > 0 ? documents[0] : null)

  const isPdf = activeDoc?.file_url?.toLowerCase().endsWith('.pdf')

  return (
    <Modal open={open} onClose={onClose} title={`Scanned Licences & Credentials — ${userName}`} size="xl">
      <div className="space-y-4">
        {documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <FileText className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No Scanned Documents Uploaded</p>
            <p className="text-xs text-slate-500 mt-1">Upload scanned copies of licence, ratings, or medical certificates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Document list sidebar */}
            <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Available Documents ({documents.length})</p>
              {documents.map(doc => {
                const isSelected = activeDoc?.id === doc.id
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 dark:border-primary-400'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                        {doc.document_type_label || doc.document_type.replace('_', ' ')}
                      </span>
                      <Badge variant={doc.status === 'valid' ? 'success' : doc.status === 'expiring_soon' ? 'warning' : 'danger'}>
                        {doc.status}
                      </Badge>
                    </div>
                    {doc.document_number && (
                      <p className="text-xs font-mono text-slate-500 mt-1">#{doc.document_number}</p>
                    )}
                    {doc.expiry_date && (
                      <p className="text-[11px] text-slate-400 mt-0.5">Exp: {fmt.date(doc.expiry_date)}</p>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Document preview panel */}
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-900 p-3 min-h-[420px] flex flex-col justify-between dark:border-slate-700">
              {activeDoc ? (
                <>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-white">
                    <div>
                      <p className="text-xs font-bold capitalize">{activeDoc.document_type_label || activeDoc.document_type}</p>
                      <p className="text-[11px] text-slate-400">Uploaded {fmt.date(activeDoc.uploaded_at)}</p>
                    </div>
                    {activeDoc.file_url && (
                      <a
                        href={activeDoc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary-400 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open File
                      </a>
                    )}
                  </div>

                  <div className="flex-1 flex items-center justify-center bg-slate-950 rounded-lg overflow-hidden p-2">
                    {activeDoc.file_url ? (
                      isPdf ? (
                        <object
                          data={activeDoc.file_url}
                          type="application/pdf"
                          className="w-full h-[330px] rounded border-0"
                        >
                          <div className="text-center p-6 text-slate-300">
                            <FileText className="mx-auto h-10 w-10 text-primary-400 mb-2" />
                            <p className="text-sm font-semibold mb-1">PDF Document Attached</p>
                            <a
                              href={activeDoc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-500 mt-2"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> View PDF Document
                            </a>
                          </div>
                        </object>
                      ) : (
                        <img
                          src={activeDoc.file_url}
                          alt={activeDoc.document_type}
                          className="max-h-[330px] max-w-full object-contain rounded"
                        />
                      )
                    ) : (
                      <div className="text-center text-slate-400 p-6">
                        <FileText className="mx-auto h-10 w-10 text-slate-600 mb-2" />
                        <p className="text-xs">No file attachment preview available</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                  Select a document to preview
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
