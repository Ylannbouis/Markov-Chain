export interface MarkovNode {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
}

export interface MarkovEdge {
  id: string;
  sourceId: string;
  targetId: string;
  probability: number;
  loopAngle: number;
}

export interface Particle {
  id: string;
  currentNodeId: string;
  transitioning: boolean;
  edgeId: string | null;
  t: number;
  x: number;
  y: number;
}

export interface GraphState {
  nodes: MarkovNode[];
  edges: MarkovEdge[];
}

export type SimulationMode = 'state' | 'ensemble';

export type ActiveTool = 'select' | 'addNode' | 'addEdge' | 'delete';
