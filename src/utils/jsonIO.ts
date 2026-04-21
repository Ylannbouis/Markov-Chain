import type { GraphState } from '@/types';

export function serializeGraph(state: GraphState): string {
  const exportable = {
    nodes: state.nodes.map(({ id, label, x, y, radius }) => ({ id, label, x, y, radius })),
    edges: state.edges.map(({ id, sourceId, targetId, probability, loopAngle }) => ({
      id, sourceId, targetId, probability, loopAngle,
    })),
  };
  return JSON.stringify(exportable, null, 2);
}

export function deserializeGraph(json: string): GraphState {
  const parsed = JSON.parse(json) as GraphState;
  return parsed;
}

export function downloadJSON(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
