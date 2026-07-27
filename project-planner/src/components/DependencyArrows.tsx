import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import type { DependencyEnd } from '../store/useProjectStore';
import type { TaskPosition } from './GanttChart';

interface Props {
  positions: Map<string, TaskPosition>;
  width: number;
  height: number;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}

const SCROLL_EDGE = 70;
const SCROLL_MAX_SPEED = 24;

interface RewireState {
  depId: string;
  end: DependencyEnd;
  x: number;
  y: number;
  clientX: number;
  clientY: number;
}

const HANDLE_R = 6;
const HANDLE_HIT_R = 11;
const FAN_SPACING = 11;

/** When several dependencies share the same task+side anchor, spread their
 * y-offset out so each gets its own grabbable handle instead of stacking
 * exactly on top of each other. */
function useFanOffsets(dependencies: { id: string; fromId: string; toId: string }[]) {
  return useMemo(() => {
    const outGroups = new Map<string, string[]>();
    const inGroups = new Map<string, string[]>();
    for (const dep of dependencies) {
      if (!outGroups.has(dep.fromId)) outGroups.set(dep.fromId, []);
      outGroups.get(dep.fromId)!.push(dep.id);
      if (!inGroups.has(dep.toId)) inGroups.set(dep.toId, []);
      inGroups.get(dep.toId)!.push(dep.id);
    }
    function offsetFor(groups: Map<string, string[]>, anchorId: string, depId: string): number {
      const group = groups.get(anchorId) ?? [];
      const count = group.length;
      if (count <= 1) return 0;
      const rank = group.indexOf(depId);
      return (rank - (count - 1) / 2) * FAN_SPACING;
    }
    return {
      fromOffset: (depId: string, fromId: string) => offsetFor(outGroups, fromId, depId),
      toOffset: (depId: string, toId: string) => offsetFor(inGroups, toId, depId),
    };
  }, [dependencies]);
}

