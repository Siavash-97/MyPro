import { useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { buildRows, computeRange, ROW_HEIGHT, GROUP_HEADER_HEIGHT, xForDate, personIdAtY } from '../utils/layout';
import { addDays, diffDays, formatShort, PX_PER_DAY } from '../utils/date';
import { TimelineHeader } from './TimelineHeader';
import { GridBackground } from './GridBackground';
import { TodayLine } from './TodayLine';
import { TaskBar } from './TaskBar';
import { DependencyArrows } from './DependencyArrows';
import { computeCriticalPath } from '../utils/schedule';
import { computeResourceConflicts } from '../utils/conflicts';
import { computeRollups } from '../utils/hierarchy';

export interface TaskPosition {
  top: number;
  left: number;
  right: number;
}

const MOBILE_BREAKPOINT = 640;
const LEFT_WIDTH_DESKTOP = 260;
const LEFT_WIDTH_MOBILE = 210;
const COLLAPSED_WIDTH = 28;
const HEADER_HEIGHT = 60;

/** Current viewport width, updated on resize (e.g. phone rotation). */
function useViewportWidth(): number {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1024 : window.innerWidth));
  useEffect(() => {
    function onResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

export function GanttChart() {
  const tasks = useProjectStore((s) => s.tasks);
  const dependencies = useProjectStore((s) => s.dependencies);
  const people = useProjectStore((s) => s.people);
  const workPackages = useProjectStore((s) => s.workPackages);
  const swimlane = useProjectStore((s) => s.swimlane);
  const personFilter = useProjectStore((s) => s.personFilter);
  const zoom = useProjectStore((s) => s.zoom);
  const colorMode = useProjectStore((s) => s.colorMode);
  const setEditingTask = useProjectStore((s) => s.setEditingTask);
  const selectDependency = useProjectStore((s) => s.selectDependency);
  const addTask = useProjectStore((s) => s.addTask);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const viewportWidth = useViewportWidth();
  const isMobile = viewportWidth < MOBILE_BREAKPOINT;
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= MOBILE_BREAKPOINT);
  const leftWidth = isMobile ? LEFT_WIDTH_MOBILE : LEFT_WIDTH_DESKTOP;
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pxPerDay = PX_PER_DAY[zoom];
  const { start: rangeStart, end: rangeEnd } = useMemo(() => computeRange(tasks), [tasks]);
  const totalWidth = diffDays(rangeStart, rangeEnd) * pxPerDay;

  const rows = useMemo(
    () => buildRows(tasks, people, swimlane, personFilter, collapsedIds),
    [tasks, people, swimlane, personFilter, collapsedIds],
  );
  const criticalTaskIds = useMemo(() => computeCriticalPath(tasks, dependencies), [tasks, dependencies]);
  const conflictedTaskIds = useMemo(() => computeResourceConflicts(tasks), [tasks]);
  const rollups = useMemo(() => computeRollups(tasks), [tasks]);
  const totalHeight = rows.length
    ? rows[rows.length - 1].top + (rows[rows.length - 1].kind === 'header' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT)
    : 0;

  const positions = useMemo(() => {
    const map = new Map<string, TaskPosition>();
    for (const row of rows) {
      if (row.kind !== 'task') continue;
      const task = row.task;
      const effective = row.hasChildren ? rollups.get(task.id) : undefined;
      const start = effective?.start ?? task.start;
      const end = effective?.end ?? task.end;
      const left = xForDate(rangeStart, start, pxPerDay);
      const right = task.type === 'milestone' ? left + pxPerDay : left + (diffDays(start, end) + 1) * pxPerDay;
      const effectiveLeft = task.type === 'milestone' ? left + pxPerDay / 2 : left;
      map.set(task.id, { top: row.top + ROW_HEIGHT / 2, left: effectiveLeft, right });
    }
    return map;
  }, [rows, rangeStart, pxPerDay, rollups]);

  function personInitials(ids: string[]): string {
    return ids
      .map((id) => people.find((p) => p.id === id)?.name?.[0]?.toUpperCase())
      .filter(Boolean)
      .join(' ');
  }

  function colorForTask(task: (typeof tasks)[number]): string {
    if (colorMode === 'person') {
      const p = task.assigneeIds.length ? people.find((pp) => pp.id === task.assigneeIds[0]) : undefined;
      return p?.color ?? '#9ca3af';
    }
    if (colorMode === 'workpackage') {
      const wp = workPackages.find((w) => w.id === task.workPackageId);
      return wp?.color ?? '#9ca3af';
    }
    return task.color;
  }

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dayIndex = Math.floor(x / pxPerDay);
    const dateISO = addDays(rangeStart, dayIndex);
    const personId = swimlane ? personIdAtY(rows, y) : undefined;
    const id = addTask({ start: dateISO, end: dateISO, assigneeIds: personId ? [personId] : [] });
    setEditingTask(id);
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-auto relative bg-white"
      onClick={() => selectDependency(null)}
    >
      <div style={{ minWidth: (sidebarOpen ? leftWidth : COLLAPSED_WIDTH) + totalWidth, position: 'relative' }}>
        <div className="flex">
          <div
            className="sticky left-0 z-30 bg-white border-r border-gray-200 shrink-0 overflow-hidden"
            style={{ width: sidebarOpen ? leftWidth : COLLAPSED_WIDTH }}
          >
            <div
              className="sticky top-0 z-30 bg-white border-b border-gray-200 flex items-center justify-between px-1 text-xs font-semibold text-gray-500"
              style={{ height: HEADER_HEIGHT }}
            >
              {sidebarOpen && <span className="pl-2 truncate">Aufgabe</span>}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSidebarOpen((v) => !v);
                }}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
                title={sidebarOpen ? 'Liste einklappen' : 'Liste anzeigen'}
              >
                {sidebarOpen ? '‹' : '›'}
              </button>
            </div>
            {sidebarOpen &&
              rows.map((row) =>
                row.kind === 'header' ? (
                  <div
                    key={row.id}
                    className="flex items-center px-3 text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-100"
                    style={{ height: GROUP_HEADER_HEIGHT }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2 shrink-0"
                      style={{ background: row.color ?? '#9ca3af' }}
                    />
                    <span className="truncate">{row.label}</span>
                  </div>
                ) : (
                  <div
                    key={row.id}
                    className="flex flex-col justify-center px-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50"
                    style={{ height: ROW_HEIGHT, paddingLeft: 12 + row.indent * 14 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTask(row.task.id);
                    }}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {row.hasChildren && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCollapsed(row.task.id);
                          }}
                          className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-gray-400 hover:text-gray-700"
                          title={collapsedIds.has(row.task.id) ? 'Aufklappen' : 'Einklappen'}
                        >
                          {collapsedIds.has(row.task.id) ? '▸' : '▾'}
                        </button>
                      )}
                      <span
                        className="inline-block w-2 h-2 rounded-sm shrink-0"
                        style={{ background: colorForTask(row.task) }}
                      />
                      <span className="text-[12.5px] font-medium text-gray-800 truncate">{row.task.title}</span>
                    </div>
                    <div className="text-[10.5px] text-gray-400 truncate pl-3.5">
                      {(() => {
                        const effective = row.hasChildren ? rollups.get(row.task.id) : undefined;
                        const start = effective?.start ?? row.task.start;
                        const end = effective?.end ?? row.task.end;
                        return (
                          <>
                            {formatShort(start)}
                            {row.task.type === 'task' && end !== start ? ` – ${formatShort(end)}` : ''}
                            {row.hasChildren ? ` · ${effective?.progress ?? 0}%` : ''}
                            {row.task.assigneeIds.length ? `  ·  ${personInitials(row.task.assigneeIds)}` : ''}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ),
              )}
          </div>

          <div className="relative" style={{ width: totalWidth }}>
            <TimelineHeader
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              zoom={zoom}
              pxPerDay={pxPerDay}
              totalWidth={totalWidth}
            />
            <div
              className="relative cursor-cell"
              style={{ width: totalWidth, height: totalHeight }}
              onClick={handleGridClick}
              title="Klicken, um hier eine Aufgabe anzulegen"
            >
              <GridBackground rangeStart={rangeStart} rangeEnd={rangeEnd} zoom={zoom} pxPerDay={pxPerDay} height={totalHeight} />
              <TodayLine rangeStart={rangeStart} pxPerDay={pxPerDay} height={totalHeight} />
              {rows.map((row) =>
                row.kind === 'task' ? (
                  <TaskBar
                    key={row.id}
                    task={row.task}
                    rangeStart={rangeStart}
                    pxPerDay={pxPerDay}
                    top={row.top}
                    isCritical={criticalTaskIds.has(row.task.id)}
                    hasConflict={conflictedTaskIds.has(row.task.id)}
                    rollup={row.hasChildren ? rollups.get(row.task.id) : undefined}
                  />
                ) : null,
              )}
              <DependencyArrows
                positions={positions}
                width={totalWidth}
                height={totalHeight}
                scrollContainerRef={scrollContainerRef}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
