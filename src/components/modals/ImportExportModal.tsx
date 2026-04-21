import { useRef } from 'react';
import { useGraph } from '@/store/graphContext';
import { useUI } from '@/store/uiContext';
import { useSimulation } from '@/store/simulationContext';
import { deserializeGraph } from '@/utils/jsonIO';

export function ImportExportModal() {
  const { dispatch } = useGraph();
  const { showImportExport, setShowImportExport, darkMode, simulationMode } = useUI();
  const { reset } = useSimulation();
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!showImportExport) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const graph = deserializeGraph(ev.target?.result as string);
        dispatch({ type: 'LOAD_GRAPH', payload: graph });
        reset(simulationMode);
        setShowImportExport(false);
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className={`rounded-lg shadow-xl p-6 w-80 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
        <h2 className="text-base font-semibold mb-4">Import Chain</h2>
        <p className={`text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Select a previously exported JSON file.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFile}
          className="hidden"
        />
        <button
          className={`w-full py-2 rounded text-sm font-medium mb-3 ${darkMode ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'}`}
          onClick={() => fileRef.current?.click()}
        >
          Choose File
        </button>
        <button
          className={`w-full py-2 rounded text-sm ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
          onClick={() => setShowImportExport(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
