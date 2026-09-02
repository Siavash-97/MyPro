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
import { useChecklistProgressSync } from './hooks/useChecklistProgressSync';

const OVERDUE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

function App() {
  const activeView = useViewStore((s) => s.activeView);

  // Re-enabled 2026-09-02 after the 2026-09-02 incident (see report): the
  // sync itself was never the problem -- always mirroring a task's own
  // checklist ratio, both up and down, retroactively for every task, is
  // now the explicitly confirmed design (grilled with the user), not an
  // accident. What changed is that it ships with an actual performance
  // check this time (see the agent report for the stress-test numbers).
  useChecklistProgressSync();

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
