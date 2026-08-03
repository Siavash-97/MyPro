import type { Task, Dependency, Person } from '../types';
import { buildRows, computeRange, xForDate } from './layout';
import { computeRollups } from './hierarchy';
import { computeCriticalPath } from './schedule';
import { computeOverallProgress, nextMilestone, countOverdueTasks } from './dashboardStats';
import { computeMonthBuckets } from './resourceUtilization';
import { formatShort, diffDays, today, parseISO } from './date';

// Print layout constants (pt). Kept separate from the on-screen ROW_HEIGHT/
// PX_PER_DAY constants -- a printed report is deliberately more compact than
// the interactive chart.
const MARGIN = 32;
const SIDEBAR_WIDTH = 230;
const ROW_HEIGHT = 15;
const HEADER_HEIGHT = 26;
const MAX_CHART_WIDTH = 2200;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

/** Mimics the on-screen "bg-black/15" progress-dimming overlay (see
 * TaskBar.tsx) by darkening the bar color directly instead of layering a
 * translucent shape -- no color blending/opacity API needed, so nothing
 * that could misrender. */
function darken([r, g, b]: [number, number, number], factor: number): [number, number, number] {
  return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)];
}

/** Truncates to a single line instead of letting jsPDF's text() wrap --
 * wrapping would need a taller row to avoid overlapping the row below, and
 * a print report reads fine with a plain single-line "..." cutoff, same as
 * the on-screen sidebar's `truncate` CSS behavior. */
function truncateToWidth(doc: import('jspdf').jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && doc.getTextWidth(text.slice(0, end) + '…') > maxWidth) end--;
  return text.slice(0, end) + '…';
}

