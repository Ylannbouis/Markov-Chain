import { useSimulation } from '@/store/simulationContext';
import { useUI } from '@/store/uiContext';
import { useGraph } from '@/store/graphContext';

export function SimulationControls() {
  const { running, hasStarted, speed, setSpeed, ensembleCount, setEnsembleCount, play, pause, step, reset, startNodeId, setStartNodeId } = useSimulation();
  const { darkMode, simulationMode } = useUI();
  const { graph } = useGraph();

  const isEnsemble = simulationMode === 'ensemble';
  const sliderVal = Math.log2(speed);

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpeed(Math.pow(2, parseFloat(e.target.value)));
  };

  const handleStartNodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStartNodeId(e.target.value);
    reset(simulationMode);
  };

  const base = `px-3 py-1.5 rounded text-sm font-medium transition-colors`;
  const primaryBtn = darkMode
    ? `${base} bg-indigo-600 text-white hover:bg-indigo-500`
    : `${base} bg-violet-600 text-white hover:bg-violet-500`;
  const neutralBtn = darkMode
    ? `${base} bg-gray-700 text-gray-200 hover:bg-gray-600`
    : `${base} bg-gray-200 text-gray-700 hover:bg-gray-300`;

  const effectiveStartId = startNodeId ?? graph.nodes[0]?.id;

  return (
    <div className={`flex items-center gap-2 flex-wrap px-4 py-2 border-t
      ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}
    >
      {/* Play / Pause */}
      <button className={running ? neutralBtn : primaryBtn} onClick={running ? pause : play}>
        {running ? '⏸ Pause' : '▶ Play'}
      </button>

      {/* Step (disabled while running) */}
      <button
        className={neutralBtn}
        onClick={step}
        disabled={running}
        title="Complete current transition, then advance one step"
        style={{ opacity: running ? 0.45 : 1 }}
      >
        ⏭ Step
      </button>

      {/* Reset */}
      <button className={neutralBtn} onClick={() => reset(simulationMode)}>
        ↺ Reset
      </button>

      {/* Speed */}
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

      {/* Ensemble particle count */}
      {isEnsemble && (
        <div className="flex items-center gap-2 ml-2">
          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Particles</span>
          <input
            type="range" min={1} max={1000} step={1}
            value={ensembleCount}
            disabled={hasStarted}
            onChange={e => setEnsembleCount(parseInt(e.target.value, 10))}
            className="w-24 accent-violet-500"
            style={{ opacity: hasStarted ? 0.45 : 1 }}
          />
          <span className={`text-xs w-8 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {ensembleCount}
          </span>
        </div>
      )}

      {/* Ensemble starting state */}
      {isEnsemble && graph.nodes.length > 0 && (
        <div className="flex items-center gap-2 ml-2">
          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Start at</span>
          <select
            value={effectiveStartId ?? ''}
            onChange={handleStartNodeChange}
            className={`text-xs rounded px-2 py-1 border
              ${darkMode ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-700 border-gray-300'}`}
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
