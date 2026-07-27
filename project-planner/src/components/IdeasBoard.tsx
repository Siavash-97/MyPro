import { useProjectStore } from '../store/useProjectStore';
import { formatShort } from '../utils/date';

interface Props {
  onClose: () => void;
}

export function IdeasBoard({ onClose }: Props) {
  const ideas = useProjectStore((s) => s.ideas);
  const addIdea = useProjectStore((s) => s.addIdea);
  const updateIdea = useProjectStore((s) => s.updateIdea);
  const deleteIdea = useProjectStore((s) => s.deleteIdea);

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Ideen & Vision</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Freier Raum für Gedanken, ohne Datum, ohne Zuweisung — noch keine Aufgabe, nur eine Idee.
            </p>
          </div>
          <button className="text-gray-400 hover:text-gray-600 text-lg leading-none" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          <button
            onClick={() => addIdea()}
            className="text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-md"
          >
            + Neue Idee
          </button>

          {ideas.length === 0 && <div className="text-sm text-gray-400 py-6 text-center">Noch keine Ideen notiert.</div>}

          <div className="grid gap-3 sm:grid-cols-2">
            {ideas.map((idea) => (
              <div key={idea.id} className="border border-gray-200 rounded-lg p-3 bg-amber-50/40 flex flex-col gap-2">
                <input
                  className="font-medium text-sm text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-gray-300 pb-1"
                  value={idea.title}
                  onChange={(e) => updateIdea(idea.id, { title: e.target.value })}
                />
                <textarea
                  className="text-xs text-gray-600 bg-transparent outline-none resize-none flex-1"
                  rows={4}
                  placeholder="Notiz, Vision, offene Frage..."
                  value={idea.text}
                  onChange={(e) => updateIdea(idea.id, { text: e.target.value })}
                />
                <div className="flex items-center justify-between text-[10.5px] text-gray-400">
                  <span>{formatShort(idea.createdAt)}</span>
                  <button className="text-red-500 hover:text-red-600 font-medium" onClick={() => deleteIdea(idea.id)}>
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
