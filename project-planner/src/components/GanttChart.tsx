import { useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import type { SidebarSort } from '../utils/layout';
import { buildRows, computeRange, ROW_HEIGHT, GROUP_HEADER_HEIGHT, xForDate, personIdAtY } from '../utils/layout';
import { filterTasksBySidebar } from '../utils/sidebarFilter';
import {
  addDays,
  diffDays,
  formatShort,
  PX_PER_DAY,
  today,
  startOfMonth,
  endOfMonth,
  addMonths,
  startOfQuarter,
  endOfQuarter,
  addQuarters,
  startOfYear,
  endOfYear,
  addYears,
} from '../utils/date';
import { TimelineHeader } from './TimelineHeader';
import { GridBackground } from './GridBackground';
import { TodayLine } from './TodayLine';
import { TaskBar } from './TaskBar';
import { DependencyArrows } from './DependencyArrows';
import { computeCriticalPath } from '../utils/schedule';
import { computeRollups } from '../utils/hierarchy';
import { useRoleStore } from '../store/useRoleStore';
import { useOutlineStore } from '../store/useOutlineStore';
import { exportGanttReportAsPdf } from '../utils/ganttReport';
import { hexToRgba } from '../utils/colors';

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
const PAGE_NAV_HEIGHT = 32;
const FILTER_PANEL_HEIGHT = 84;

type PagedZoom = 'month' | 'quarter' | 'year';

function isPagedZoom(zoom: string): zoom is PagedZoom {
  return zoom === 'month' || zoom === 'quarter' || zoom === 'year';
}

/** Pick a useful initial period instead of blindly opening "today", which
 * may be completely empty for a project that starts in the future or has
 * already finished. */
function initialPageAnchor(tasks: { start: string; end: string }[]): string {
  const t0 = today();
  if (tasks.some((task) => task.start <= t0 && task.end >= t0)) return t0;

  const nextTask = [...tasks]
    .filter((task) => task.end >= t0)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  if (nextTask) return nextTask.start;

  const lastTask = [...tasks].sort((a, b) => b.end.localeCompare(a.end))[0];
  return lastTask?.end ?? t0;
}

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
  const startNewTask = useProjectStore((s) => s.startNewTask);
  const isViewer = useRoleStore((s) => s.role === 'viewer');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const viewportWidth = useViewportWidth();
  const isMobile = viewportWidth < MOBILE_BREAKPOINT;
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= MOBILE_BREAKPOINT);
  const leftWidth = isMobile ? LEFT_WIDTH_MOBILE : LEFT_WIDTH_DESKTOP;
  const collapsedIds = useOutlineStore((s) => s.collapsedIds);
  const toggleCollapsed = useOutlineStore((s) => s.toggle);

  // Sidebar search/date/sort filtering -- a per-device viewing convenience
  // (like collapse state), not part of the shared plan, so it's plain local
  // state rather than synced project data.
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SidebarSort>('start');
  const hasActiveFilter = searchQuery.trim() !== '' || !!dateFrom || !!dateTo;

  // Month/quarter/year show exactly one calendar period at a time. The
  // anchor survives zoom switches, so moving from one period scale to
  // another keeps the user at roughly the same point in the project.
  const isPaged = isPagedZoom(zoom);
  const [pageAnchor, setPageAnchor] = useState(() => initialPageAnchor(tasks));

  function goToPrevPage() {
    setPageAnchor((prev) =>
      zoom === 'year' ? addYears(prev, -1) : zoom === 'quarter' ? addQuarters(prev, -1) : addMonths(prev, -1),
    );
  }
  function goToNextPage() {
    setPageAnchor((prev) =>
      zoom === 'year' ? addYears(prev, 1) : zoom === 'quarter' ? addQuarters(prev, 1) : addMonths(prev, 1),
    );
  }
  function goToTodayPage() {
    setPageAnchor(today());
  }

  const fullRange = useMemo(() => computeRange(tasks), [tasks]);
  const { start: rangeStart, end: rangeEnd } = useMemo(() => {
    if (zoom === 'month') return { start: startOfMonth(pageAnchor), end: endOfMonth(pageAnchor) };
    if (zoom === 'quarter') return { start: startOfQuarter(pageAnchor), end: endOfQuarter(pageAnchor) };
    if (zoom === 'year') return { start: startOfYear(pageAnchor), end: endOfYear(pageAnchor) };
    return fullRange;
  }, [zoom, pageAnchor, fullRange]);

  // Paged views stretch to fill the actual available width
  // instead of using a fixed px-per-day -- otherwise a single month at a
  // fixed scale is much narrower than the screen and leaves a blank gap on
  // wide monitors. Day/week keep their fixed scale since those legitimately
  // scroll horizontally through a longer range.
  const sidebarWidthNow = sidebarOpen ? leftWidth : COLLAPSED_WIDTH;
  const pxPerDay = useMemo(() => {
    if (!isPaged) return PX_PER_DAY[zoom];
    const days = diffDays(rangeStart, rangeEnd) + 1;
    const available = viewportWidth - sidebarWidthNow - 4;
    const minimumPxPerDay = zoom === 'year' ? 1.5 : 4;
    return Math.max(available / days, minimumPxPerDay);
  }, [isPaged, zoom, rangeStart, rangeEnd, viewportWidth, sidebarWidthNow]);
  const totalWidth = (diffDays(rangeStart, rangeEnd) + 1) * pxPerDay;

  const rollups = useMemo(() => computeRollups(tasks), [tasks]);

  // Sidebar search/date filter -- applied before paging so both narrow the
  // same underlying set. Ancestors of a match are kept even when they don't
  // match themselves (see filterTasksBySidebar), so the hierarchy still
  // reads sensibly instead of showing orphaned children.
  const searchFilteredTasks = useMemo(
    () => filterTasksBySidebar(tasks, { search: searchQuery, dateFrom, dateTo }),
    [tasks, searchQuery, dateFrom, dateTo],
  );

  // Only the bars are limited to the visible calendar period. The task and
  // person rows deliberately keep the complete filtered project structure,
  // so changing the time scale never makes the left-hand list disappear.
  const visibleTimelineTaskIds = useMemo(() => {
    const visibleTasks = !isPaged ? searchFilteredTasks : searchFilteredTasks.filter((t) => {
      const r = rollups.get(t.id);
      const s = r?.start ?? t.start;
      const e = r?.end ?? t.end;
      return s <= rangeEnd && e >= rangeStart;
    });
    return new Set(visibleTasks.map((task) => task.id));
  }, [searchFilteredTasks, isPaged, rangeStart, rangeEnd, rollups]);

  const rows = useMemo(
    () => buildRows(searchFilteredTasks, people, swimlane, personFilter, collapsedIds, sortBy),
    [searchFilteredTasks, people, swimlane, personFilter, collapsedIds, sortBy],
  );
  const criticalTaskIds = useMemo(() => computeCriticalPath(tasks, dependencies), [tasks, dependencies]);
  const totalHeight = rows.length
    ? rows[rows.length - 1].top + (rows[rows.length - 1].kind === 'header' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT)
    : 0;

  /** In swimlane mode, every row (header and its tasks) gets a faint tint of
   * that person's color so the eye can tell where one person's block ends
   * and the next begins without needing a visible border on every row. */
  const rowBandColor = useMemo(() => {
    const map = new Map<string, string>();
    if (!swimlane) return map;
    let current: string | undefined;
    for (const row of rows) {
      if (row.kind === 'header') current = row.color ?? '#9ca3af';
      map.set(row.id, current ?? '#9ca3af');
    }
    return map;
  }, [rows, swimlane]);

  const groupBands = useMemo(() => {
    if (!swimlane) return [];
    const headers = rows.filter((r) => r.kind === 'header');
    return headers.map((h, i) => ({
      top: h.top,
      height: (headers[i + 1]?.top ?? totalHeight) - h.top,
      color: h.color ?? '#9ca3af',
    }));
  }, [rows, swimlane, totalHeight]);

  const positions = useMemo(() => {
    const map = new Map<string, TaskPosition>();
    for (const row of rows) {
      if (row.kind !== 'task') continue;
      if (!visibleTimelineTaskIds.has(row.task.id)) continue;
      const task = row.task;
      const effective = row.hasChildren ? rollups.get(task.id) : undefined;
      const start = effective?.start ?? task.start;
      const end = effective?.end ?? task.end;
      const displayStart = isPaged && start < rangeStart ? rangeStart : start;
      const displayEnd = isPaged && end > rangeEnd ? rangeEnd : end;
      const left = xForDate(rangeStart, displayStart, pxPerDay);
      const right =
        task.type === 'milestone' ? left + pxPerDay : left + (diffDays(displayStart, displayEnd) + 1) * pxPerDay;
      const effectiveLeft = task.type === 'milestone' ? left + pxPerDay / 2 : left;
      map.set(task.id, { top: row.top + ROW_HEIGHT / 2, left: effectiveLeft, right });
    }
    return map;
  }, [rows, visibleTimelineTaskIds, rangeStart, rangeEnd, pxPerDay, rollups, isPaged]);

  // A zoom change replaces the complete time-axis geometry. Reposition the
  // viewport at a useful project date instead of retaining a stale horizontal
  // scroll offset from the previous scale.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (isPaged) {
      container.scrollLeft = 0;
      return;
    }
    const focusX = xForDate(rangeStart, pageAnchor, pxPerDay);
    const timelineViewportWidth = Math.max(container.clientWidth - sidebarWidthNow, 0);
    container.scrollLeft = Math.max(focusX - timelineViewportWidth / 2, 0);
  }, [zoom, rangeStart, pxPerDay, isPaged, sidebarWidthNow, pageAnchor]);

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

  async function handleExportReport() {
    setExportingPdf(true);
    try {
      await exportGanttReportAsPdf(tasks, dependencies, people);
    } catch (err) {
      alert(`PDF-Export fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExportingPdf(false);
    }
  }

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    if (isViewer) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dayIndex = Math.floor(x / pxPerDay);
    const dateISO = addDays(rangeStart, dayIndex);
    const personId = swimlane ? personIdAtY(rows, y) : undefined;
    startNewTask({ start: dateISO, end: dateISO, assigneeIds: personId ? [personId] : [] });
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div className="absolute top-2 right-3 z-50 flex gap-1.5">
        <button
          onClick={handleExportReport}
          disabled={exportingPdf}
          title="Gesamten Plan als PDF-Report exportieren (Titelseite, Aufgabentabelle, Gantt-Chart)"
          className="text-xs font-medium text-gray-600 bg-white border border-gray-200 shadow-sm px-2.5 py-1 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          {exportingPdf ? 'Exportiere…' : 'Als PDF exportieren'}
        </button>
      </div>
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
              className="sticky top-0 z-30 bg-white border-b border-gray-200 flex flex-col"
              style={{
                height:
                  HEADER_HEIGHT + (isPaged ? PAGE_NAV_HEIGHT : 0) + (sidebarOpen && filterPanelOpen ? FILTER_PANEL_HEIGHT : 0),
              }}
            >
              <div
                className="flex items-center justify-between px-1 text-xs font-semibold text-gray-500 shrink-0"
                style={{ height: HEADER_HEIGHT }}
              >
                {sidebarOpen && <span className="pl-2 truncate">Aufgabe</span>}
                <div className="flex items-center gap-0.5 shrink-0">
                  {sidebarOpen && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilterPanelOpen((v) => !v);
                      }}
                      className={`shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 ${
                        filterPanelOpen || hasActiveFilter ? 'text-blue-600' : 'text-gray-500'
                      }`}
                      title={filterPanelOpen ? 'Suche/Filter ausblenden' : 'Suchen & filtern'}
                    >
                      🔍
                    </button>
                  )}
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
              </div>
              {sidebarOpen && filterPanelOpen && (
                <div className="px-2 pb-1 flex flex-col gap-1" style={{ height: FILTER_PANEL_HEIGHT }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Nach Titel suchen…"
                    className="w-full h-6 text-[11px] border border-gray-200 rounded px-2 focus:outline-none focus:border-blue-400"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={dateFrom ?? ''}
                      onChange={(e) => setDateFrom(e.target.value || null)}
                      onClick={(e) => e.stopPropagation()}
                      title="Von"
                      className="flex-1 min-w-0 h-6 text-[10.5px] border border-gray-200 rounded px-1 focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="date"
                      value={dateTo ?? ''}
                      onChange={(e) => setDateTo(e.target.value || null)}
                      onClick={(e) => e.stopPropagation()}
                      title="Bis"
                      className="flex-1 min-w-0 h-6 text-[10.5px] border border-gray-200 rounded px-1 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SidebarSort)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 text-[10.5px] border border-gray-200 rounded px-1 focus:outline-none focus:border-blue-400"
                    >
                      <option value="start">Nach Datum</option>
                      <option value="title">Nach Name</option>
                    </select>
                    {hasActiveFilter && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchQuery('');
                          setDateFrom(null);
                          setDateTo(null);
                        }}
                        className="text-[10.5px] font-medium text-blue-600 hover:text-blue-700 shrink-0"
                      >
                        Zurücksetzen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            {sidebarOpen &&
              rows.map((row) =>
                row.kind === 'header' ? (
                  <div
                    key={row.id}
                    className="flex items-center px-3 text-xs font-semibold text-gray-700 border-b border-gray-100 cursor-pointer"
                    style={{
                      height: GROUP_HEADER_HEIGHT,
                      background: hexToRgba(rowBandColor.get(row.id) ?? '#9ca3af', 0.12),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapsed(row.id);
                    }}
                  >
                    <button
                      className="shrink-0 w-3.5 h-3.5 flex items-center justify-center text-gray-400 hover:text-gray-700 mr-1"
                      title={collapsedIds.has(row.id) ? 'Aufklappen' : 'Einklappen'}
                    >
                      {collapsedIds.has(row.id) ? '▸' : '▾'}
                    </button>
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2 shrink-0"
                      style={{ background: row.color ?? '#9ca3af' }}
                    />
                    <span className="truncate">{row.label}</span>
                  </div>
                ) : (
                  <div
                    key={row.id}
                    className="flex flex-col justify-center px-3 border-b border-gray-50 cursor-pointer"
                    style={{
                      height: ROW_HEIGHT,
                      paddingLeft: 12 + row.indent * 14,
                      background: rowBandColor.has(row.id) ? hexToRgba(rowBandColor.get(row.id)!, 0.05) : undefined,
                    }}
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
            <div className="sticky top-0 z-20 bg-white">
              {sidebarOpen && filterPanelOpen && <div style={{ height: FILTER_PANEL_HEIGHT }} />}
              {isPaged && (
                <div
                  className="flex items-center gap-2 h-8 px-2 border-b border-gray-200 bg-white"
                  style={{ width: totalWidth }}
                >
                  <button
                    onClick={goToPrevPage}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
                    title={
                      zoom === 'year' ? 'Vorheriges Jahr' : zoom === 'quarter' ? 'Vorheriges Quartal' : 'Vorheriger Monat'
                    }
                  >
                    ‹
                  </button>
                  <span className="text-xs font-semibold text-gray-700 min-w-[9rem] text-center">
                    {zoom === 'year'
                      ? new Date(rangeStart).getFullYear()
                      : zoom === 'quarter'
                        ? `Q${Math.floor(new Date(rangeStart).getMonth() / 3) + 1} ${new Date(rangeStart).getFullYear()}`
                        : new Date(rangeStart).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={goToNextPage}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
                    title={
                      zoom === 'year' ? 'Nächstes Jahr' : zoom === 'quarter' ? 'Nächstes Quartal' : 'Nächster Monat'
                    }
                  >
                    ›
                  </button>
                  <button
                    onClick={goToTodayPage}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700 ml-1"
                  >
                    Heute
                  </button>
                </div>
              )}
              <TimelineHeader
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                zoom={zoom}
                pxPerDay={pxPerDay}
                totalWidth={totalWidth}
              />
            </div>
            <div
              className={isViewer ? 'relative' : 'relative cursor-cell'}
              style={{ width: totalWidth, height: totalHeight }}
              onClick={handleGridClick}
              title={isViewer ? undefined : 'Klicken, um hier eine Aufgabe anzulegen'}
            >
              <GridBackground rangeStart={rangeStart} rangeEnd={rangeEnd} zoom={zoom} pxPerDay={pxPerDay} height={totalHeight} />
              {groupBands.map((band) => (
                <div
                  key={band.top}
                  className="absolute left-0 pointer-events-none"
                  style={{ top: band.top, height: band.height, width: totalWidth, background: hexToRgba(band.color, 0.05) }}
                />
              ))}
              {today() >= rangeStart && today() <= rangeEnd && (
                <TodayLine rangeStart={rangeStart} pxPerDay={pxPerDay} height={totalHeight} />
              )}
              {rows.map((row) =>
                row.kind === 'task' && visibleTimelineTaskIds.has(row.task.id) ? (
                  <TaskBar
                    key={row.id}
                    task={row.task}
                    rangeStart={rangeStart}
                    pxPerDay={pxPerDay}
                    top={row.top}
                    isCritical={criticalTaskIds.has(row.task.id)}
                    rollup={row.hasChildren ? rollups.get(row.task.id) : undefined}
                    rangeEnd={rangeEnd}
                    clipToRange={isPaged}
                    minBarWidth={zoom === 'year' ? 6 : 0}
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
    </div>
  );
}
