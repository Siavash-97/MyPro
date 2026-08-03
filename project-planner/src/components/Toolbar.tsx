import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { ZOOM_LABELS } from '../utils/date';
import type { ZoomLevel, ColorMode } from '../types';
import { ManagePanel } from './ManagePanel';
import { IdeasBoard } from './IdeasBoard';
import { ActivityLog } from './ActivityLog';
import { cloudEnabled } from '../lib/supabase';
import { signOut } from '../lib/auth';
import { useBaselineStore } from '../store/useBaselineStore';
import { useRoleStore } from '../store/useRoleStore';
import { useOutlineStore } from '../store/useOutlineStore';

const ZOOM_LEVELS: ZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year'];
const COLOR_MODES: { value: ColorMode; label: string }[] = [
  { value: 'custom', label: 'Eigene Farbe' },
  { value: 'person', label: 'Nach Person' },
  { value: 'workpackage', label: 'Nach Arbeitspaket' },
];

export function Toolbar() {
  const zoom = useProjectStore((s) => s.zoom);
  const setZoom = useProjectStore((s) => s.setZoom);
  const colorMode = useProjectStore((s) => s.colorMode);
  const setColorMode = useProjectStore((s) => s.setColorMode);
  const swimlane = useProjectStore((s) => s.swimlane);
  const setSwimlane = useProjectStore((s) => s.setSwimlane);
  const personFilter = useProjectStore((s) => s.personFilter);
  const setPersonFilter = useProjectStore((s) => s.setPersonFilter);
  const people = useProjectStore((s) => s.people);
  const linkingEnabled = useProjectStore((s) => s.linkingEnabled);
  const setLinkingEnabled = useProjectStore((s) => s.setLinkingEnabled);
  const linkModeFromId = useProjectStore((s) => s.linkModeFromId);
  const addTask = useProjectStore((s) => s.addTask);
  const setEditingTask = useProjectStore((s) => s.setEditingTask);
  const exportJSON = useProjectStore((s) => s.exportJSON);
  const importJSON = useProjectStore((s) => s.importJSON);
  const resetToSeed = useProjectStore((s) => s.resetToSeed);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.undoPast.length > 0);
  const canRedo = useProjectStore((s) => s.undoFuture.length > 0);
  const tasks = useProjectStore((s) => s.tasks);
  const logActivity = useProjectStore((s) => s.logActivity);
  const isViewer = useRoleStore((s) => s.role === 'viewer');
  const collapseAll = useOutlineStore((s) => s.collapseAll);
  const expandAll = useOutlineStore((s) => s.expandAll);

  const baseline = useBaselineStore((s) => s.baseline);
  const showBaseline = useBaselineStore((s) => s.show);
  const setShowBaseline = useBaselineStore((s) => s.setShow);
  const saveBaseline = useBaselineStore((s) => s.save);
  const clearBaselineStore = useBaselineStore((s) => s.clear);
  const hasBaseline = Object.keys(baseline).length > 0;

  function handleSaveBaseline() {
    if (
      !confirm(
        hasBaseline
          ? 'Bestehende Baseline durch den aktuellen Zeitplan ersetzen?'
          : 'Aktuellen Zeitplan als Baseline speichern?',
      )
    ) {
      return;
    }
    saveBaseline(tasks);
    setShowBaseline(true);
    logActivity('Baseline gespeichert (aktueller Zeitplan als Referenz).');
  }

  function handleClearBaseline() {
    if (!confirm('Baseline löschen?')) return;
    clearBaselineStore();
    logActivity('Baseline gelöscht.');
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const [showManage, setShowManage] = useState(false);
  const [showIdeas, setShowIdeas] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myprosole-projektplan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importJSON(reader.result as string);
      } catch {
        alert('Ungültige JSON-Datei.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleAddTask() {
    const id = addTask();
    setEditingTask(id);
  }

  function handleAddMilestone() {
    const id = addTask({ type: 'milestone' });
    setEditingTask(id);
  }

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-2.5 flex flex-wrap items-center gap-3">
      <h1 className="text-sm font-bold text-gray-800 mr-1">MyProSole Projektplaner</h1>
      <span
        className={`text-[10px] font-medium px-1.5 py-0.5 rounded mr-1 ${
          cloudEnabled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-400 border border-gray-200'
        }`}
        title={cloudEnabled ? 'Änderungen werden mit allen Geräten synchronisiert' : 'Nur auf diesem Gerät gespeichert'}
      >
        {cloudEnabled ? '☁ Sync aktiv' : '💾 Nur lokal'}
      </span>

      {isViewer && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded mr-1 bg-gray-100 text-gray-500 border border-gray-200">
          👁 Nur Ansicht
        </span>
      )}

      {!isViewer && (
        <>
          <button
            onClick={handleAddTask}
            className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md"
          >
            + Aufgabe
          </button>
          <button
            onClick={handleAddMilestone}
            className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md"
          >
            + Meilenstein
          </button>

          <button
            onClick={() => setLinkingEnabled(!linkingEnabled)}
            className={`text-xs font-medium px-3 py-1.5 rounded-md border ${
              linkingEnabled ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-200'
            }`}
            title="Aufgaben anklicken, um Abhängigkeit zu erstellen"
          >
            {linkingEnabled ? (linkModeFromId ? 'Ziel wählen…' : 'Quelle wählen…') : 'Verknüpfen'}
          </button>

          <div className="flex items-center rounded-md border border-gray-200 overflow-hidden">
            <button
              onClick={() => undo()}
              disabled={!canUndo}
              title="Rückgängig (Strg+Z)"
              className="text-xs font-medium px-2.5 py-1.5 bg-white text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed border-r border-gray-200"
            >
              ↶
            </button>
            <button
              onClick={() => redo()}
              disabled={!canRedo}
              title="Wiederholen (Strg+Umschalt+Z)"
              className="text-xs font-medium px-2.5 py-1.5 bg-white text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ↷
            </button>
          </div>
        </>
      )}

      <div className="flex items-center rounded-md border border-gray-200 overflow-hidden">
        {ZOOM_LEVELS.map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`text-xs font-medium px-2.5 py-1.5 ${zoom === z ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}
          >
            {ZOOM_LABELS[z]}
          </button>
        ))}
      </div>

      <select
        className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
        value={colorMode}
        onChange={(e) => setColorMode(e.target.value as ColorMode)}
      >
        {COLOR_MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <select
        className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
        value={personFilter ?? ''}
        onChange={(e) => setPersonFilter(e.target.value || null)}
      >
        <option value="">Alle Personen</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 text-xs text-gray-600">
        <input type="checkbox" checked={swimlane} onChange={(e) => setSwimlane(e.target.checked)} />
        Swimlanes (nach Person)
      </label>

      <div className="flex items-center rounded-md border border-gray-200 overflow-hidden" title="Gliederungsebene: für einen langfristigen Plan die ferne Zukunft einklappen und nur den aktuellen Zeitraum im Detail zeigen">
        <button
          onClick={() => collapseAll(tasks)}
          className="text-xs font-medium px-2.5 py-1.5 bg-white text-gray-600 hover:bg-gray-50 border-r border-gray-200"
        >
          ▸ Alles einklappen
        </button>
        <button
          onClick={() => expandAll()}
          className="text-xs font-medium px-2.5 py-1.5 bg-white text-gray-600 hover:bg-gray-50"
        >
          ▾ Alles ausklappen
        </button>
      </div>

      {cloudEnabled && (
        <div className="flex items-center gap-1.5">
          {hasBaseline && (
            <label className="flex items-center gap-1.5 text-xs text-gray-600" title="Grauer Balken = ursprünglich geplanter Termin">
              <input type="checkbox" checked={showBaseline} onChange={(e) => setShowBaseline(e.target.checked)} />
              Baseline anzeigen
            </label>
          )}
          {!isViewer && (
            <button
              onClick={handleSaveBaseline}
              title="Aktuellen Zeitplan als Referenz für spätere Vergleiche speichern"
              className="text-xs font-medium text-gray-500 border border-dashed border-gray-300 px-2.5 py-1 rounded-md hover:border-gray-400 hover:text-gray-700"
            >
              📌 Baseline speichern
            </button>
          )}
          {!isViewer && hasBaseline && (
            <button
              onClick={handleClearBaseline}
              className="text-xs font-medium text-gray-400 hover:text-red-600"
            >
              Baseline löschen
            </button>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setShowIdeas(true)}
          className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-md hover:bg-amber-100"
        >
          💡 Ideen
        </button>
        <button
          onClick={() => setShowActivity(true)}
          className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-md"
        >
          🕐 Verlauf
        </button>
        <button
          onClick={() => setShowManage(true)}
          className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-md"
        >
          Personen/AP verwalten
        </button>
        <button
          onClick={handleExport}
          className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-md"
        >
          Export JSON
        </button>
        {!isViewer && (
          <>
            <button
              onClick={handleImportClick}
              className="text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-md"
            >
              Import JSON
            </button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => {
                if (confirm('Beispieldaten wiederherstellen? Aktuelle Änderungen gehen verloren.')) resetToSeed();
              }}
              className="text-xs font-medium text-gray-400 hover:text-gray-600"
            >
              Zurücksetzen
            </button>
          </>
        )}
        {cloudEnabled && (
          <button onClick={() => signOut()} className="text-xs font-medium text-gray-400 hover:text-red-600">
            Abmelden
          </button>
        )}
      </div>

      {showManage && <ManagePanel onClose={() => setShowManage(false)} />}
      {showIdeas && <IdeasBoard onClose={() => setShowIdeas(false)} />}
      {showActivity && <ActivityLog onClose={() => setShowActivity(false)} />}
    </div>
  );
}
