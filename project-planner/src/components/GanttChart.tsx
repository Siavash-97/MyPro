import { useMemo, useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { buildRows, computeRange, ROW_HEIGHT, GROUP_HEADER_HEIGHT, xForDate } from '../utils/layout';
import { diffDays, formatShort, PX_PER_DAY } from '../utils/date';
import { TimelineHeader } from './TimelineHeader';
import { GridBackground } from './GridBackground';
import { TodayLine } from './TodayLine';
import { TaskBar } from './TaskBar';
import { DependencyArrows } from './DependencyArrows';

export interface TaskPosition {
  top: number;
  left: number;
  right: number;
}

const LEFT_WIDTH = 260;
const HEADER_HEIGHT = 60;

export function GanttChart() {
  const tasks = useProjectStore((s) => s.tasks);
  const people = useProjectStore((s) => s.people);
  const workPackages = useProjectStore((s) => s.workPackages);
  const swimlane = useProjectStore((s) => s.swimlane);
  const personFilter = useProjectStore((s) => s.personFilter);
  const zoom = useProjectStore((s) => s.zoom);
  const colorMode = useProjectStore((s) => s.colorMode);
  const setEditingTask = useProjectStore((s) => s.setEditingTask);
  const selectDependency = useProjectStore((s) => s.selectDependency);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const pxPerDay = PX_PER_DAY[zoom];
  const { start: rangeStart, end: rangeEnd } = useMemo(() => computeRange(tasks), [tasks]);
  const totalWidth = diffDays(rangeStart, rangeEnd) * pxPerDay;

  const rows = useMemo(
    () => buildRows(tasks, people, swimlane, personFilter),
    [tasks, people, swimlane, personFilter],
  );
  const totalHeight = rows.length
    ? rows[rows.length - 1].top + (rows[rows.length - 1].kind === 'header' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT)
    : 0;

  const positions = useMemo(() => {
    const map = new Map<string, TaskPosition>();
    for (const row of rows) {
      if (row.kind !== 'task') continue;
      const task = row.task;
      const left = xForDate(rangeStart, task.start, pxPerDay);
      const right =
        task.type === 'milestone'
          ? left + pxPerDay
          : left + (diffDays(task.start, task.end) + 1) * pxPerDay;
      const effectiveLeft = task.type === 'milestone' ? left + pxPerDay / 2 : left;
      map.set(task.id, { top: row.top + ROW_HEIGHT / 2, left: effectiveLeft, right });
    }
    return map;
  }, [rows, rangeStart, pxPerDay]);

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

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-auto relative bg-white"
      onClick={() => selectDependency(null)}
    >
      <div style={{ minWidth: LEFT_WIDTH + totalWidth, position: 'relative' }}>
        <div className="flex">
          <div
            className="sticky left-0 z-30 bg-white border-r border-gray-200 shrink-0"
            style={{ width: LEFT_WIDTH }}
          >
            <div
              className="sticky top-0 z-30 bg-white border-b border-gray-200 flex items-end px-3 pb-1 text-xs font-semibold text-gray-500"
              style={{ height: HEADER_HEIGHT }}
            >
              Aufgabe
            </div>
            {rows.map((row) =>
              row.kind === 'header' ? (
                <div
                  key={row.id}
                  className="flex items-center px-3 text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-100"
                  style={{ height: GROUP_HEADER_HEIGHT }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2"
                    style={{ background: row.color ?? '#9ca3af' }}
                  />
                  {row.label}
                </div>
              ) : (
                <div
                  key={row.id}
                  className="flex flex-col justify-center px-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50"
                  style={{ height: ROW_HEIGHT }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTask(row.task.id);
                  }}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="inline-block w-2 h-2 rounded-sm shrink-0"
                      style={{ background: colorForTask(row.task) }}
                    />
                    <span className="text-[12.5px] font-medium text-gray-800 truncate">{row.task.title}</span>
                  </div>
                  <div className="text-[10.5px] text-gray-400 truncate pl-3.5">
                    {formatShort(row.task.start)}
                    {row.task.type === 'task' && row.task.end !== row.task.start ? ` – ${formatShort(row.task.end)}` : ''}
                    {row.task.assigneeIds.length ? `  ·  ${personInitials(row.task.assigneeIds)}` : ''}
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
            <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
              <GridBackground rangeStart={rangeStart} rangeEnd={rangeEnd} zoom={zoom} pxPerDay={pxPerDay} height={totalHeight} />
              <TodayLine rangeStart={rangeStart} pxPerDay={pxPerDay} height={totalHeight} />
              {rows.map((row) =>
                row.kind === 'task' ? (
                  <TaskBar key={row.id} task={row.task} rangeStart={rangeStart} pxPerDay={pxPerDay} top={row.top} />
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
