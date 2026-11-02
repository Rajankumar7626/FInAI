import { useState } from 'react'

export function DragDropUploadZone({
  onUpload,
  loading,
}: {
  onUpload: (file: File) => void
  loading: boolean
}) {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div
      className={`dropzone-container ${isDragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) onUpload(file)
      }}
      onClick={() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/pdf,.pdf'
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0]
          if (file) onUpload(file)
        }
        input.click()
      }}
    >
      <strong>{loading ? 'Processing Document...' : 'Drag & Drop Financial PDF Here'}</strong>
      <p>or click to browse from your device (10 MiB limit, text-based PDF)</p>
    </div>
  )
}
