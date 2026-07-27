import { Toolbar } from './components/Toolbar';
import { GanttChart } from './components/GanttChart';
import { TaskEditModal } from './components/TaskEditModal';

function App() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <Toolbar />
      <GanttChart />
      <TaskEditModal />
    </div>
  );
}

export default App;
