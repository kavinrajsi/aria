'use client'

import { useRef, useState, useTransition } from 'react'
import { FileText, Trash2, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Doc {
  id: string
  file_name: string
  file_type: string | null
  uploaded_at: string
}

interface Props {
  meetingId: string
  initialDocuments: Doc[]
}

export function DocumentUpload({ meetingId, initialDocuments }: Props) {
  const [documents, setDocuments] = useState<Doc[]>(initialDocuments)
  const [uploading, startUpload] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    startUpload(async () => {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch(`/api/meetings/${meetingId}/documents`, {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Upload failed')
        return
      }

      const doc: Doc = await res.json()
      setDocuments((prev) => [...prev, doc])
      toast.success(`${file.name} uploaded`)
    })
  }

  async function handleDelete(docId: string, fileName: string) {
    const res = await fetch(
      `/api/meetings/${meetingId}/documents?docId=${docId}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
      toast.success(`${fileName} removed`)
    } else {
      toast.error('Failed to remove document')
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md"
        className="hidden"
        onChange={handleFileChange}
      />

      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 text-sm">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1 text-sm">{doc.file_name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(doc.id, doc.file_name)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {documents.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No documents yet. Upload .txt or .md files for Aria to reference during the meeting.
        </p>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="mr-1.5 h-3.5 w-3.5" />
        )}
        Upload document
      </Button>
    </div>
  )
}
