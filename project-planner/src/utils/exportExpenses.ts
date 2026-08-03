import type { Expense } from '../lib/expenses';
import type { Task, WorkPackage } from '../types';
import { formatShort, today } from './date';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function taskLabel(expense: Expense, tasks: Task[]): string {
  return tasks.find((t) => t.id === expense.taskId)?.title ?? '(gelöschte Aufgabe)';
}

function workPackageLabel(expense: Expense, tasks: Task[], workPackages: WorkPackage[]): string {
  const task = tasks.find((t) => t.id === expense.taskId);
  const wp = task ? workPackages.find((w) => w.id === task.workPackageId) : undefined;
  return wp?.name ?? '– Ohne Arbeitspaket –';
}

function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** No spreadsheet library is used here on purpose -- the well-known "xlsx"
 * (SheetJS) package has long-standing high-severity advisories with no fix
 * on npm. A semicolon-delimited CSV (the separator German-locale Excel
 * expects, since it uses comma as the decimal separator) opens natively in
 * Excel without that dependency or its risk. */
export function exportExpensesAsCsv(expenses: Expense[], tasks: Task[], workPackages: WorkPackage[]): void {
  const header = ['Datum', 'Aufgabe', 'Arbeitspaket', 'Beschreibung', 'Betrag (EUR)', 'Rechnungsnr.', 'Erfasst von'];
  const rows = expenses.map((e) => [
    formatShort(e.createdAt.slice(0, 10)),
    taskLabel(e, tasks),
    workPackageLabel(e, tasks, workPackages),
    e.description,
    e.amount.toFixed(2).replace('.', ','),
    e.invoiceNumber ?? '',
    e.createdBy ?? '',
  ]);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  rows.push(['', '', '', 'Summe', total.toFixed(2).replace('.', ','), '', '']);

  const lines = [header, ...rows].map((cols) => cols.map(csvField).join(';'));
  const csv = '﻿' + lines.join('\r\n'); // BOM so Excel renders Umlaute correctly
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `myprosole-ausgaben-${today()}.csv`);
}

export async function exportExpensesAsPdf(expenses: Expense[], tasks: Task[], workPackages: WorkPackage[]): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const marginX = 32;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const colX = [marginX, marginX + 70, marginX + 190, marginX + 320, marginX + 560, marginX + 650];
  const rowHeight = 18;
  let y = 40;

  function header() {
    doc.setFontSize(14);
    doc.text('MyProSole -- Ausgabenübersicht', marginX, y);
    doc.setFontSize(9);
    doc.text(`Exportiert am ${formatShort(today())}`, pageWidth - marginX - 120, y);
    y += 22;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const labels = ['Datum', 'Aufgabe', 'Arbeitspaket', 'Beschreibung', 'Betrag', 'Rechnungsnr.'];
    labels.forEach((label, i) => doc.text(label, colX[i], y));
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.line(marginX, y, pageWidth - marginX, y);
    y += rowHeight;
  }

  header();
  let total = 0;
  for (const e of expenses) {
    if (y > pageHeight - 60) {
      doc.addPage();
      y = 40;
      header();
    }
    total += e.amount;
    const cells = [
      formatShort(e.createdAt.slice(0, 10)),
      taskLabel(e, tasks).slice(0, 22),
      workPackageLabel(e, tasks, workPackages).slice(0, 22),
      e.description.slice(0, 38),
      `${e.amount.toFixed(2)} €`,
      e.invoiceNumber ?? '',
    ];
    cells.forEach((cell, i) => doc.text(cell, colX[i], y));
    y += rowHeight;
  }

  y += 8;
  doc.line(marginX, y, pageWidth - marginX, y);
  y += rowHeight;
  doc.setFont('helvetica', 'bold');
  doc.text('Summe', colX[3], y);
  doc.text(`${total.toFixed(2)} €`, colX[4], y);

  doc.save(`myprosole-ausgaben-${today()}.pdf`);
}
