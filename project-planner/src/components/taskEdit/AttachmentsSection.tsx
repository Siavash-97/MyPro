import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  getDownloadUrl,
  formatSize,
  subscribeAttachments,
  type Attachment,
} from '../../lib/attachments';

export function AttachmentsSection({
  taskId,
  taskTitle,
  isViewer,
}: {
  taskId: string;
  taskTitle: string;
  isViewer: boolean;
}) {
  const logActivity = useProjectStore((s) => s.logActivity);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => void listAttachments(taskId).then(setAttachments);
    refresh();
    setAttachmentError('');
    return subscribeAttachments(taskId, refresh, 'attachments-section');
  }, [taskId]);

  async function refreshAttachments() {
    setAttachments(await listAttachments(taskId));
  }

  async function handleUploadFile(file: File) {
    setUploading(true);
    setAttachmentError('');
    const { error } = await uploadAttachment(taskId, file);
    setUploading(false);
    if (error) {
      setAttachmentError(error);
      return;
    }
    await refreshAttachments();
    logActivity(`Datei "${file.name}" an Aufgabe "${taskTitle}" angehängt.`);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file);
    e.target.value = '';
  }

  async function handleDeleteAttachment(att: Attachment) {
    await deleteAttachment(att);
    await refreshAttachments();
    logActivity(`Anhang "${att.name}" von Aufgabe "${taskTitle}" entfernt.`);
  }

  async function handleDownload(att: Attachment) {
    const url = await getDownloadUrl(att.storagePath);
    if (url) window.open(url, '_blank');
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Anhänge</label>
      <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
        {attachments.map((att) => (
          <div key={att.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
            <button onClick={() => handleDownload(att)} className="truncate text-left text-blue-600 hover:underline" title={att.name}>
              📎 {att.name}
            </button>
            <span className="text-gray-400 shrink-0">{formatSize(att.size)}</span>
            {!isViewer && (
              <button
                onClick={() => handleDeleteAttachment(att)}
                className="text-gray-400 hover:text-red-600 shrink-0"
                title="Anhang entfernen"
              >
                &times;
              </button>
            )}
          </div>
        ))}
        {attachments.length === 0 && <div className="px-2.5 py-2 text-xs text-gray-400">Keine Anhänge.</div>}
      </div>
      {!isViewer && (
        <>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-2 text-xs font-medium text-gray-500 border border-dashed border-gray-300 px-3 py-1 rounded-md hover:border-gray-400 hover:text-gray-700 disabled:opacity-50"
          >
            {uploading ? 'Lädt hoch…' : '+ Datei anhängen'}
          </button>
          <p className="text-[10.5px] text-gray-400 mt-1">PDF, Bilder, Excel, CSV u.a. -- max. 20 MB pro Datei.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.gif,.xlsx,.xls,.csv,application/pdf,image/*,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleFileInputChange}
          />
          {attachmentError && <p className="text-xs text-red-600 mt-1">{attachmentError}</p>}
        </>
      )}
    </div>
  );
}
