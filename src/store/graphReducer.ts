import type { GraphState } from '@/types';
import type { GraphAction } from './graphActions';
import { enforceStochastic, redistributeAfterDelete } from '@/simulation/normalizer';

export function graphReducer(state: GraphState, action: GraphAction): GraphState {
  switch (action.type) {
    case 'LOAD_GRAPH':
      return action.payload;

    case 'ADD_NODE': {
      const node = { radius: 44, ...action.payload };
      return { ...state, nodes: [...state.nodes, node] };
    }

    case 'UPDATE_NODE_POSITION':
      return {
        ...state,
        nodes: state.nodes.map(n =>
          n.id === action.payload.id
            ? { ...n, x: action.payload.x, y: action.payload.y }
            : n
        ),
      };

    case 'UPDATE_NODE_LABEL':
      return {
        ...state,
        nodes: state.nodes.map(n =>
          n.id === action.payload.id ? { ...n, label: action.payload.label } : n
        ),
      };

    case 'DELETE_NODE': {
      const { id } = action.payload;
      const remainingEdges = state.edges.filter(
        e => e.sourceId !== id && e.targetId !== id
      );
      // Redistribute probabilities for nodes that lost outgoing edges
      const affectedSources = new Set(
        state.edges
          .filter(e => e.targetId === id && e.sourceId !== id)
          .map(e => e.sourceId)
      );
      let finalEdges = remainingEdges;
      for (const srcId of affectedSources) {
        finalEdges = redistributeAfterDelete(finalEdges, srcId);
      }
      return {
        nodes: state.nodes.filter(n => n.id !== id),
        edges: finalEdges,
      };
    }

    case 'ADD_EDGE': {
      // Normalize probabilities for this source node after adding a new edge
      const outgoing = state.edges.filter(e => e.sourceId === action.payload.sourceId);
      const totalExisting = outgoing.reduce((s, e) => s + e.probability, 0);
      const newProb = Math.max(0, 1 - totalExisting);
      const newEdge = { ...action.payload, probability: newProb };

      // Now normalize existing edges to make room
      const share = newProb > 0 ? totalExisting / outgoing.length : 0;
      void share; // will be handled by enforceStochastic below

      const withNew = [...state.edges, newEdge];
      // Redistribute so all outgoing from same source sum to 1
      if (outgoing.length > 0) {
        const normalizedEdges = enforceStochastic(withNew, newEdge.id, newProb);
        return { ...state, edges: normalizedEdges };
      }
      return { ...state, edges: withNew };
    }

    case 'UPDATE_EDGE_PROBABILITY': {
      const updated = enforceStochastic(
        state.edges,
        action.payload.id,
        action.payload.probability
      );
      return { ...state, edges: updated };
    }

    case 'DELETE_EDGE': {
      const edge = state.edges.find(e => e.id === action.payload.id);
      const remaining = state.edges.filter(e => e.id !== action.payload.id);
      if (edge) {
        return { ...state, edges: redistributeAfterDelete(remaining, edge.sourceId) };
      }
      return { ...state, edges: remaining };
    }

    default:
      return state;
  }
}
