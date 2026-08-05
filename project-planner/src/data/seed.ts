import type { ProjectData } from '../types';
import { addDays, today } from '../utils/date';
import { deriveTaskStatus } from '../utils/taskStatus';

const t0 = today();

export function buildSeedData(): ProjectData {
  const people = [
    { id: 'p-siavash', name: 'Siavash', color: '#2563eb' },
    { id: 'p-bastian', name: 'Bastian', color: '#16a34a' },
    { id: 'p-lutz', name: 'Lutz', color: '#dc2626' },
  ];

  const workPackages = [
    { id: 'wp-hw', name: 'Hardware-Sprint', color: '#d97706' },
    { id: 'wp-ap1', name: 'AP1 Sensorik & Material', color: '#7c3aed' },
    { id: 'wp-ap2', name: 'AP2 Software/App/Backend', color: '#2563eb' },
    { id: 'wp-ap3', name: 'AP3 Interne Validierung', color: '#0891b2' },
    { id: 'wp-ap4', name: 'AP4 MVP & Gründungsvorbereitung', color: '#db2777' },
  ];

  const tasksWithoutStatus = [
    {
      id: 'tk-1',
      type: 'task' as const,
      title: 'Sensor-Auswahl & Beschaffung',
      start: addDays(t0, -10),
      end: addDays(t0, -2),
      assigneeIds: ['p-lutz'],
      workPackageId: 'wp-hw',
      color: '#d97706',
      progress: 100,
      notes: 'Drucksensoren und IMU-Module evaluiert und bestellt.',
      parentId: null,
    },
    {
      id: 'tk-2',
      type: 'task' as const,
      title: 'Leiterplatten-Design',
      start: addDays(t0, -1),
      end: addDays(t0, 8),
      assigneeIds: ['p-lutz', 'p-bastian'],
      workPackageId: 'wp-hw',
      color: '#d97706',
      progress: 40,
      notes: '',
      parentId: null,
    },
    {
      id: 'tk-3',
      type: 'task' as const,
      title: 'Materialauswahl Einlegesohle',
      start: addDays(t0, -5),
      end: addDays(t0, 5),
      assigneeIds: ['p-siavash'],
      workPackageId: 'wp-ap1',
      color: '#7c3aed',
      progress: 55,
      notes: '',
      parentId: null,
    },
    {
      id: 'tk-4',
      type: 'task' as const,
      title: 'Sensorintegration in Sohle',
      start: addDays(t0, 9),
      end: addDays(t0, 20),
      assigneeIds: ['p-siavash', 'p-lutz'],
      workPackageId: 'wp-ap1',
      color: '#7c3aed',
      progress: 0,
      notes: '',
      parentId: null,
    },
    {
      id: 'ms-1',
      type: 'milestone' as const,
      title: 'Hardware-Prototyp fertig',
      start: addDays(t0, 20),
      end: addDays(t0, 20),
      assigneeIds: ['p-lutz'],
      workPackageId: 'wp-hw',
      color: '#b45309',
      progress: 0,
      notes: '',
      parentId: null,
    },
    {
      id: 'tk-5',
      type: 'task' as const,
      title: 'Backend-API Grundgerüst',
      start: addDays(t0, -8),
      end: addDays(t0, 2),
      assigneeIds: ['p-bastian'],
      workPackageId: 'wp-ap2',
      color: '#2563eb',
      progress: 70,
      notes: '',
      parentId: null,
    },
    {
      id: 'tk-6',
      type: 'task' as const,
      title: 'App UI: Laufanalyse-Dashboard',
      start: addDays(t0, 3),
      end: addDays(t0, 16),
      assigneeIds: ['p-bastian'],
      workPackageId: 'wp-ap2',
      color: '#2563eb',
      progress: 10,
      notes: '',
      parentId: null,
    },
    {
      id: 'tk-7',
      type: 'task' as const,
      title: 'Datenpipeline Sensordaten -> Backend',
      start: addDays(t0, 21),
      end: addDays(t0, 30),
      assigneeIds: ['p-bastian', 'p-lutz'],
      workPackageId: 'wp-ap2',
      color: '#2563eb',
      progress: 0,
      notes: '',
      parentId: null,
    },
    {
      id: 'tk-8',
      type: 'task' as const,
      title: 'Interne Testläufe (Probanden)',
      start: addDays(t0, 31),
      end: addDays(t0, 42),
      assigneeIds: ['p-siavash', 'p-bastian', 'p-lutz'],
      workPackageId: 'wp-ap3',
      color: '#0891b2',
      progress: 0,
      notes: '',
      parentId: null,
    },
    {
      id: 'ms-2',
      type: 'milestone' as const,
      title: 'Validierung abgeschlossen',
      start: addDays(t0, 42),
      end: addDays(t0, 42),
      assigneeIds: [],
      workPackageId: 'wp-ap3',
      color: '#0e7490',
      progress: 0,
      notes: '',
      parentId: null,
    },
    {
      id: 'tk-9',
      type: 'task' as const,
      title: 'MVP-Feinschliff & Pitch Deck',
      start: addDays(t0, 43),
      end: addDays(t0, 55),
      assigneeIds: ['p-siavash'],
      workPackageId: 'wp-ap4',
      color: '#db2777',
      progress: 0,
      notes: '',
      parentId: null,
    },
    {
      id: 'ms-3',
      type: 'milestone' as const,
      title: 'MVP-Launch',
      start: addDays(t0, 55),
      end: addDays(t0, 55),
      assigneeIds: ['p-siavash', 'p-bastian', 'p-lutz'],
      workPackageId: 'wp-ap4',
      color: '#9d174d',
      progress: 0,
      notes: '',
      parentId: null,
    },
  ];
  const tasks = tasksWithoutStatus.map((task) => ({
    ...task,
    status: deriveTaskStatus(task.progress),
  }));

  const dependencies = [
    { id: 'dep-1', fromId: 'tk-1', toId: 'tk-2', type: 'FS' as const, lagDays: 0 },
    { id: 'dep-2', fromId: 'tk-3', toId: 'tk-4', type: 'FS' as const, lagDays: 0 },
    { id: 'dep-3', fromId: 'tk-2', toId: 'ms-1', type: 'FS' as const, lagDays: 0 },
    { id: 'dep-4', fromId: 'tk-4', toId: 'ms-1', type: 'FS' as const, lagDays: 0 },
    { id: 'dep-5', fromId: 'tk-5', toId: 'tk-6', type: 'FS' as const, lagDays: 0 },
    { id: 'dep-6', fromId: 'ms-1', toId: 'tk-7', type: 'FS' as const, lagDays: 0 },
    { id: 'dep-7', fromId: 'tk-7', toId: 'tk-8', type: 'FS' as const, lagDays: 0 },
    { id: 'dep-8', fromId: 'tk-6', toId: 'tk-8', type: 'FS' as const, lagDays: 0 },
    { id: 'dep-9', fromId: 'tk-8', toId: 'ms-2', type: 'FS' as const, lagDays: 0 },
    { id: 'dep-10', fromId: 'ms-2', toId: 'tk-9', type: 'FS' as const, lagDays: 0 },
    { id: 'dep-11', fromId: 'tk-9', toId: 'ms-3', type: 'FS' as const, lagDays: 0 },
  ];

  const ideas = [
    {
      id: 'idea-1',
      title: 'Automatische Lauftechnik-Tipps',
      text: 'Basierend auf den Sensordaten der App Verbesserungsvorschläge zur Lauftechnik in Echtzeit oder als Wochenrückblick anzeigen.',
      createdAt: t0,
    },
    {
      id: 'idea-2',
      title: 'Kooperation mit Physiotherapeuten',
      text: 'Prüfen, ob Praxen die Sohle für Nachsorge/Reha empfehlen oder selbst einsetzen würden.',
      createdAt: t0,
    },
  ];

  const activity = [
    {
      id: 'act-1',
      timestamp: new Date().toISOString(),
      message: 'Projektplan mit Beispieldaten angelegt.',
    },
  ];

  return { people, workPackages, tasks, dependencies, ideas, activity };
}