function drawTitlePage(doc: import('jspdf').jsPDF, tasks: Task[]): void {
  const realTasks = tasks.filter((t) => t.type === 'task');
  const milestones = tasks.filter((t) => t.type === 'milestone');
  const starts = tasks.map((t) => t.start).sort();
  const ends = tasks.map((t) => t.end).sort();
  const milestone = nextMilestone(tasks);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('MyProSole Projektplaner', MARGIN, 70);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('Zeitplan-Report', MARGIN, 92);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Erstellt am ${formatShort(today())}`, MARGIN, 108);
  doc.setTextColor(0, 0, 0);

  let y = 150;
  function stat(label: string, value: string) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(label, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, MARGIN + 170, y);
    y += 22;
  }
  stat('Gesamtfortschritt:', `${computeOverallProgress(tasks)}%`);
  stat('Zeitraum:', tasks.length ? `${formatShort(starts[0])} – ${formatShort(ends[ends.length - 1])}` : '–');
  stat('Anzahl Aufgaben:', String(realTasks.length));
  stat('Anzahl Meilensteine:', String(milestones.length));
  stat('Überfällige Aufgaben:', String(countOverdueTasks(tasks)));
  stat('Nächster Meilenstein:', milestone ? `${milestone.title} (${formatShort(milestone.start)})` : 'Keiner');
}

function drawTaskTablePage(doc: import('jspdf').jsPDF, tasks: Task[], people: Person[]): void {
  doc.addPage('a4', 'landscape');
  const rows = buildRows(tasks, people, false, null, new Set(), 'start');
  const rollups = computeRollups(tasks);
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const colX = [MARGIN, MARGIN + 320, MARGIN + 400, MARGIN + 470, MARGIN + 540, MARGIN + 610];
  const rowH = 16;
  let y = 40;

  function header() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('MyProSole -- Aufgabenübersicht', MARGIN, y);
    y += 22;
    doc.setFontSize(9);
    ['Aufgabe', 'Start', 'Ende', 'Dauer (Tage)', 'Fortschritt', 'Person(en)'].forEach((label, i) =>
      doc.text(label, colX[i], y),
    );
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += rowH;
  }

  header();
  for (const row of rows) {
    if (row.kind !== 'task') continue;
    if (y > pageHeight - 40) {
      doc.addPage('a4', 'landscape');
      y = 40;
      header();
    }
    const effective = row.hasChildren ? rollups.get(row.task.id) : undefined;
    const start = effective?.start ?? row.task.start;
    const end = effective?.end ?? row.task.end;
    const progress = effective?.progress ?? row.task.progress;
    const duration = row.task.type === 'milestone' ? '–' : String(diffDays(start, end) + 1);
    const personNames = row.task.assigneeIds
      .map((id) => people.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    doc.text(row.task.title.slice(0, 60), colX[0] + row.indent * 10, y);
    doc.text(formatShort(start), colX[1], y);
    doc.text(row.task.type === 'milestone' ? '' : formatShort(end), colX[2], y);
    doc.text(duration, colX[3], y);
    doc.text(`${progress}%`, colX[4], y);
    doc.text(personNames, colX[5], y);
    y += rowH;
  }
}

function drawGanttPage(doc: import('jspdf').jsPDF, tasks: Task[], dependencies: Dependency[], people: Person[]): void {
  const rows = buildRows(tasks, people, false, null, new Set(), 'start').filter((r) => r.kind === 'task');
  const rollups = computeRollups(tasks);
  const criticalIds = computeCriticalPath(tasks, dependencies);
  const range = computeRange(tasks);
  const totalDays = Math.max(diffDays(range.start, range.end) + 1, 1);
  const pxPerDay = Math.max(2, MAX_CHART_WIDTH / totalDays);
  const chartWidth = totalDays * pxPerDay;
  const chartHeight = rows.length * ROW_HEIGHT;
  const pageWidth = MARGIN * 2 + SIDEBAR_WIDTH + chartWidth;
  const pageHeight = MARGIN * 2 + 30 + HEADER_HEIGHT + chartHeight;

  doc.addPage([pageWidth, pageHeight]);

  const originX = MARGIN;
  const chartX = originX + SIDEBAR_WIDTH;
  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Gantt-Chart', originX, y);
  y += 18;
  const headerTop = y;
  const chartTop = headerTop + HEADER_HEIGHT;
  const chartBottom = chartTop + chartHeight;

  // Month header + vertical gridlines
  const months = computeMonthBuckets(tasks);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  for (const m of months) {
    const x = chartX + xForDate(range.start, m, pxPerDay);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.4);
    doc.line(x, headerTop, x, chartBottom);
    const label = parseISO(m).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
    doc.text(label, x + 2, headerTop + HEADER_HEIGHT - 6);
  }
  const rangeEndX = chartX + xForDate(range.start, range.end, pxPerDay) + pxPerDay;
  doc.line(rangeEndX, headerTop, rangeEndX, chartBottom);
  doc.setTextColor(0, 0, 0);

  // Today marker
  const t0 = today();
  if (t0 >= range.start && t0 <= range.end) {
    const x = chartX + xForDate(range.start, t0, pxPerDay);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.6);
    doc.line(x, chartTop, x, chartBottom);
  }

  const positions = new Map<string, { left: number; right: number; midY: number }>();

  rows.forEach((row, i) => {
    if (row.kind !== 'task') return;
    const rowY = chartTop + i * ROW_HEIGHT;
    const midY = rowY + ROW_HEIGHT / 2;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', row.hasChildren ? 'bold' : 'normal');
    doc.setTextColor(30, 30, 30);
    const availableWidth = SIDEBAR_WIDTH - row.indent * 8 - 4;
    doc.text(truncateToWidth(doc, row.task.title, availableWidth), originX + row.indent * 8, midY + 2);

    const effective = row.hasChildren ? rollups.get(row.task.id) : undefined;
    const start = effective?.start ?? row.task.start;
    const end = effective?.end ?? row.task.end;
    const progress = effective?.progress ?? row.task.progress;
    const rgb = hexToRgb(row.task.color);

    if (row.task.type === 'milestone') {
      const cx = chartX + xForDate(range.start, start, pxPerDay) + pxPerDay / 2;
      const size = 5;
      doc.setFillColor(...rgb);
      doc.triangle(cx - size, midY, cx, midY - size, cx + size, midY, 'F');
      doc.triangle(cx - size, midY, cx, midY + size, cx + size, midY, 'F');
      positions.set(row.task.id, { left: cx, right: cx, midY });
      return;
    }

    const barX = chartX + xForDate(range.start, start, pxPerDay);
    const barW = Math.max((diffDays(start, end) + 1) * pxPerDay, 2);
    const barY = midY - 4;
    const barH = 8;

    doc.setFillColor(...rgb);
    doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F');
    if (progress > 0 && progress < 100) {
      const doneW = (barW * progress) / 100;
      const dim = darken(rgb, 0.7);
      doc.setFillColor(...dim);
      doc.rect(barX + doneW, barY, barW - doneW, barH, 'F');
    } else if (progress === 0) {
      const dim = darken(rgb, 0.7);
      doc.setFillColor(...dim);
      doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F');
    }

    if (criticalIds.has(row.task.id)) {
      doc.setDrawColor(249, 115, 22);
      doc.setLineWidth(0.9);
    } else if (row.hasChildren) {
      doc.setDrawColor(75, 85, 99);
      doc.setLineWidth(0.9);
    } else {
      doc.setDrawColor(140, 140, 140);
      doc.setLineWidth(0.3);
    }
    doc.roundedRect(barX, barY, barW, barH, 1, 1, 'S');

    positions.set(row.task.id, { left: barX, right: barX + barW, midY });
  });

  // Dependency arrows -- same bezier geometry as DependencyArrows.tsx
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.6);
  for (const dep of dependencies) {
    const from = positions.get(dep.fromId);
    const to = positions.get(dep.toId);
    if (!from || !to) continue;
    const x1 = from.right;
    const y1 = from.midY;
    const x2 = to.left;
    const y2 = to.midY;
    const dx = Math.max(12, Math.abs(x2 - x1) / 2);
    doc.moveTo(x1, y1);
    doc.curveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
    doc.stroke();
    doc.setFillColor(156, 163, 175);
    doc.triangle(x2, y2, x2 - 5, y2 - 2.5, x2 - 5, y2 + 2.5, 'F');
  }
}

/** Draws the whole plan directly with jsPDF's own vector primitives instead
 * of screenshotting the rendered DOM -- sidesteps the entire html2canvas-
 * family bug category (color parsing, opacity compositing, blurry text on
 * high-DPI screens) since nothing here touches CSS at all. Always exports
 * the complete plan (full hierarchy expanded), independent of the current
 * on-screen zoom/filter/swimlane state. */
export async function exportGanttReportAsPdf(tasks: Task[], dependencies: Dependency[], people: Person[]): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  drawTitlePage(doc, tasks);
  drawTaskTablePage(doc, tasks, people);
  drawGanttPage(doc, tasks, dependencies, people);
  doc.save(`myprosole-report-${today()}.pdf`);
}
