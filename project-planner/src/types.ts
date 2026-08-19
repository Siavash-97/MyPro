export type ItemType = 'task' | 'milestone';

export type TaskStatus = 'not_started' | 'in_progress' | 'waiting' | 'completed';

export type ColorMode = 'custom' | 'person' | 'workpackage';

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface Person {
  id: string;
  name: string;
  color: string;
  /** For task-assignment/reminder e-mails. Column names match the DB
   * directly (planner_people is upserted as-is, no camelCase mapping). */
  email?: string | null;
  notify_on_assignment?: boolean;
  /** e.g. [7, 1] = remind 7 days and 1 day before a task's end date. */
  reminder_days_before?: number[];
}

export interface WorkPackage {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  type: ItemType;
  title: string;
  /** ISO date yyyy-MM-dd */
  start: string;
  /** ISO date yyyy-MM-dd. For milestones equal to start. */
  end: string;
  assigneeIds: string[];
  workPackageId: string | null;
  color: string;
  progress: number;
  /** Workflow state used by the To-Do Kanban board. */
  status: TaskStatus;
  notes: string;
  /** Whether this task/milestone is drawn as a bar in the Gantt chart.
   * Undefined/missing is treated as true (existing tasks keep showing).
   * false keeps the task in the To-Do list only, so the Gantt can stay an
   * overview while task detail lives on the To-Do page. */
  showInGantt?: boolean;
  /** A task with children becomes a summary task: its displayed dates and
   * progress are computed from its children instead of being edited
   * directly (see utils/hierarchy.ts). */
  parentId: string | null;
}

/** Finish-to-Start (predecessor must finish before successor starts, the
 * classic case), Start-to-Start (successor can't start before predecessor
 * starts), Finish-to-Finish (successor can't finish before predecessor
 * finishes), or Start-to-Finish (rare: successor can't finish before
 * predecessor starts). */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export const DEP_TYPE_LABELS: Record<DependencyType, string> = {
  FS: 'Ende → Start',
  SS: 'Start → Start',
  FF: 'Ende → Ende',
  SF: 'Start → Ende',
};

export interface Dependency {
  id: string;
  fromId: string;
  toId: string;
  type: DependencyType;
  /** Lag in days; negative means lead time (overlap) instead of a gap. */
  lagDays: number;
}

export interface Idea {
  id: string;
  title: string;
  text: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  /** ISO datetime */
  timestamp: string;
  message: string;
  /** Display name of the person who made the change, if known. */
  actor?: string;
}

export interface ProjectData {
  people: Person[];
  workPackages: WorkPackage[];
  tasks: Task[];
  dependencies: Dependency[];
  ideas: Idea[];
  activity: ActivityEntry[];
}
