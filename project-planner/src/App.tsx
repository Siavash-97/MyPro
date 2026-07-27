import { Toolbar } from './components/Toolbar';
import { GanttChart } from './components/GanttChart';
import { TaskEditModal } from './components/TaskEditModal';
import { LoginGate } from './components/LoginGate';

function App() {
  return (
    <LoginGate>
      <div className="h-screen w-screen flex flex-col overflow-hidden">
        <Toolbar />
        <GanttChart />
        <TaskEditModal />
      </div>
    </LoginGate>
  );
}

export default App;
