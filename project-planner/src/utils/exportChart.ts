import { today } from './date';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// html2canvas's render time grows roughly with output pixel count, so a
// fixed scale of 2 turns brutal on the continuous (non-paged) Tage/Wochen/
// Jahre zooms, where the captured element is the FULL scrollable plan width,
// not just the visible viewport -- weeks/months of a long project easily
// means tens of thousands of pixels wide. Capping the longer side keeps
// exports fast regardless of zoom level or plan length, while still using
// the full scale: 2 crispness for anything reasonably sized (e.g. a single
// paged month/quarter view).
const MAX_OUTPUT_DIMENSION = 6000;

/** html2canvas/jspdf are only loaded when an export is actually triggered --
 * a few hundred KB nobody needs on every page load of a small internal tool. */
async function captureCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas');
  const longerSide = Math.max(el.scrollWidth, el.scrollHeight);
  const scale = Math.min(2, MAX_OUTPUT_DIMENSION / longerSide);
  return html2canvas(el, { backgroundColor: '#ffffff', scale, logging: false });
}

/** Exports exactly what's currently on screen (zoom level, filters, etc.) --
 * there's no attempt to auto-fit "the whole plan" onto one image, since a
 * multi-year plan at full detail would just be illegible either way. */
export async function exportChartAsPng(el: HTMLElement): Promise<void> {
  const canvas = await captureCanvas(el);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (blob) downloadBlob(blob, `myprosole-zeitplan-${today()}.png`);
}

/** One PDF page sized exactly to the captured image (not squeezed into A4),
 * so long/wide plans stay readable at their native resolution. */
export async function exportChartAsPdf(el: HTMLElement): Promise<void> {
  const canvas = await captureCanvas(el);
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height],
  });
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
  doc.save(`myprosole-zeitplan-${today()}.pdf`);
}
