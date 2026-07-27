import { useRef } from 'react';
import type { Task } from '../types';
import { useProjectStore } from '../store/useProjectStore';
import { addDays, diffDays, formatShort } from '../utils/date';
import { xForDate, ROW_HEIGHT } from '../utils/layout';

interface Props {
  task: Task;
  rangeStart: string;
  pxPerDay: number;
  top: number;
}

type DragKind = 'move' | 'resize-left' | 'resize-right' | null;

export function TaskBar({ task, rangeStart, pxPerDay, top }: Props) {
  const moveTask = useProjectStore((s) => s.moveTask);
  const updateTask = useProjectStore((s) => s.updateTask);
  const setEditingTask = useProjectStore((s) => s.setEditingTask);
  const linkingEnabled = useProjectStore((s) => s.linkingEnabled);
  const linkModeFromId = useProjectStore((s) => s.linkModeFromId);
  const startLink = useProjectStore((s) => s.startLink);
  const cancelLink = useProjectStore((s) => s.cancelLink);
  const completeLink = useProjectStore((s) => s.completeLink);
  const colorMode = useProjectStore((s) => s.colorMode);
  const people = useProjectStore((s) => s.people);
  const workPackages = useProjectStore((s) => s.workPackages);
  const logActivity = useProjectStore((s) => s.logActivity);

  const dragRef = useRef<{ kind: DragKind; startX: number; origStart: string; origEnd: string; moved: boolean }>({
    kind: null,
    startX: 0,
    origStart: task.start,
    origEnd: task.end,
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
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      // no active pointer capture available; drag still tracked via dragRef
    }
    dragRef.current = { kind, startX: e.clientX, origStart: task.start, origEnd: task.end, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag.kind) return;
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

  function handleClick() {
    if (linkingEnabled) {
      if (!linkModeFromId) startLink(task.id);
      else if (linkModeFromId === task.id) cancelLink();
      else completeLink(task.id);
      return;
    }
    setEditingTask(task.id);
  }

  const left = xForDate(rangeStart, task.start, pxPerDay);

  if (task.type === 'milestone') {
    const size = 18;
    return (
      <div
        data-task-id={task.id}
        className={`absolute flex items-center justify-center cursor-pointer group ${isLinkSource ? 'ring-2 ring-offset-1 ring-indigo-500 rounded-full' : ''}`}
        style={{ left: left + pxPerDay / 2 - size / 2, top: top + (ROW_HEIGHT - size) / 2, width: size, height: size }}
        onPointerDown={(e) => onPointerDownBody(e, 'move')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={(e) => e.stopPropagation()}
        title={task.title}
      >
        <div
          className="w-full h-full rotate-45 shadow-sm border border-black/10"
          style={{ background: color }}
        />
        <span className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-gray-700 pointer-events-none">
          {task.title}
        </span>
      </div>
    );
  }

  const width = Math.max(diffDays(task.start, task.end) + 1, 1) * pxPerDay;

  return (
    <div
      data-task-id={task.id}
      className={`absolute rounded-md shadow-sm border border-black/10 cursor-grab active:cursor-grabbing group ${isLinkSource ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}`}
      style={{ left, top: top + 6, width, height: ROW_HEIGHT - 12, background: color }}
      onPointerDown={(e) => onPointerDownBody(e, 'move')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(e) => e.stopPropagation()}
      title={`${task.title} (${task.progress}%)`}
    >
      <div className="h-full w-full rounded-md overflow-hidden relative">
        <div className="absolute inset-0 bg-black/15" style={{ width: `${100 - task.progress}%`, left: `${task.progress}%` }} />
        <div className="relative h-full flex items-center px-2 text-[11px] font-medium text-white truncate select-none">
          {task.title}
        </div>
      </div>
      <div
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
        onPointerDown={(e) => onPointerDownBody(e, 'resize-left')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
        onPointerDown={(e) => onPointerDownBody(e, 'resize-right')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </div>
  );
}
