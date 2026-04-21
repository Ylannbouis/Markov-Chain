import type { MarkovNode } from '@/types';
import { NodeShape } from './NodeShape';

interface Props {
  nodes: MarkovNode[];
  selectedNodeId: string | null;
  darkMode: boolean;
  isEnsemble: boolean;
  onPointerDownNode: (e: React.PointerEvent, id: string) => void;
  onSelectNode: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
}

export function NodeLayer({
  nodes, selectedNodeId, darkMode, isEnsemble,
  onPointerDownNode, onSelectNode, onLabelChange,
}: Props) {
  return (
    <g>
      {nodes.map(node => (
        <NodeShape
          key={node.id}
          node={node}
          selected={selectedNodeId === node.id}
          darkMode={darkMode}
          isEnsemble={isEnsemble}
          onPointerDown={e => onPointerDownNode(e, node.id)}
          onSelect={() => onSelectNode(node.id)}
          onLabelChange={label => onLabelChange(node.id, label)}
        />
      ))}
    </g>
  );
}
