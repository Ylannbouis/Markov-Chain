import { useRef, useState, useEffect } from 'react';
import type { MarkovNode } from '@/types';
import { useSimulation, BAR_MAX_HEIGHT } from '@/store/simulationContext';

interface Props {
  node: MarkovNode;
  selected: boolean;
  darkMode: boolean;
  isEnsemble: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onSelect: () => void;
  onLabelChange: (label: string) => void;
}

const BAR_WIDTH = 14;

export function NodeShape({
  node, selected, darkMode, isEnsemble,
  onPointerDown, onSelect, onLabelChange,
}: Props) {
  const { nodeFillRefsMap, nodeCountTextRefsMap, nodeBarRefsMap } = useSimulation();
  const fillRef = useRef<SVGCircleElement | null>(null);
  const countRef = useRef<SVGTextElement | null>(null);
  const barRef = useRef<SVGRectElement | null>(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const [draft, setDraft] = useState(node.label);

  useEffect(() => {
    nodeFillRefsMap.current.set(node.id, fillRef.current);
    nodeCountTextRefsMap.current.set(node.id, countRef.current);
    if (isEnsemble) nodeBarRefsMap.current.set(node.id, barRef.current);
    return () => {
      nodeFillRefsMap.current.delete(node.id);
      nodeCountTextRefsMap.current.delete(node.id);
      nodeBarRefsMap.current.delete(node.id);
    };
  }, [node.id, isEnsemble, nodeFillRefsMap, nodeCountTextRefsMap, nodeBarRefsMap]);

  const r = node.radius;
  const circumference = 2 * Math.PI * r;

  const fill = darkMode ? '#1e1b4b' : '#ede9fe';
  const stroke = selected ? '#f59e0b' : darkMode ? '#818cf8' : '#7c3aed';
  const textFill = darkMode ? '#c4b5fd' : '#4c1d95';
  const barColor = darkMode ? '#818cf8' : '#7c3aed';
  const barTrack = darkMode ? '#1e293b' : '#e2e8f0';

  const commitLabel = () => {
    if (draft.trim()) onLabelChange(draft.trim());
    else setDraft(node.label);
    setEditingLabel(false);
  };

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      className="cursor-pointer"
    >
      {/* Bar chart track (background) */}
      {isEnsemble && (
        <rect
          x={-BAR_WIDTH / 2}
          y={r + 8}
          width={BAR_WIDTH}
          height={BAR_MAX_HEIGHT}
          fill={barTrack}
          rx={3}
          opacity={0.8}
        />
      )}

      {/* Bar chart fill — height updated via direct DOM in tick */}
      {isEnsemble && (
        <rect
          ref={barRef}
          x={-BAR_WIDTH / 2}
          y={r + 8 + BAR_MAX_HEIGHT}
          width={BAR_WIDTH}
          height={0}
          fill={barColor}
          rx={3}
          opacity={0.9}
        />
      )}

      {/* Main circle */}
      <circle r={r} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />

      {/* Subtle fill ring (ensemble proportion indicator) */}
      {isEnsemble && (
        <circle
          ref={fillRef}
          r={r}
          fill="none"
          stroke={barColor}
          strokeWidth={5}
          strokeDasharray={`0 ${circumference}`}
          strokeLinecap="round"
          opacity={0.45}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '0 0' }}
        />
      )}

      {/* Label */}
      {editingLabel ? (
        <foreignObject x={-r + 6} y={-12} width={(r - 6) * 2} height={24}>
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={e => {
              if (e.key === 'Enter') commitLabel();
              if (e.key === 'Escape') { setDraft(node.label); setEditingLabel(false); }
            }}
            className={`w-full h-full text-center text-xs border-none outline-none rounded
              ${darkMode ? 'bg-indigo-950 text-purple-200' : 'bg-violet-100 text-purple-900'}`}
            style={{ font: '13px system-ui' }}
          />
        </foreignObject>
      ) : (
        <text
          textAnchor="middle"
          dominantBaseline={isEnsemble ? 'auto' : 'middle'}
          y={isEnsemble ? -5 : 0}
          fontSize={13}
          fontWeight={500}
          fill={textFill}
          onDoubleClick={() => { setDraft(node.label); setEditingLabel(true); }}
          className="select-none"
        >
          {node.label}
        </text>
      )}

      {/* Count label (ensemble mode) */}
      {isEnsemble && (
        <text
          ref={countRef}
          textAnchor="middle"
          dominantBaseline="hanging"
          y={5}
          fontSize={10}
          fill={darkMode ? '#a5b4fc' : '#6d28d9'}
          className="select-none"
        />
      )}
    </g>
  );
}
