import { GraphProvider } from '@/store/graphContext';
import { UIProvider, useUI } from '@/store/uiContext';
import { SimulationProvider } from '@/store/simulationContext';
import { Toolbar } from '@/components/layout/Toolbar';
import { SimulationControls } from '@/components/layout/SimulationControls';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { ImportExportModal } from '@/components/modals/ImportExportModal';

function AppInner() {
  const { simulationMode } = useUI();
  return (
    <SimulationProvider mode={simulationMode}>
      <div className="flex flex-col h-screen">
        <Toolbar />
        <div className="flex-1 min-h-0 overflow-hidden">
          <GraphCanvas />
        </div>
        <SimulationControls />
      </div>
      <ImportExportModal />
    </SimulationProvider>
  );
}

export default function App() {
  return (
    <GraphProvider>
      <UIProvider>
        <AppInner />
      </UIProvider>
    </GraphProvider>
  );
}
