import { useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useDismissGuard } from '../hooks/useDismissGuard';

interface Props {
  onClose: () => void;
}

export function ManagePanel({ onClose }: Props) {
  const canDismiss = useDismissGuard();
  const people = useProjectStore((s) => s.people);
  const workPackages = useProjectStore((s) => s.workPackages);
  const addPerson = useProjectStore((s) => s.addPerson);
  const removePerson = useProjectStore((s) => s.removePerson);
  const addWorkPackage = useProjectStore((s) => s.addWorkPackage);
  const removeWorkPackage = useProjectStore((s) => s.removeWorkPackage);

  const [newPerson, setNewPerson] = useState('');
  const [newWP, setNewWP] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => canDismiss() && onClose()}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">Personen & Arbeitspakete</h2>
          <button className="text-gray-400 hover:text-gray-600 text-lg leading-none" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 mb-2">Personen</h3>
            <div className="space-y-1.5 mb-2">
              {people.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                    {p.name}
                  </span>
                  <button className="text-xs text-red-500 hover:text-red-600" onClick={() => removePerson(p.id)}>
                    Entfernen
                  </button>
                </div>
              ))}
              {people.length === 0 && <div className="text-xs text-gray-400">Keine Personen</div>}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-sm"
                placeholder="Neue Person"
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addPerson(newPerson);
                    setNewPerson('');
                  }
                }}
              />
              <button
                className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 rounded-md"
                onClick={() => {
                  addPerson(newPerson);
                  setNewPerson('');
                }}
              >
                +
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 mb-2">Arbeitspakete / Kategorien</h3>
            <div className="space-y-1.5 mb-2">
              {workPackages.map((wp) => (
                <div key={wp.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: wp.color }} />
                    {wp.name}
                  </span>
                  <button className="text-xs text-red-500 hover:text-red-600" onClick={() => removeWorkPackage(wp.id)}>
                    Entfernen
                  </button>
                </div>
              ))}
              {workPackages.length === 0 && <div className="text-xs text-gray-400">Keine Arbeitspakete</div>}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-sm"
                placeholder="Neues Arbeitspaket"
                value={newWP}
                onChange={(e) => setNewWP(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addWorkPackage(newWP);
                    setNewWP('');
                  }
                }}
              />
              <button
                className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 rounded-md"
                onClick={() => {
                  addWorkPackage(newWP);
                  setNewWP('');
                }}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
