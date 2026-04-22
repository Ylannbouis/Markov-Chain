import { useUI } from '@/store/uiContext';
import { useGraph } from '@/store/graphContext';
import { useSimulation } from '@/store/simulationContext';
import { serializeGraph, downloadJSON } from '@/utils/jsonIO';
import type { ActiveTool, SimulationMode } from '@/types';

export function Toolbar() {
  const {
    darkMode, toggleDarkMode,
    activeTool, setActiveTool,
    simulationMode, setSimulationMode,
    setShowImportExport,
  } = useUI();
  const { graph } = useGraph();
  const { reset } = useSimulation();

  const handleModeChange = (mode: SimulationMode) => {
    setSimulationMode(mode);
    reset(mode);
  };

  const handleExport = () => {
    downloadJSON('markov-chain.json', serializeGraph(graph));
  };

  const base = `px-3 py-1.5 rounded text-sm font-medium transition-colors`;
  const tool = (t: ActiveTool) =>
    activeTool === t
      ? `${base} ${darkMode ? 'bg-indigo-600 text-white' : 'bg-violet-600 text-white'}`
      : `${base} ${darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;

  const modeBtn = (m: SimulationMode) =>
    simulationMode === m
      ? `${base} ${darkMode ? 'bg-emerald-700 text-white' : 'bg-emerald-600 text-white'}`
      : `${base} ${darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;

  return (
    <div className={`flex items-center gap-2 flex-wrap px-4 py-2 border-b ${darkMode ? 'border-gray-700 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-900'}`}>
      {/* Title */}
      <span className={`font-semibold text-sm mr-2 ${darkMode ? 'text-purple-300' : 'text-violet-700'}`}>
        Markov Chain
      </span>

      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

      {/* Edit tools */}
      <button className={tool('select')} onClick={() => setActiveTool('select')} title="Select / Drag (S)">
        ↖ Select
      </button>
      <button className={tool('addNode')} onClick={() => setActiveTool('addNode')} title="Add Node (N)">
        + Node
      </button>
      <button className={tool('addEdge')} onClick={() => setActiveTool('addEdge')} title="Add Edge (E)">
        → Edge
      </button>
      <button className={tool('delete')} onClick={() => setActiveTool('delete')} title="Delete (D)">
        ✕ Delete
      </button>

      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

      {/* Simulation mode */}
      <button className={modeBtn('state')} onClick={() => handleModeChange('state')}>
        ● Single Particle
      </button>
      <button className={modeBtn('ensemble')} onClick={() => handleModeChange('ensemble')}>
        ⠿ Ensemble
      </button>

      <div className="flex-1" />

      {/* Import / Export */}
      <button
        className={`${base} ${darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        onClick={handleExport}
      >
        ↓ Export
      </button>
      <button
        className={`${base} ${darkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        onClick={() => setShowImportExport(true)}
      >
        ↑ Import
      </button>

      {/* Dark mode */}
      <button
        className={`${base} ${darkMode ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-400' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
        onClick={toggleDarkMode}
        title="Toggle dark mode"
      >
        {darkMode ? '☀' : '☾'}
      </button>
    </div>
  );
}
