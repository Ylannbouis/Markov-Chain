import type { MarkovEdge, MarkovNode } from '@/types';
import {
  getEdgePath, getEdgeEndpoints, getSelfLoopPath, getEdgeLabelPosition,
  getSelfLoopLabelPosition, getSelfLoopArrowAngle,
} from '@/utils/svgGeometry';
import { ProbabilityLabel } from './ProbabilityLabel';

interface Props {
  edge: MarkovEdge;
  source: MarkovNode;
  target: MarkovNode;
  selected: boolean;
  curved: boolean;
  darkMode: boolean;
  onSelect: () => void;
  onProbChange: (v: number) => void;
}

const ARROW_SIZE = 10;

export function EdgeShape({ edge, source, target, selected, curved, darkMode, onSelect, onProbChange }: Props) {
  const isSelf = edge.sourceId === edge.targetId;
  const stroke = selected ? '#f59e0b' : darkMode ? '#94a3b8' : '#64748b';

  let d: string;
  let labelPos: { x: number; y: number };
  let arrowAngle: number;
  let arrowX: number;
  let arrowY: number;

  if (isSelf) {
    d = getSelfLoopPath(source, edge.loopAngle);
    labelPos = getSelfLoopLabelPosition(source, edge.loopAngle);
    arrowAngle = getSelfLoopArrowAngle(source, edge.loopAngle);
    const r = source.radius;
    arrowX = source.x + r * Math.cos(edge.loopAngle + 0.5);
    arrowY = source.y + r * Math.sin(edge.loopAngle + 0.5);
  } else {
    d = getEdgePath(source, target, curved);
    labelPos = getEdgeLabelPosition(source, target, curved);
    // Arrow tip at the exact circumference point getEdgePath ends at
    const ep = getEdgeEndpoints(source, target);
    arrowX = ep.x2;
    arrowY = ep.y2;
    if (curved) {
      // Bezier tangent at t=1 = direction from control point to endpoint.
      // Control point uses the same circumference-based midpoint formula as getEdgePath.
      const edx = ep.x2 - ep.x1;
      const edy = ep.y2 - ep.y1;
      const edist = Math.sqrt(edx * edx + edy * edy) || 1;
      const cx = (ep.x1 + ep.x2) / 2 - (edy / edist) * 36;
      const cy = (ep.y1 + ep.y2) / 2 + (edx / edist) * 36;
      arrowAngle = Math.atan2(ep.y2 - cy, ep.x2 - cx);
    } else {
      arrowAngle = Math.atan2(target.y - source.y, target.x - source.x);
    }
  }

  const arrowTransform = `translate(${arrowX},${arrowY}) rotate(${(arrowAngle * 180) / Math.PI})`;

  return (
    <g onClick={onSelect} className="cursor-pointer">
      <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={selected ? 2.5 : 1.5} />
      <g transform={arrowTransform}>
        <polygon
          points={`0,0 ${-ARROW_SIZE},${ARROW_SIZE / 2} ${-ARROW_SIZE},${-ARROW_SIZE / 2}`}
          fill={stroke}
        />
      </g>
      <ProbabilityLabel
        value={edge.probability}
        x={labelPos.x}
        y={labelPos.y}
        darkMode={darkMode}
        onCommit={onProbChange}
      />
    </g>
  );
}
