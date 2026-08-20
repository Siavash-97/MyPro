import { useRef } from 'react';
import type { Task } from '../types';
import type { Rollup } from '../utils/hierarchy';
import { useProjectStore } from '../store/useProjectStore';
import { useBaselineStore } from '../store/useBaselineStore';
import { useRoleStore } from '../store/useRoleStore';
import { addDays, diffDays, formatShort, today } from '../utils/date';
import { xForDate, ROW_HEIGHT } from '../utils/layout';

interface Props {
  task: Task;
  rangeStart: string;
  pxPerDay: number;
  top: number;
  minBarWidth?: number;
  /** Present when this task has children: its displayed dates/progress
   * come from here (computeRollups) instead of its own stored fields, and
   * it can't be dragged directly -- only its children can. */
  rollup?: Rollup;
  /** Reports this task's id while the pointer is over its bar/diamond, and
   * null on leave -- lets DependencyArrows reveal this task's new-link
   * connector handles only while it's actually hovered. */
  onHoverChange?: (taskId: string | null) => void;
}

type DragKind = 'move' | 'resize-left' | 'resize-right' | null;

export function TaskBar({
  task,
  rangeStart,
  pxPerDay,
  top,
  minBarWidth = 0,
  rollup,
  onHoverChange,
}: Props) {
  const isSummary = !!rollup;
  const effStart = rollup?.start ?? task.start;
  const effEnd = rollup?.end ?? task.end;
  const effProgress = rollup?.progress ?? task.progress;
  const moveTask = useProjectStore((s) => s.moveTask);
  const updateTask = useProjectStore((s) => s.updateTask);
  const setEditingTask = useProjectStore((s) => s.setEditingTask);
  const beginTaskDrag = useProjectStore((s) => s.beginTaskDrag);
  const endTaskDrag = useProjectStore((s) => s.endTaskDrag);
  const linkingEnabled = useProjectStore((s) => s.linkingEnabled);
  const linkModeFromId = useProjectStore((s) => s.linkModeFromId);
  const startLink = useProjectStore((s) => s.startLink);
  const cancelLink = useProjectStore((s) => s.cancelLink);
  const completeLink = useProjectStore((s) => s.completeLink);
  const colorMode = useProjectStore((s) => s.colorMode);
  const people = useProjectStore((s) => s.people);
  const workPackages = useProjectStore((s) => s.workPackages);
  const logActivity = useProjectStore((s) => s.logActivity);
  const showBaseline = useBaselineStore((s) => s.show);
  const baselineEntry = useBaselineStore((s) => s.baseline[task.id]);
  const isViewer = useRoleStore((s) => s.role === 'viewer');

  const dragRef = useRef<{ kind: DragKind; startX: number; origStart: string; origEnd: string; moved: boolean }>({
    kind: null,
    startX: 0,
    origStart: effStart,
    origEnd: effEnd,
    moved: false,
  });

  let color = task.color;
  if (colorMode === 'person') {
    const p = task.assigneeIds.length ? people.find((pp) => pp.id === task.assigneeIds[0]) : undefined;
    color = p?.color ?? '#9ca3af';
  } else if (colorMode === 'workpackage') {
    const wp = workPackages.find((w) => w.id === task.workPackageId);
    color = wp?.color ?? '#9ca3af';
  }

  const isLinkSource = linkModeFromId === task.id;

  function onPointerDownBody(e: React.PointerEvent, kind: DragKind) {
    if (isSummary || isViewer) return; // summary tasks are computed from children -- only they can be dragged; viewers can't edit at all
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // no active pointer capture available; drag still tracked via dragRef
    }
    dragRef.current = { kind, startX: e.clientX, origStart: effStart, origEnd: effEnd, moved: false };
    // Freeze this task's sort key at its pre-drag start for the duration of
    // the gesture -- see beginTaskDrag's doc comment in useProjectStore.
    beginTaskDrag(task.id, effStart);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag.kind) return;
    // If the primary button isn't actually held anymore, the drag ended
    // without this element seeing the pointerup (capture can silently fail,
    // or the button can be released outside the element/window). Without
    // this check, a stuck drag.kind would make merely hovering the bar
    // later -- with no button pressed at all -- keep shifting it.
    if (e.buttons !== 1) {
      dragRef.current.kind = null;
      endTaskDrag();
      return;
    }
    const deltaPx = e.clientX - drag.startX;
    if (Math.abs(deltaPx) > 3) drag.moved = true;
    const deltaDays = Math.round(deltaPx / pxPerDay);

    if (drag.kind === 'move') {
      const newStart = addDays(drag.origStart, deltaDays);
      const newEnd = addDays(drag.origEnd, deltaDays);
      moveTask(task.id, newStart, newEnd);
    } else if (drag.kind === 'resize-left') {
      let newStart = addDays(drag.origStart, deltaDays);
      if (diffDays(newStart, drag.origEnd) < 0) newStart = drag.origEnd;
      updateTask(task.id, { start: newStart });
    } else if (drag.kind === 'resize-right') {
      let newEnd = addDays(drag.origEnd, deltaDays);
      if (diffDays(drag.origStart, newEnd) < 0) newEnd = drag.origStart;
      updateTask(task.id, { end: newEnd });
    }
  }

  function onPointerUp() {
    const drag = dragRef.current;
    const wasMoved = drag.moved;
    dragRef.current.kind = null;
    endTaskDrag();
    if (!wasMoved) {
      handleClick();
      return;
    }
    const current = useProjectStore.getState().tasks.find((t) => t.id === task.id);
    if (current && (current.start !== drag.origStart || current.end !== drag.origEnd)) {
      const label = task.type === 'milestone' ? 'Meilenstein' : 'Aufgabe';
      const dateLabel =
        task.type === 'milestone' ? formatShort(current.start) : `${formatShort(current.start)} – ${formatShort(current.end)}`;
      logActivity(`${label} "${current.title}" verschoben: jetzt ${dateLabel}.`);
    }
  }

  // The browser can cancel a pointer sequence mid-drag (touch scroll takeover,
  // window losing focus, etc.) without ever firing pointerup -- reset here too
  // so the bar can't get stuck thinking a drag is still in progress.
  function onPointerCancel() {
    dragRef.current.kind = null;
    endTaskDrag();
  }

  function handleClick() {
    if (linkingEnabled) {
      if (!linkModeFromId) startLink(task.id);
      else if (linkModeFromId === task.id) cancelLink();
      else completeLink(task.id);
      return;
    }
    setEditingTask(task.id);
  }

  const left = xForDate(rangeStart, effStart, pxPerDay);
  const showGhost =
    !isSummary &&
    showBaseline &&
    !!baselineEntry &&
    (baselineEntry.start !== task.start || baselineEntry.end !== task.end);
  const baselineTitle = baselineEntry
    ? ` -- ursprünglich geplant: ${formatShort(baselineEntry.start)}${task.type === 'task' ? ` – ${formatShort(baselineEntry.end)}` : ''}`
    : '';

  if (task.type === 'milestone') {
    const size = 18;
    return (
      <>
        {showGhost && (
          <div
            className="absolute rotate-45 border border-gray-400 pointer-events-none"
            style={{
              left: xForDate(rangeStart, baselineEntry!.start, pxPerDay) + pxPerDay / 2 - 6,
              top: top + (ROW_HEIGHT - 12) / 2,
              width: 12,
              height: 12,
              background: 'rgba(209, 213, 219, 0.5)', // gray-300 -- plain rgba, see GridBackground.tsx comment
            }}
            title={`Ursprünglich geplant: ${formatShort(baselineEntry!.start)}`}
          />
        )}
        <div
          data-task-id={task.id}
          className={`absolute flex items-center justify-center cursor-pointer group ${isLinkSource ? 'ring-2 ring-offset-1 ring-indigo-500 rounded-full' : ''}`}
          style={{ left: left + pxPerDay / 2 - size / 2, top: top + (ROW_HEIGHT - size) / 2, width: size, height: size }}
          onPointerDown={(e) => onPointerDownBody(e, 'move')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerEnter={() => onHoverChange?.(task.id)}
          onPointerLeave={() => onHoverChange?.(null)}
          onClick={(e) => e.stopPropagation()}
          title={`${task.title}${baselineTitle}`}
        >
          <div
            className="w-full h-full rotate-45 shadow-sm border"
            style={{ background: color, borderColor: 'rgba(0, 0, 0, 0.1)' }}
          />
          <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-gray-700 pointer-events-none">
            {task.title}
          </span>
        </div>
      </>
    );
  }

  const width = Math.max(Math.max(diffDays(effStart, effEnd) + 1, 1) * pxPerDay, minBarWidth);
  const isOverdue = !isSummary && task.progress < 100 && task.end < today();
  // Widths + solid colors stay as Tailwind classes (safe); the default
  // black/10 border is plain rgba (see GridBackground.tsx comment).
  const borderClass = isOverdue
    ? 'border-red-500 border-2'
    : isSummary
      ? 'border-gray-600 border-2'
      : 'border';
  const borderColorStyle = isOverdue || isSummary ? undefined : 'rgba(0, 0, 0, 0.1)';
  const ghostLeft = showGhost ? xForDate(rangeStart, baselineEntry!.start, pxPerDay) : 0;
  const ghostWidth = showGhost ? Math.max(diffDays(baselineEntry!.start, baselineEntry!.end) + 1, 1) * pxPerDay : 0;

  return (
    <>
      {showGhost && (
        <div
          className="absolute rounded border border-gray-400 pointer-events-none"
          style={{ left: ghostLeft, top: top + ROW_HEIGHT - 7, width: ghostWidth, height: 4, background: 'rgba(156, 163, 175, 0.5)' }}
          title={`Ursprünglich geplant: ${formatShort(baselineEntry!.start)} – ${formatShort(baselineEntry!.end)}`}
        />
      )}
      <div
      data-task-id={task.id}
      className={`absolute rounded-md shadow-sm border group ${isSummary || isViewer ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${isLinkSource ? 'ring-2 ring-offset-1 ring-indigo-500' : ''} ${borderClass}`}
      style={{ left, top: top + 6, width, height: ROW_HEIGHT - 12, background: color, borderColor: borderColorStyle }}
      onPointerDown={(e) => onPointerDownBody(e, 'move')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerEnter={() => onHoverChange?.(task.id)}
      onPointerLeave={() => onHoverChange?.(null)}
      onClick={(e) => e.stopPropagation()}
      title={`${task.title} (${effProgress}%)${isSummary ? ' -- Sammelaufgabe, Termin/Fortschritt aus Unteraufgaben berechnet' : ''}${isOverdue ? ' -- überfällig' : ''}${baselineTitle}`}
    >
      <div className="h-full w-full rounded-md overflow-hidden relative">
        <div
          className="absolute inset-0"
          style={{ width: `${100 - effProgress}%`, left: `${effProgress}%`, background: 'rgba(0, 0, 0, 0.15)' }}
        />
        <div className="relative h-full flex items-center px-2 text-[11px] font-medium text-white truncate select-none">
          {task.title}
        </div>
      </div>
      {!isSummary && (
        <>
          <div
            className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
            onPointerDown={(e) => onPointerDownBody(e, 'resize-left')}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
          <div
            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
            onPointerDown={(e) => onPointerDownBody(e, 'resize-right')}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
        </>
      )}
      {isOverdue && !isViewer && (
        <button
          className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-red-600 hover:bg-green-600 text-white text-[11px] leading-none flex items-center justify-center shadow"
          title="Öffnen und Definition of Done abschließen"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setEditingTask(task.id);
          }}
        >
          ✓
        </button>
      )}
      </div>
    </>
  );
}
