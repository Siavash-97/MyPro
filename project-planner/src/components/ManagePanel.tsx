import { useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useDismissGuard } from '../hooks/useDismissGuard';
import { useRoleStore } from '../store/useRoleStore';
import type { Person } from '../types';

interface Props {
  onClose: () => void;
}

/** Inline editor for one person's e-mail-notification settings: address,
 * whether an e-mail fires on assignment, and how many days before a
 * task's due date to remind them (comma-separated, e.g. "7,1"). Kept as
 * free text while typing so "7," mid-edit doesn't get mangled, and only
 * parsed into numbers on blur/save. */
function NotificationSettings({ person, onSave }: { person: Person; onSave: (patch: Partial<Person>) => void }) {
  const [email, setEmail] = useState(person.email ?? '');
  const [notifyOnAssignment, setNotifyOnAssignment] = useState(person.notify_on_assignment ?? true);
  const [daysText, setDaysText] = useState((person.reminder_days_before ?? [7, 1]).join(', '));

  const save = () => {
    const days = daysText
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 0);
    onSave({ email: email.trim() || null, notify_on_assignment: notifyOnAssignment, reminder_days_before: days });
  };

  return (
    <div className="mt-1.5 mb-2 ml-4.5 p-2.5 bg-gray-50 rounded-md space-y-2 text-xs">
      <div>
        <label className="block text-gray-500 mb-0.5">E-Mail-Adresse</label>
        <input
          type="email"
          className="w-full border border-gray-200 rounded px-2 py-1"
          placeholder="name@myprosole.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={save}
        />
      </div>
      <label className="flex items-center gap-1.5 text-gray-600">
        <input
          type="checkbox"
          checked={notifyOnAssignment}
          onChange={(e) => {
            setNotifyOnAssignment(e.target.checked);
            onSave({ notify_on_assignment: e.target.checked });
          }}
        />
        Bei Zuweisung einer Aufgabe benachrichtigen
      </label>
      <div>
        <label className="block text-gray-500 mb-0.5">Erinnerung X Tage vor Fälligkeit (kommagetrennt)</label>
        <input
          className="w-full border border-gray-200 rounded px-2 py-1"
          placeholder="7, 1"
          value={daysText}
          onChange={(e) => setDaysText(e.target.value)}
          onBlur={save}
        />
      </div>
    </div>
  );
}

export function ManagePanel({ onClose }: Props) {
  const canDismiss = useDismissGuard();
  const people = useProjectStore((s) => s.people);
  const workPackages = useProjectStore((s) => s.workPackages);
  const addPerson = useProjectStore((s) => s.addPerson);
  const updatePerson = useProjectStore((s) => s.updatePerson);
  const removePerson = useProjectStore((s) => s.removePerson);
  const addWorkPackage = useProjectStore((s) => s.addWorkPackage);
  const removeWorkPackage = useProjectStore((s) => s.removeWorkPackage);
  const isViewer = useRoleStore((s) => s.role === 'viewer');

  const [newPerson, setNewPerson] = useState('');
  const [newWP, setNewWP] = useState('');
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => canDismiss() && onClose()}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
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
                <div key={p.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                      {p.name}
                      {p.email && <span className="text-[10px] text-gray-400">{p.email}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <button
                        className="text-xs text-blue-500 hover:text-blue-600"
                        onClick={() => setExpandedPersonId(expandedPersonId === p.id ? null : p.id)}
                      >
                        {expandedPersonId === p.id ? 'Fertig' : 'Benachrichtigungen'}
                      </button>
                      {!isViewer && (
                        <button className="text-xs text-red-500 hover:text-red-600" onClick={() => removePerson(p.id)}>
                          Entfernen
                        </button>
                      )}
                    </span>
                  </div>
                  {expandedPersonId === p.id && (
                    <NotificationSettings person={p} onSave={(patch) => updatePerson(p.id, patch)} />
                  )}
                </div>
              ))}
              {people.length === 0 && <div className="text-xs text-gray-400">Keine Personen</div>}
            </div>
            {!isViewer && (
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
            )}
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
                  {!isViewer && (
                    <button className="text-xs text-red-500 hover:text-red-600" onClick={() => removeWorkPackage(wp.id)}>
                      Entfernen
                    </button>
                  )}
                </div>
              ))}
              {workPackages.length === 0 && <div className="text-xs text-gray-400">Keine Arbeitspakete</div>}
            </div>
            {!isViewer && (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
