import {
  createContext, useContext, useRef, useState, useCallback,
  useEffect, type ReactNode,
} from 'react';
import type { Particle, SimulationMode } from '@/types';
import { pickNextEdge, spawnParticles } from '@/simulation/engine';
import { interpolateEdge, interpolateSelfLoop } from '@/utils/svgGeometry';
import { useGraph } from './graphContext';

const TRANSITION_DURATION_MS = 500;
const ENSEMBLE_COUNT = 50;

interface SimulationContextValue {
  running: boolean;
  speed: number;
  setSpeed: (s: number) => void;
  play: () => void;
  pause: () => void;
  reset: (mode: SimulationMode) => void;
  startNodeId: string | null;
  setStartNodeId: (id: string) => void;
  particlesRef: React.MutableRefObject<Particle[]>;
  nodeCountsRef: React.MutableRefObject<Map<string, number>>;
  particleLayerRef: React.MutableRefObject<SVGGElement | null>;
  nodeFillRefsMap: React.MutableRefObject<Map<string, SVGCircleElement | null>>;
  nodeCountTextRefsMap: React.MutableRefObject<Map<string, SVGTextElement | null>>;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({
  children,
  mode,
}: {
  children: ReactNode;
  mode: SimulationMode;
}) {
  const { graph } = useGraph();
  const [running, setRunning] = useState(false);
  const speedRef = useRef(1);
  const [speed, setSpeedState] = useState(1);
  const [startNodeId, setStartNodeIdState] = useState<string | null>(null);
  const startNodeIdRef = useRef<string | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const nodeCountsRef = useRef<Map<string, number>>(new Map());
  const particleLayerRef = useRef<SVGGElement | null>(null);
  const nodeFillRefsMap = useRef<Map<string, SVGCircleElement | null>>(new Map());
  const nodeCountTextRefsMap = useRef<Map<string, SVGTextElement | null>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const graphRef = useRef(graph);
  const modeRef = useRef(mode);

  useEffect(() => { graphRef.current = graph; }, [graph]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
    setSpeedState(s);
  }, []);

  const setStartNodeId = useCallback((id: string) => {
    startNodeIdRef.current = id;
    setStartNodeIdState(id);
  }, []);

  const getStartNode = useCallback(() => {
    const nodes = graphRef.current.nodes;
    if (nodes.length === 0) return null;
    const id = startNodeIdRef.current;
    return nodes.find(n => n.id === id) ?? nodes[0];
  }, []);

  const initParticles = useCallback((m: SimulationMode) => {
    const nodes = graphRef.current.nodes;
    if (nodes.length === 0) { particlesRef.current = []; return; }
    const startNode = getStartNode()!;
    if (m === 'state') {
      particlesRef.current = [{
        id: 'p_0',
        currentNodeId: startNode.id,
        transitioning: false,
        edgeId: null,
        t: 0,
        x: startNode.x,
        y: startNode.y,
      }];
    } else {
      // All 50 particles start on the same node
      particlesRef.current = spawnParticles([startNode.id], ENSEMBLE_COUNT);
      // Set initial positions to the start node
      for (const p of particlesRef.current) {
        p.x = startNode.x;
        p.y = startNode.y;
      }
    }
    nodeCountsRef.current = new Map();
  }, [getStartNode]);

  const reset = useCallback((m: SimulationMode) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimeRef.current = null;
    setRunning(false);
    initParticles(m);
  }, [initParticles]);

  useEffect(() => { initParticles(mode); }, [mode, initParticles]);

  const tick = useCallback((timestamp: number) => {
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
    const delta = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    const g = graphRef.current;
    const edgesBySource = new Map<string, typeof g.edges>();
    for (const e of g.edges) {
      const arr = edgesBySource.get(e.sourceId) ?? [];
      arr.push(e);
      edgesBySource.set(e.sourceId, arr);
    }
    const nodeMap = new Map(g.nodes.map(n => [n.id, n]));
    const curvedEdgeIds = new Set<string>();
    for (const e of g.edges) {
      if (g.edges.some(r => r.sourceId === e.targetId && r.targetId === e.sourceId && r.id !== e.id)) {
        curvedEdgeIds.add(e.id);
      }
    }

    const duration = TRANSITION_DURATION_MS / speedRef.current;
    const counts = new Map<string, number>();

    for (const p of particlesRef.current) {
      if (p.transitioning && p.edgeId) {
        p.t = Math.min(1, p.t + delta / duration);
        const edge = g.edges.find(e => e.id === p.edgeId);
        if (edge) {
          const src = nodeMap.get(edge.sourceId);
          const tgt = nodeMap.get(edge.targetId);
          if (src && tgt) {
            const pos = edge.sourceId === edge.targetId
              ? interpolateSelfLoop(src, edge.loopAngle, p.t)
              : interpolateEdge(src, tgt, p.t, curvedEdgeIds.has(edge.id));
            p.x = pos.x;
            p.y = pos.y;
          }
        }
        if (p.t >= 1) {
          if (edge) p.currentNodeId = edge.targetId;
          p.transitioning = false;
          p.edgeId = null;
          p.t = 0;
        }
      }

      if (!p.transitioning) {
        const node = nodeMap.get(p.currentNodeId);
        if (node) { p.x = node.x; p.y = node.y; }
        counts.set(p.currentNodeId, (counts.get(p.currentNodeId) ?? 0) + 1);

        const outgoing = edgesBySource.get(p.currentNodeId) ?? [];
        const next = pickNextEdge(outgoing);
        if (next) {
          p.transitioning = true;
          p.edgeId = next.id;
          p.t = 0;
        }
      }
    }

    nodeCountsRef.current = counts;
    const total = particlesRef.current.length;

    const layer = particleLayerRef.current;
    if (layer) {
      const circles = layer.children;
      particlesRef.current.forEach((p, i) => {
        const el = circles[i] as SVGCircleElement | undefined;
        if (el) {
          el.setAttribute('cx', String(p.x));
          el.setAttribute('cy', String(p.y));
        }
      });
    }

    if (modeRef.current === 'ensemble') {
      for (const [nodeId, fillEl] of nodeFillRefsMap.current) {
        if (!fillEl) continue;
        const count = counts.get(nodeId) ?? 0;
        const frac = total > 0 ? count / total : 0;
        const node = nodeMap.get(nodeId);
        if (!node) continue;
        const r = node.radius;
        const fullCirc = 2 * Math.PI * r;
        fillEl.setAttribute('stroke-dasharray', `${frac * fullCirc} ${fullCirc}`);
      }
      for (const [nodeId, textEl] of nodeCountTextRefsMap.current) {
        if (!textEl) continue;
        const count = counts.get(nodeId) ?? 0;
        textEl.textContent = total > 0 ? String(count) : '';
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback(() => {
    if (rafRef.current !== null) return;
    lastTimeRef.current = null;
    setRunning(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setRunning(false);
  }, []);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <SimulationContext.Provider value={{
      running, speed, setSpeed, play, pause, reset,
      startNodeId, setStartNodeId,
      particlesRef, nodeCountsRef, particleLayerRef,
      nodeFillRefsMap, nodeCountTextRefsMap,
    }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used within SimulationProvider');
  return ctx;
}