export function DependencyArrows({ positions, width, height, scrollContainerRef }: Props) {
  const dependencies = useProjectStore((s) => s.dependencies);
  const selectedDependencyId = useProjectStore((s) => s.selectedDependencyId);
  const selectDependency = useProjectStore((s) => s.selectDependency);
  const removeDependency = useProjectStore((s) => s.removeDependency);
  const rewireDependency = useProjectStore((s) => s.rewireDependency);

  const svgRef = useRef<SVGSVGElement>(null);
  const [rewiring, setRewiring] = useState<RewireState | null>(null);
  const { fromOffset, toOffset } = useFanOffsets(dependencies);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDependencyId) {
        removeDependency(selectedDependencyId);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedDependencyId, removeDependency]);

  useEffect(() => {
    if (!rewiring) return;

    const lastClient = { x: rewiring.clientX, y: rewiring.clientY };

    function toLocal(clientX: number, clientY: number) {
      const rect = svgRef.current?.getBoundingClientRect();
      return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
    }

    function onMove(e: PointerEvent) {
      lastClient.x = e.clientX;
      lastClient.y = e.clientY;
      const { x, y } = toLocal(e.clientX, e.clientY);
      setRewiring((prev) => (prev ? { ...prev, x, y } : prev));
    }

    function onUp(e: PointerEvent) {
      // elementFromPoint only returns the topmost hit, which is often one of
      // the SVG's own handle/arrow elements sitting above the task itself.
      // Walk the full stack so the drop still finds the task underneath.
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      const taskEl = stack.find((el) => el.closest('[data-task-id]'))?.closest('[data-task-id]');
      const taskId = taskEl?.getAttribute('data-task-id');
      setRewiring((current) => {
        if (current && taskId) {
          rewireDependency(current.depId, current.end, taskId);
        }
        return null;
      });
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    // Auto-scroll the timeline while dragging near its edges, so tasks that
    // are currently off-screen can still be reached as a rewire target.
    let rafId: number;
    function tick() {
      const container = scrollContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        let dx = 0;
        let dy = 0;
        if (lastClient.x < rect.left + SCROLL_EDGE) {
          dx = -SCROLL_MAX_SPEED * (1 - Math.max(0, lastClient.x - rect.left) / SCROLL_EDGE);
        } else if (lastClient.x > rect.right - SCROLL_EDGE) {
          dx = SCROLL_MAX_SPEED * (1 - Math.max(0, rect.right - lastClient.x) / SCROLL_EDGE);
        }
        if (lastClient.y < rect.top + SCROLL_EDGE) {
          dy = -SCROLL_MAX_SPEED * (1 - Math.max(0, lastClient.y - rect.top) / SCROLL_EDGE);
        } else if (lastClient.y > rect.bottom - SCROLL_EDGE) {
          dy = SCROLL_MAX_SPEED * (1 - Math.max(0, rect.bottom - lastClient.y) / SCROLL_EDGE);
        }
        if (dx !== 0 || dy !== 0) {
          container.scrollBy(dx, dy);
          const { x, y } = toLocal(lastClient.x, lastClient.y);
          setRewiring((prev) => (prev ? { ...prev, x, y } : prev));
        }
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      cancelAnimationFrame(rafId);
    };
  }, [rewiring?.depId, rewiring?.end, rewireDependency, scrollContainerRef]);

  function startRewire(e: React.PointerEvent, depId: string, end: DependencyEnd) {
    e.stopPropagation();
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    setRewiring({
      depId,
      end,
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
      clientX: e.clientX,
      clientY: e.clientY,
    });
  }

  return (
    <svg
      ref={svgRef}
      className="absolute top-0 left-0 pointer-events-none"
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#6b7280" />
        </marker>
        <marker id="arrowhead-selected" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#4f46e5" />
        </marker>
        <marker id="arrowhead-rewiring" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
        </marker>
      </defs>
      {dependencies.map((dep) => {
        const from = positions.get(dep.fromId);
        const to = positions.get(dep.toId);
        if (!from || !to) return null;

        const fromAnchorY = from.top + fromOffset(dep.id, dep.fromId);
        const toAnchorY = to.top + toOffset(dep.id, dep.toId);

        const isRewiringThis = rewiring?.depId === dep.id;
        const x1 = isRewiringThis && rewiring.end === 'from' ? rewiring.x : from.right;
        const y1 = isRewiringThis && rewiring.end === 'from' ? rewiring.y : fromAnchorY;
        const x2 = isRewiringThis && rewiring.end === 'to' ? rewiring.x : to.left;
        const y2 = isRewiringThis && rewiring.end === 'to' ? rewiring.y : toAnchorY;
        const dx = Math.max(24, Math.abs(x2 - x1) / 2);
        const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
        const selected = selectedDependencyId === dep.id;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        return (
          <g key={dep.id} className="group">
            <path
              d={path}
              fill="none"
              stroke={isRewiringThis ? '#f59e0b' : selected ? '#4f46e5' : '#9ca3af'}
              strokeWidth={selected || isRewiringThis ? 2.5 : 1.5}
              strokeDasharray={isRewiringThis ? '4 3' : undefined}
              markerEnd={isRewiringThis ? 'url(#arrowhead-rewiring)' : selected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
            />
            {!isRewiringThis && (
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  selectDependency(dep.id);
                }}
              />
            )}

            {!isRewiringThis && (
              <>
                <g
                  className="pointer-events-auto cursor-grab"
                  data-dep-id={dep.id}
                  data-dep-end="from"
                  onPointerDown={(e) => startRewire(e, dep.id, 'from')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <circle cx={from.right} cy={fromAnchorY} r={HANDLE_HIT_R} fill="transparent" />
                  <circle
                    cx={from.right}
                    cy={fromAnchorY}
                    r={HANDLE_R}
                    fill="#6b7280"
                    stroke="white"
                    strokeWidth={1.5}
                    className="opacity-70 group-hover:opacity-100"
                  />
                </g>
                <g
                  className="pointer-events-auto cursor-grab"
                  data-dep-id={dep.id}
                  data-dep-end="to"
                  onPointerDown={(e) => startRewire(e, dep.id, 'to')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <circle cx={to.left} cy={toAnchorY} r={HANDLE_HIT_R} fill="transparent" />
                  <circle
                    cx={to.left}
                    cy={toAnchorY}
                    r={HANDLE_R}
                    fill="#6b7280"
                    stroke="white"
                    strokeWidth={1.5}
                    className="opacity-70 group-hover:opacity-100"
                  />
                </g>
              </>
            )}

            {selected && !isRewiringThis && (
              <g
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  removeDependency(dep.id);
                }}
              >
                <circle cx={midX} cy={midY} r={9} fill="#ef4444" />
                <line x1={midX - 4} y1={midY - 4} x2={midX + 4} y2={midY + 4} stroke="white" strokeWidth={1.6} />
                <line x1={midX - 4} y1={midY + 4} x2={midX + 4} y2={midY - 4} stroke="white" strokeWidth={1.6} />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
