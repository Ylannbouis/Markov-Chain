import {
  createContext, useContext, useRef, useState, useCallback,
  useEffect, type ReactNode,
} from 'react';
import type { Particle, SimulationMode } from '@/types';
import { pickNextEdge, spawnParticles } from '@/simulation/engine';
import { interpolateEdge, interpolateSelfLoop } from '@/utils/svgGeometry';
import { useGraph } from './graphContext';

const TRANSITION_DURATION_MS = 500;
export const BAR_MAX_HEIGHT = 36;
export const ENSEMBLE_COUNT_DEFAULT = 50;

interface SimulationContextValue {
  running: boolean;
  hasStarted: boolean;
  speed: number;
  setSpeed: (s: number) => void;
  ensembleCount: number;
  setEnsembleCount: (n: number) => void;
  play: () => void;
  pause: () => void;
  step: () => void;
  reset: (mode: SimulationMode) => void;
  resetCount: number;
  startNodeId: string | null;
  setStartNodeId: (id: string) => void;
  particlesRef: React.MutableRefObject<Particle[]>;
  nodeCountsRef: React.MutableRefObject<Map<string, number>>;
  particleLayerRef: React.MutableRefObject<SVGGElement | null>;
  nodeFillRefsMap: React.MutableRefObject<Map<string, SVGCircleElement | null>>;
  nodeCountTextRefsMap: React.MutableRefObject<Map<string, SVGTextElement | null>>;
  nodeBarRefsMap: React.MutableRefObject<Map<string, SVGRectElement | null>>;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children, mode }: { children: ReactNode; mode: SimulationMode }) {
  const { graph } = useGraph();
  const [running, setRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const [ensembleCount, setEnsembleCountState] = useState(ENSEMBLE_COUNT_DEFAULT);
  const ensembleCountRef = useRef(ENSEMBLE_COUNT_DEFAULT);
  const speedRef = useRef(1);
  const [speed, setSpeedState] = useState(1);
  const [startNodeId, setStartNodeIdState] = useState<string | null>(null);
  const startNodeIdRef = useRef<string | null>(null);

  const particlesRef = useRef<Particle[]>([]);
  const nodeCountsRef = useRef<Map<string, number>>(new Map());
  const particleLayerRef = useRef<SVGGElement | null>(null);
  const nodeFillRefsMap = useRef<Map<string, SVGCircleElement | null>>(new Map());
  const nodeCountTextRefsMap = useRef<Map<string, SVGTextElement | null>>(new Map());
  const nodeBarRefsMap = useRef<Map<string, SVGRectElement | null>>(new Map());

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const stepModeRef = useRef(false);
  const graphRef = useRef(graph);
  const modeRef = useRef(mode);

  useEffect(() => { graphRef.current = graph; }, [graph]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
    setSpeedState(s);
  }, []);

  const setEnsembleCount = useCallback((n: number) => {
    ensembleCountRef.current = n;
    setEnsembleCountState(n);
  }, []);

  const setStartNodeId = useCallback((id: string) => {
    startNodeIdRef.current = id;
    setStartNodeIdState(id);
  }, []);

  const getStartNode = useCallback(() => {
    const nodes = graphRef.current.nodes;
    if (nodes.length === 0) return null;
    return nodes.find(n => n.id === startNodeIdRef.current) ?? nodes[0];
  }, []);

  const initParticles = useCallback((m: SimulationMode) => {
    const nodes = graphRef.current.nodes;
    if (nodes.length === 0) { particlesRef.current = []; nodeCountsRef.current = new Map(); return; }
    const startNode = getStartNode()!;
    if (m === 'state') {
      particlesRef.current = [{
        id: 'p_0', currentNodeId: startNode.id, transitioning: false,
        edgeId: null, t: 0, x: startNode.x, y: startNode.y,
      }];
    } else {
      particlesRef.current = spawnParticles([startNode.id], ensembleCountRef.current);
      for (const p of particlesRef.current) { p.x = startNode.x; p.y = startNode.y; }
    }
    // Seed counts: all particles at start node
    nodeCountsRef.current = new Map([[startNode.id, particlesRef.current.length]]);
  }, [getStartNode]);

  // Write current nodeCountsRef to all ensemble indicator DOM elements
  const flushIndicators = useCallback(() => {
    const counts = nodeCountsRef.current;
    const total = particlesRef.current.length;
    const g = graphRef.current;
    const nodeMap = new Map(g.nodes.map(n => [n.id, n]));

    for (const [nodeId, fillEl] of nodeFillRefsMap.current) {
      if (!fillEl) continue;
      const frac = total > 0 ? (counts.get(nodeId) ?? 0) / total : 0;
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      const fullCirc = 2 * Math.PI * node.radius;
      fillEl.setAttribute('stroke-dasharray', `${frac * fullCirc} ${fullCirc}`);
    }
    for (const [nodeId, textEl] of nodeCountTextRefsMap.current) {
      if (!textEl) continue;
      textEl.textContent = total > 0 ? String(counts.get(nodeId) ?? 0) : '';
    }
    for (const [nodeId, barEl] of nodeBarRefsMap.current) {
      if (!barEl) continue;
      const frac = total > 0 ? (counts.get(nodeId) ?? 0) / total : 0;
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      const h = frac * BAR_MAX_HEIGHT;
      barEl.setAttribute('y', String(node.radius + 8 + BAR_MAX_HEIGHT - h));
      barEl.setAttribute('height', String(h));
    }
  }, []);

  const reset = useCallback((m: SimulationMode) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimeRef.current = null;
    stepModeRef.current = false;
    setRunning(false);
    setHasStarted(false);
    initParticles(m);
    // Increment resetCount → forces ParticleLayer to remount with fresh positions
    setResetCount(c => c + 1);
    // Write ensemble indicators immediately (DOM update for indicator elements)
    flushIndicators();
  }, [initParticles, flushIndicators]);

  useEffect(() => { initParticles(mode); }, [mode, initParticles]);

  const buildEdgeMaps = useCallback(() => {
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
    return { g, edgesBySource, nodeMap, curvedEdgeIds };
  }, []);

  const tick = useCallback((timestamp: number) => {
    if (lastTimeRef.current === null) lastTimeRef.current = timestamp;
    const delta = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    const { g, edgesBySource, nodeMap, curvedEdgeIds } = buildEdgeMaps();
    const duration = TRANSITION_DURATION_MS / speedRef.current;
    const counts = new Map<string, number>();

    for (const p of particlesRef.current) {
      // Advance any in-progress transition
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
          if (p.t >= 1) {
            p.currentNodeId = edge.targetId; // update BEFORE counting
            p.transitioning = false;
            p.edgeId = null;
            p.t = 0;
          }
        }
      }

      // Start next transition for idle particles (not in step mode)
      if (!p.transitioning) {
        const node = nodeMap.get(p.currentNodeId);
        if (node) { p.x = node.x; p.y = node.y; }
        if (!stepModeRef.current) {
          const outgoing = edgesBySource.get(p.currentNodeId) ?? [];
          const next = pickNextEdge(outgoing);
          if (next) { p.transitioning = true; p.edgeId = next.id; p.t = 0; }
        }
      }

      // Count at currentNodeId — only updates when particle LANDS (t≥1),
      // so during transit the count reflects the last resting state.
      counts.set(p.currentNodeId, (counts.get(p.currentNodeId) ?? 0) + 1);
    }

    nodeCountsRef.current = counts;
    const total = particlesRef.current.length;

    // Write particle positions
    const layer = particleLayerRef.current;
    if (layer) {
      particlesRef.current.forEach((p, i) => {
        const el = layer.children[i] as SVGCircleElement | undefined;
        if (el) { el.setAttribute('cx', String(p.x)); el.setAttribute('cy', String(p.y)); }
      });
    }

    // Write ensemble indicators
    if (modeRef.current === 'ensemble') {
      for (const [nodeId, fillEl] of nodeFillRefsMap.current) {
        if (!fillEl) continue;
        const frac = total > 0 ? (counts.get(nodeId) ?? 0) / total : 0;
        const node = nodeMap.get(nodeId);
        if (!node) continue;
        const fullCirc = 2 * Math.PI * node.radius;
        fillEl.setAttribute('stroke-dasharray', `${frac * fullCirc} ${fullCirc}`);
      }
      for (const [nodeId, textEl] of nodeCountTextRefsMap.current) {
        if (!textEl) continue;
        textEl.textContent = total > 0 ? String(counts.get(nodeId) ?? 0) : '';
      }
      for (const [nodeId, barEl] of nodeBarRefsMap.current) {
        if (!barEl) continue;
        const frac = total > 0 ? (counts.get(nodeId) ?? 0) / total : 0;
        const node = nodeMap.get(nodeId);
        if (!node) continue;
        const h = frac * BAR_MAX_HEIGHT;
        barEl.setAttribute('y', String(node.radius + 8 + BAR_MAX_HEIGHT - h));
        barEl.setAttribute('height', String(h));
      }
    }

    // Stop in step mode once all particles have landed
    if (stepModeRef.current && particlesRef.current.every(p => !p.transitioning)) {
      stepModeRef.current = false;
      setRunning(false);
      rafRef.current = null;
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [buildEdgeMaps]);

  const play = useCallback(() => {
    if (rafRef.current !== null) return;
    stepModeRef.current = false;
    lastTimeRef.current = null;
    setRunning(true);
    setHasStarted(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stepModeRef.current = false;
    setRunning(false);
  }, []);

  const step = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    const { g, edgesBySource, nodeMap } = buildEdgeMaps();

    // Teleport any mid-transition particles to destination
    for (const p of particlesRef.current) {
      if (p.transitioning && p.edgeId) {
        const edge = g.edges.find(e => e.id === p.edgeId);
        if (edge) {
          p.currentNodeId = edge.targetId;
          const tgt = nodeMap.get(edge.targetId);
          if (tgt) { p.x = tgt.x; p.y = tgt.y; }
        }
        p.transitioning = false; p.edgeId = null; p.t = 0;
      }
    }

    // Start one new transition for each idle particle
    let anyStarted = false;
    for (const p of particlesRef.current) {
      const outgoing = edgesBySource.get(p.currentNodeId) ?? [];
      const next = pickNextEdge(outgoing);
      if (next) { p.transitioning = true; p.edgeId = next.id; p.t = 0; anyStarted = true; }
    }
    if (!anyStarted) return;

    stepModeRef.current = true;
    lastTimeRef.current = null;
    setRunning(true);
    setHasStarted(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, buildEdgeMaps]);

  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  return (
    <SimulationContext.Provider value={{
      running, hasStarted, speed, setSpeed,
      ensembleCount, setEnsembleCount,
      play, pause, step, reset, resetCount,
      startNodeId, setStartNodeId,
      particlesRef, nodeCountsRef, particleLayerRef,
      nodeFillRefsMap, nodeCountTextRefsMap, nodeBarRefsMap,
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
