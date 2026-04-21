import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { GraphState } from '@/types';
import type { GraphAction } from './graphActions';
import { graphReducer } from './graphReducer';
import { weatherExample } from '@/data/weatherExample';

interface GraphContextValue {
  graph: GraphState;
  dispatch: React.Dispatch<GraphAction>;
}

const GraphContext = createContext<GraphContextValue | null>(null);

export function GraphProvider({ children }: { children: ReactNode }) {
  const [graph, dispatch] = useReducer(graphReducer, weatherExample);
  return (
    <GraphContext.Provider value={{ graph, dispatch }}>
      {children}
    </GraphContext.Provider>
  );
}

export function useGraph() {
  const ctx = useContext(GraphContext);
  if (!ctx) throw new Error('useGraph must be used within GraphProvider');
  return ctx;
}
