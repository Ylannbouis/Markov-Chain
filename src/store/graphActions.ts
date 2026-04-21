import type { GraphState, MarkovNode, MarkovEdge } from '@/types';

export type GraphAction =
  | { type: 'LOAD_GRAPH'; payload: GraphState }
  | { type: 'ADD_NODE'; payload: Omit<MarkovNode, 'radius'> & { radius?: number } }
  | { type: 'UPDATE_NODE_POSITION'; payload: { id: string; x: number; y: number } }
  | { type: 'UPDATE_NODE_LABEL'; payload: { id: string; label: string } }
  | { type: 'DELETE_NODE'; payload: { id: string } }
  | { type: 'ADD_EDGE'; payload: MarkovEdge }
  | { type: 'UPDATE_EDGE_PROBABILITY'; payload: { id: string; probability: number } }
  | { type: 'DELETE_EDGE'; payload: { id: string } };
