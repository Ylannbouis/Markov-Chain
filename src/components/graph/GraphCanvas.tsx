import { useRef, useState, useCallback, useEffect } from 'react';
import { useGraph } from '@/store/graphContext';
import { useUI } from '@/store/uiContext';
import { useSimulation } from '@/store/simulationContext';
import { screenToSVG, interpolateEdge, interpolateSelfLoop } from '@/utils/svgGeometry';
import { newId } from '@/utils/idGen';
import { EdgeLayer } from './EdgeLayer';
import { NodeLayer } from './NodeLayer';
import { ParticleLayer } from './ParticleLayer';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export function GraphCanvas() {
  const { graph, dispatch } = useGraph();
  const {
    darkMode, activeTool, simulationMode,
    selectedNodeId, setSelectedNodeId,
    selectedEdgeId, setSelectedEdgeId,
  } = useUI();
  const { particlesRef, particleLayerRef, running, reset, resetCount } = useSimulation();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewGroupRef = useRef<SVGGElement | null>(null);
  // Pan/zoom state lives in a ref — updated via direct DOM like particles
  const panZoomRef = useRef({ x: 0, y: 0, scale: 1 });
  const draggingNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [ghostEdge, setGhostEdge] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const edgeSourceRef = useRef<string | null>(null);
  const isEnsemble = simulationMode === 'ensemble';

  // Pan gesture tracking
  const panStartRef = useRef<{ screenX: number; screenY: number; panX: number; panY: number } | null>(null);
  const isPanningRef = useRef(false);

  const graphRef = useRef(graph);
  useEffect(() => { graphRef.current = graph; }, [graph]);

  // Keep activeTool in a ref so non-React callbacks can read the current value
  const activeToolRef = useRef(activeTool);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  const applyTransform = useCallback(() => {
    const { x, y, scale } = panZoomRef.current;
    viewGroupRef.current?.setAttribute('transform', `translate(${x} ${y}) scale(${scale})`);
  }, []);

  // Non-passive wheel listener so preventDefault works (React's onWheel is passive by default)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const svgPt = screenToSVG(svg, e.clientX, e.clientY);
      const { x: px, y: py, scale } = panZoomRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale * factor));
      // Keep the world point under the cursor fixed
      const wx = (svgPt.x - px) / scale;
      const wy = (svgPt.y - py) / scale;
      panZoomRef.current = {
        x: svgPt.x - wx * newScale,
        y: svgPt.y - wy * newScale,
        scale: newScale,
      };
      applyTransform();
    };
    svg.addEventListener('wheel', handler, { passive: false });
    return () => svg.removeEventListener('wheel', handler);
  }, [applyTransform]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeTool === 'delete') {
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
  }, [selectedNodeId, selectedEdgeId, activeTool, dispatch, setSelectedNodeId, setSelectedEdgeId, reset, simulationMode]);

  // Convert screen coordinates to world (graph) coordinates, accounting for pan/zoom
  const toSVG = useCallback((e: { clientX: number; clientY: number }) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svgPt = screenToSVG(svgRef.current, e.clientX, e.clientY);
    const { x: px, y: py, scale } = panZoomRef.current;
    return {
      x: (svgPt.x - px) / scale,
      y: (svgPt.y - py) / scale,
    };
  }, []);

  const handleSVGPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const t = e.target as SVGElement;
    if (t !== svgRef.current && t.id !== 'grid-bg') return;
    // Begin tracking a potential pan (or a background click)
    panStartRef.current = {
      screenX: e.clientX,
      screenY: e.clientY,
      panX: panZoomRef.current.x,
      panY: panZoomRef.current.y,
    };
    isPanningRef.current = false;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }, []);

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
    const curvedEdgeIds = new Set(
      g.edges.filter(e =>
        g.edges.some(r => r.sourceId === e.targetId && r.targetId === e.sourceId && r.id !== e.id)
      ).map(e => e.id)
    );
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
    // Pan handling — only active when pointer went down on background
    if (panStartRef.current) {
      const dx = e.clientX - panStartRef.current.screenX;
      const dy = e.clientY - panStartRef.current.screenY;
      if (!isPanningRef.current && Math.sqrt(dx * dx + dy * dy) > 3) {
        isPanningRef.current = true;
        if (svgRef.current) svgRef.current.style.cursor = 'grabbing';
      }
      if (isPanningRef.current) {
        panZoomRef.current.x = panStartRef.current.panX + dx;
        panZoomRef.current.y = panStartRef.current.panY + dy;
        applyTransform();
        return;
      }
    }

    const pos = toSVG(e);
    if (draggingNodeRef.current) {
      const newX = pos.x - draggingNodeRef.current.offsetX;
      const newY = pos.y - draggingNodeRef.current.offsetY;
      dispatch({
        type: 'UPDATE_NODE_POSITION',
        payload: { id: draggingNodeRef.current.id, x: newX, y: newY },
      });
      if (!running) {
        syncParticlesToDrag(draggingNodeRef.current.id, newX, newY);
      }
    }
    if (ghostEdge) {
      setGhostEdge(g => g ? { ...g, x2: pos.x, y2: pos.y } : null);
    }
  }, [toSVG, dispatch, ghostEdge, running, syncParticlesToDrag, applyTransform]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const wasPanning = isPanningRef.current;
    const hadPanStart = panStartRef.current !== null;

    isPanningRef.current = false;
    panStartRef.current = null;
    draggingNodeRef.current = null;

    if (svgRef.current) {
      svgRef.current.style.cursor = activeToolRef.current === 'addNode' ? 'crosshair' : 'default';
    }

    // Background press — handle click or ignore pan
    if (hadPanStart) {
      if (!wasPanning) {
        // It was a click, not a drag — perform the tool action
        if (activeTool === 'addNode') {
          const pos = toSVG(e);
          dispatch({ type: 'ADD_NODE', payload: { id: newId('n'), label: 'State', x: pos.x, y: pos.y } });
        } else {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        }
      }
      return;
    }

    // Ghost edge completion (pointer went down on a node)
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
  }, [ghostEdge, graph, toSVG, dispatch, activeTool, setSelectedNodeId, setSelectedEdgeId]);

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

      <g ref={viewGroupRef}>
        {/* Large rect so the grid covers any pan distance */}
        <rect id="grid-bg" x="-50000" y="-50000" width="100000" height="100000" fill="url(#grid)" />

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
      </g>
    </svg>
  );
}
