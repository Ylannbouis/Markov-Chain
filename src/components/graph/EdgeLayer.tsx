import type { MarkovEdge, MarkovNode } from '@/types';
import { EdgeShape } from './EdgeShape';

interface Props {
  edges: MarkovEdge[];
  nodes: MarkovNode[];
  selectedEdgeId: string | null;
  darkMode: boolean;
  onSelectEdge: (id: string) => void;
  onProbChange: (id: string, v: number) => void;
}

export function EdgeLayer({ edges, nodes, selectedEdgeId, darkMode, onSelectEdge, onProbChange }: Props) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Detect bidirectional pairs so they can be curved
  const edgePairSet = new Set<string>();
  for (const e of edges) {
    const rev = edges.find(r => r.sourceId === e.targetId && r.targetId === e.sourceId && r.id !== e.id);
    if (rev) edgePairSet.add(e.id);
  }

  return (
    <g>
      {edges.map(edge => {
        const source = nodeMap.get(edge.sourceId);
        const target = nodeMap.get(edge.targetId);
        if (!source || !target) return null;
        return (
          <EdgeShape
            key={edge.id}
            edge={edge}
            source={source}
            target={target}
            selected={selectedEdgeId === edge.id}
            curved={edgePairSet.has(edge.id)}
            darkMode={darkMode}
            onSelect={() => onSelectEdge(edge.id)}
            onProbChange={v => onProbChange(edge.id, v)}
          />
        );
      })}
    </g>
  );
}
