import { useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { GanttChart } from './components/GanttChart';
import { Dashboard } from './components/Dashboard';
import { TodoView } from './components/TodoView';
import { TaskEditModal } from './components/TaskEditModal';
import { LoginGate } from './components/LoginGate';
import { useProjectStore } from './store/useProjectStore';
import { useViewStore } from './store/useViewStore';
import { initBaselineSync } from './store/useBaselineStore';
// useChecklistProgressSync is DISABLED, not removed -- see
// 2026-09-02 incident report. It overwrote already-set progress on any
// task that happened to already have checklist items (most real tasks, by
// the time it shipped), and the resulting burst of updateTask calls on
// first load could hang the page. Needs a redesign (only ever move
// progress forward, and only for a task the person is actively adding a
// checklist to) before it comes back.
// import { useChecklistProgressSync } from './hooks/useChecklistProgressSync';

const OVERDUE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

function App() {
  const activeView = useViewStore((s) => s.activeView);

  useEffect(() => {
    const check = () => useProjectStore.getState().checkOverdueTasks();
    // Delayed first run: gives cloud sync a moment to pull the latest plan
    // after login, so this doesn't act on stale locally-cached data.
    const initial = setTimeout(check, 3000);
    const id = setInterval(check, OVERDUE_CHECK_INTERVAL_MS);
    setTimeout(initBaselineSync, 3000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  return (
    <LoginGate>
      <div className="h-screen w-screen flex flex-col overflow-hidden">
        <Toolbar />
        {activeView === 'dashboard' ? <Dashboard /> : activeView === 'todos' ? <TodoView /> : <GanttChart />}
        <TaskEditModal />
      </div>
    </LoginGate>
  );
}

export default App;
