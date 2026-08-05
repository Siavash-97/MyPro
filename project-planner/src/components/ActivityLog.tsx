import { useProjectStore } from '../store/useProjectStore';
import { useDismissGuard } from '../hooks/useDismissGuard';
import { useRoleStore } from '../store/useRoleStore';

interface Props {
  onClose: () => void;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivityLog({ onClose }: Props) {
  const canDismiss = useDismissGuard();
  const activity = useProjectStore((s) => s.activity);
  const clearActivity = useProjectStore((s) => s.clearActivity);
  const isViewer = useRoleStore((s) => s.role === 'viewer');

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => canDismiss() && onClose()}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Verlauf</h2>
            <p className="text-xs text-gray-400 mt-0.5">Was bisher am Projektplan geändert wurde.</p>
          </div>
          <button className="text-gray-400 hover:text-gray-600 text-lg leading-none" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-2">
          {activity.length === 0 && <div className="text-sm text-gray-400 py-6 text-center">Noch keine Einträge.</div>}
          {activity.map((entry) => (
            <div key={entry.id} className="flex gap-3 text-sm border-b border-gray-50 pb-2 last:border-0">
              <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0 pt-0.5">
                {formatTimestamp(entry.timestamp)}
              </span>
              <span className="text-gray-700">
                {entry.actor && <span className="font-medium text-gray-900">{entry.actor}: </span>}
                {entry.message}
              </span>
            </div>
          ))}
        </div>

        {!isViewer && (
          <div className="px-5 py-3 border-t border-gray-100 flex justify-end shrink-0">
            <button
              onClick={() => {
                if (confirm('Verlauf wirklich löschen?')) clearActivity();
              }}
              className="text-xs font-medium text-gray-400 hover:text-red-600"
            >
              Verlauf löschen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
