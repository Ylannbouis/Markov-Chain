import { useRef, useState, useCallback, useEffect } from 'react';
import { useGraph } from '@/store/graphContext';
import { useUI } from '@/store/uiContext';
import { useSimulation } from '@/store/simulationContext';
import { screenToSVG } from '@/utils/svgGeometry';
import { newId } from '@/utils/idGen';
import { EdgeLayer } from './EdgeLayer';
import { NodeLayer } from './NodeLayer';
import { ParticleLayer } from './ParticleLayer';
import type { MarkovNode } from '@/types';

export function GraphCanvas() {
  const { graph, dispatch } = useGraph();
  const {
    darkMode, activeTool, simulationMode,
    selectedNodeId, setSelectedNodeId,
    selectedEdgeId, setSelectedEdgeId,
  } = useUI();
  const { particlesRef, particleLayerRef, running, reset } = useSimulation();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [ghostEdge, setGhostEdge] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const edgeSourceRef = useRef<string | null>(null);
  const isEnsemble = simulationMode === 'ensemble';

  // Delete selected on keyboard
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
    if ((e.target as Element).closest('circle, text, foreignObject, polygon')) return;
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
    if (activeTool === 'select' || activeTool === 'delete') {
      if (activeTool === 'delete') {
        dispatch({ type: 'DELETE_NODE', payload: { id: nodeId } });
        setSelectedNodeId(null);
        reset(simulationMode);
        return;
      }
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

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const pos = toSVG(e);
    if (draggingNodeRef.current) {
      const newX = pos.x - draggingNodeRef.current.offsetX;
      const newY = pos.y - draggingNodeRef.current.offsetY;
      dispatch({
        type: 'UPDATE_NODE_POSITION',
        payload: { id: draggingNodeRef.current.id, x: newX, y: newY },
      });
      // When paused, sync idle particles on this node directly to the DOM
      if (!running) {
        const layer = particleLayerRef.current;
        particlesRef.current.forEach((p, i) => {
          if (!p.transitioning && p.currentNodeId === draggingNodeRef.current!.id) {
            p.x = newX;
            p.y = newY;
            if (layer) {
              const el = layer.children[i] as SVGCircleElement | undefined;
              el?.setAttribute('cx', String(newX));
              el?.setAttribute('cy', String(newY));
            }
          }
        });
      }
    }
    if (ghostEdge) {
      setGhostEdge(g => g ? { ...g, x2: pos.x, y2: pos.y } : null);
    }
  }, [toSVG, dispatch, ghostEdge, running, particlesRef, particleLayerRef]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    draggingNodeRef.current = null;
    if (ghostEdge && edgeSourceRef.current) {
      // Check if pointer released over a node
      const pos = toSVG(e);
      const target = graph.nodes.find(n => {
        const dx = n.x - pos.x;
        const dy = n.y - pos.y;
        return Math.sqrt(dx * dx + dy * dy) <= n.radius;
      });
      if (target) {
        const sourceId = edgeSourceRef.current;
        // Avoid duplicate edges
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
      <rect width="100%" height="100%" fill="url(#grid)" />

      <EdgeLayer
        edges={graph.edges}
        nodes={graph.nodes}
        selectedEdgeId={selectedEdgeId}
        darkMode={darkMode}
        onSelectEdge={id => { setSelectedEdgeId(id); setSelectedNodeId(null); }}
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
