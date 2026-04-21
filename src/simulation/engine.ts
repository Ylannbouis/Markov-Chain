import type { MarkovEdge, Particle } from '@/types';

export function pickNextEdge(outgoing: MarkovEdge[]): MarkovEdge | null {
  if (outgoing.length === 0) return null;
  const r = Math.random();
  let cumulative = 0;
  for (const edge of outgoing) {
    cumulative += edge.probability;
    if (r <= cumulative) return edge;
  }
  return outgoing[outgoing.length - 1];
}

export function spawnParticles(nodeIds: string[], count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const nodeId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    particles.push({
      id: `p_${i}`,
      currentNodeId: nodeId,
      transitioning: false,
      edgeId: null,
      t: 0,
      x: 0,
      y: 0,
    });
  }
  return particles;
}
