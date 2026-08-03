export type ItemType = 'task' | 'milestone';

export type ColorMode = 'custom' | 'person' | 'workpackage';

export type ZoomLevel = 'day' | 'week' | 'month';

export interface Person {
  id: string;
  name: string;
  color: string;
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
  notes: string;
  /** A task with children becomes a summary task: its displayed dates and
   * progress are computed from its children instead of being edited
   * directly (see utils/hierarchy.ts). */
  parentId: string | null;
}

export interface Dependency {
  id: string;
  fromId: string;
  toId: string;
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
