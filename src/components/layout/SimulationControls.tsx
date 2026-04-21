import { useSimulation } from '@/store/simulationContext';
import { useUI } from '@/store/uiContext';
import { useGraph } from '@/store/graphContext';

export function SimulationControls() {
  const { running, speed, setSpeed, play, pause, reset, startNodeId, setStartNodeId } = useSimulation();
  const { darkMode, simulationMode } = useUI();
  const { graph } = useGraph();

  const sliderVal = Math.log2(speed);
  const isEnsemble = simulationMode === 'ensemble';

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpeed(Math.pow(2, parseFloat(e.target.value)));
  };

  const handleStartNodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStartNodeId(e.target.value);
    reset(simulationMode);
  };

  const btn = `px-3 py-1.5 rounded text-sm font-medium transition-colors`;
  const activeBtn = darkMode
    ? `${btn} bg-indigo-600 text-white hover:bg-indigo-500`
    : `${btn} bg-violet-600 text-white hover:bg-violet-500`;
  const neutralBtn = darkMode
    ? `${btn} bg-gray-700 text-gray-200 hover:bg-gray-600`
    : `${btn} bg-gray-200 text-gray-700 hover:bg-gray-300`;

  const effectiveStartId = startNodeId ?? graph.nodes[0]?.id;

  return (
    <div className={`flex items-center gap-3 flex-wrap px-4 py-2 border-t ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
      <button className={running ? neutralBtn : activeBtn} onClick={running ? pause : play}>
        {running ? '⏸ Pause' : '▶ Play'}
      </button>

      <button className={neutralBtn} onClick={() => reset(simulationMode)}>
        ↺ Reset
      </button>

      <div className="flex items-center gap-2 ml-2">
        <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Speed</span>
        <input
          type="range" min={-2} max={2} step={0.1}
          value={sliderVal} onChange={handleSpeedChange}
          className="w-24 accent-violet-500"
        />
        <span className={`text-xs w-8 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {speed.toFixed(1)}×
        </span>
      </div>

      {isEnsemble && graph.nodes.length > 0 && (
        <div className="flex items-center gap-2 ml-2">
          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Start at</span>
          <select
            value={effectiveStartId ?? ''}
            onChange={handleStartNodeChange}
            className={`text-xs rounded px-2 py-1 border ${
              darkMode
                ? 'bg-gray-800 text-gray-200 border-gray-600'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            {graph.nodes.map(n => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
