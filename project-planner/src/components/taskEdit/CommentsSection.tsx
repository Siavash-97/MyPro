import { useEffect, useState } from 'react';
import { listComments, addComment, deleteComment, subscribeComments, type Comment } from '../../lib/comments';

function formatCommentTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CommentsSection({ taskId, isViewer }: { taskId: string; isViewer: boolean }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    listComments(taskId).then(setComments);
    setNewComment('');
    return subscribeComments(taskId, () => {
      listComments(taskId).then(setComments);
    });
  }, [taskId]);

  async function handlePostComment() {
    if (!newComment.trim()) return;
    setPostingComment(true);
    await addComment(taskId, newComment);
    setPostingComment(false);
    setNewComment('');
    setComments(await listComments(taskId));
  }

  async function handleDeleteComment(id: string) {
    await deleteComment(id);
    setComments(await listComments(taskId));
  }

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Kommentare</label>
      <div className="border border-gray-200 rounded-md divide-y divide-gray-100 max-h-56 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className="px-2.5 py-1.5 text-xs group">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800">{c.author ?? 'Unbekannt'}</span>
              <span className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">{formatCommentTime(c.createdAt)}</span>
                {!isViewer && (
                  <button
                    onClick={() => handleDeleteComment(c.id)}
                    className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100"
                    title="Kommentar löschen"
                  >
                    &times;
                  </button>
                )}
              </span>
            </div>
            <p className="text-gray-600 whitespace-pre-wrap mt-0.5">{c.message}</p>
          </div>
        ))}
        {comments.length === 0 && <div className="px-2.5 py-2 text-xs text-gray-400">Noch keine Kommentare.</div>}
      </div>
      {!isViewer && (
        <div className="flex gap-2 mt-2">
          <input
            className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-sm"
            placeholder="Kommentar schreiben…"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePostComment();
            }}
          />
          <button
            onClick={handlePostComment}
            disabled={postingComment || !newComment.trim()}
            className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 rounded-md disabled:opacity-50"
          >
            Senden
          </button>
        </div>
      )}
    </div>
  );
}
