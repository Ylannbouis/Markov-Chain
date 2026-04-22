import { useRef, useState, useCallback, useEffect } from 'react';
import { useGraph } from '@/store/graphContext';
import { useUI } from '@/store/uiContext';
import { useSimulation } from '@/store/simulationContext';
import { screenToSVG, interpolateEdge, interpolateSelfLoop } from '@/utils/svgGeometry';
import { newId } from '@/utils/idGen';
import { EdgeLayer } from './EdgeLayer';
import { NodeLayer } from './NodeLayer';
import { ParticleLayer } from './ParticleLayer';

export function GraphCanvas() {
  const { graph, dispatch } = useGraph();
  const {
    darkMode, activeTool, simulationMode,
    selectedNodeId, setSelectedNodeId,
    selectedEdgeId, setSelectedEdgeId,
  } = useUI();
  const { particlesRef, particleLayerRef, running, reset, resetCount } = useSimulation();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [ghostEdge, setGhostEdge] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const edgeSourceRef = useRef<string | null>(null);
  const isEnsemble = simulationMode === 'ensemble';

  // Keep a stable ref to graph so drag handler can read current edges without stale closure
  const graphRef = useRef(graph);
  useEffect(() => { graphRef.current = graph; }, [graph]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          dispatch({ type: 'DELETE_NODE', payload: { id: selectedNodeId } });
          setSelectedNodeId(null);
          reset(simulationMode);
        } else if (selectedEdgeId) {
          dispatch({ type: 'DELETE_EDGE', payload: { id: selectedEdgeId } });
          setSelectedEdgeId(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, selectedEdgeId, dispatch, setSelectedNodeId, setSelectedEdgeId, reset, simulationMode]);

  const toSVG = useCallback((e: { clientX: number; clientY: number }) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    return screenToSVG(svgRef.current, e.clientX, e.clientY);
  }, []);

  const handleSVGPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const t = e.target as SVGElement;
    if (t !== svgRef.current && t.id !== 'grid-bg') return;
    if (activeTool === 'addNode') {
      const pos = toSVG(e);
      dispatch({ type: 'ADD_NODE', payload: { id: newId('n'), label: 'State', x: pos.x, y: pos.y } });
    } else {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    }
  }, [activeTool, toSVG, dispatch, setSelectedNodeId, setSelectedEdgeId]);

  const handleNodePointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    if (activeTool === 'delete') {
      dispatch({ type: 'DELETE_NODE', payload: { id: nodeId } });
      setSelectedNodeId(null);
      reset(simulationMode);
      return;
    }
    if (activeTool === 'select') {
      const node = graph.nodes.find(n => n.id === nodeId)!;
      const pos = toSVG(e);
      draggingNodeRef.current = {
        id: nodeId,
        offsetX: pos.x - node.x,
        offsetY: pos.y - node.y,
      };
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } else if (activeTool === 'addEdge') {
      const node = graph.nodes.find(n => n.id === nodeId)!;
      edgeSourceRef.current = nodeId;
      setGhostEdge({ x1: node.x, y1: node.y, x2: node.x, y2: node.y });
    }
  }, [activeTool, graph.nodes, toSVG, dispatch, setSelectedNodeId, setSelectedEdgeId, reset, simulationMode]);

  const syncParticlesToDrag = useCallback((draggedNodeId: string, newX: number, newY: number) => {
    const g = graphRef.current;
    // Build curved edge set
    const curvedEdgeIds = new Set(
      g.edges.filter(e =>
        g.edges.some(r => r.sourceId === e.targetId && r.targetId === e.sourceId && r.id !== e.id)
      ).map(e => e.id)
    );
    // Build updated node positions (drag hasn't committed to React state yet)
    const nodePos = new Map(g.nodes.map(n => [n.id, { x: n.x, y: n.y, radius: n.radius }]));
    nodePos.set(draggedNodeId, { x: newX, y: newY, radius: nodePos.get(draggedNodeId)?.radius ?? 44 });

    const layer = particleLayerRef.current;
    particlesRef.current.forEach((p, i) => {
      let px = p.x, py = p.y;

      if (!p.transitioning && p.currentNodeId === draggedNodeId) {
        px = newX;
        py = newY;
      } else if (p.transitioning && p.edgeId) {
        const edge = g.edges.find(e => e.id === p.edgeId);
        if (edge && (edge.sourceId === draggedNodeId || edge.targetId === draggedNodeId)) {
          const src = nodePos.get(edge.sourceId);
          const tgt = nodePos.get(edge.targetId);
          if (src && tgt) {
            const pos = edge.sourceId === edge.targetId
              ? interpolateSelfLoop(src, edge.loopAngle, p.t)
              : interpolateEdge(src, tgt, p.t, curvedEdgeIds.has(edge.id));
            px = pos.x;
            py = pos.y;
          }
        }
      }

      if (px !== p.x || py !== p.y) {
        p.x = px;
        p.y = py;
        if (layer) {
          const el = layer.children[i] as SVGCircleElement | undefined;
          el?.setAttribute('cx', String(px));
          el?.setAttribute('cy', String(py));
        }
      }
    });
  }, [particlesRef, particleLayerRef]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const pos = toSVG(e);
    if (draggingNodeRef.current) {
      const newX = pos.x - draggingNodeRef.current.offsetX;
      const newY = pos.y - draggingNodeRef.current.offsetY;
      dispatch({
        type: 'UPDATE_NODE_POSITION',
        payload: { id: draggingNodeRef.current.id, x: newX, y: newY },
      });
      // Always sync particles (when running the rAF will overwrite on next frame anyway)
      if (!running) {
        syncParticlesToDrag(draggingNodeRef.current.id, newX, newY);
      }
    }
    if (ghostEdge) {
      setGhostEdge(g => g ? { ...g, x2: pos.x, y2: pos.y } : null);
    }
  }, [toSVG, dispatch, ghostEdge, running, syncParticlesToDrag]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    draggingNodeRef.current = null;
    if (ghostEdge && edgeSourceRef.current) {
      const pos = toSVG(e);
      const target = graph.nodes.find(n => {
        const dx = n.x - pos.x;
        const dy = n.y - pos.y;
        return Math.sqrt(dx * dx + dy * dy) <= n.radius;
      });
      if (target) {
        const sourceId = edgeSourceRef.current;
        const exists = graph.edges.some(
          edge => edge.sourceId === sourceId && edge.targetId === target.id
        );
        if (!exists) {
          dispatch({
            type: 'ADD_EDGE',
            payload: {
              id: newId('e'),
              sourceId,
              targetId: target.id,
              probability: 0,
              loopAngle: target.id === sourceId ? -Math.PI / 2 : 0,
            },
          });
        }
      }
      setGhostEdge(null);
      edgeSourceRef.current = null;
    }
  }, [ghostEdge, graph, toSVG, dispatch]);

  const bg = darkMode ? '#0f172a' : '#f8fafc';
  const gridColor = darkMode ? '#1e293b' : '#e2e8f0';

  return (
    <svg
      ref={svgRef}
      className="flex-1 w-full h-full"
      style={{ background: bg, cursor: activeTool === 'addNode' ? 'crosshair' : 'default' }}
      onPointerDown={handleSVGPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={gridColor} strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect id="grid-bg" width="100%" height="100%" fill="url(#grid)" />

      <EdgeLayer
        edges={graph.edges}
        nodes={graph.nodes}
        selectedEdgeId={selectedEdgeId}
        darkMode={darkMode}
        onSelectEdge={id => {
            if (activeTool === 'delete') {
              dispatch({ type: 'DELETE_EDGE', payload: { id } });
              setSelectedEdgeId(null);
            } else {
              setSelectedEdgeId(id);
              setSelectedNodeId(null);
            }
          }}
        onProbChange={(id, v) => dispatch({ type: 'UPDATE_EDGE_PROBABILITY', payload: { id, probability: v } })}
      />

      <NodeLayer
        nodes={graph.nodes}
        selectedNodeId={selectedNodeId}
        darkMode={darkMode}
        isEnsemble={isEnsemble}
        onPointerDownNode={handleNodePointerDown}
        onSelectNode={id => { setSelectedNodeId(id); setSelectedEdgeId(null); }}
        onLabelChange={(id, label) => dispatch({ type: 'UPDATE_NODE_LABEL', payload: { id, label } })}
      />

      <ParticleLayer
        key={resetCount}
        count={particlesRef.current.length}
        darkMode={darkMode}
        isEnsemble={isEnsemble}
      />

      {ghostEdge && (
        <line
          x1={ghostEdge.x1} y1={ghostEdge.y1}
          x2={ghostEdge.x2} y2={ghostEdge.y2}
          stroke={darkMode ? '#94a3b8' : '#64748b'}
          strokeWidth={1.5}
          strokeDasharray="6 3"
        />
      )}
    </svg>
  );
}
