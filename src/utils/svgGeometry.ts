import type { MarkovNode } from '@/types';

export interface Point {
  x: number;
  y: number;
}

export function screenToSVG(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const svgPt = pt.matrixTransform(ctm.inverse());
  return { x: svgPt.x, y: svgPt.y };
}

/** Returns the two circumference points where the edge enters/exits each node. */
export function getEdgeEndpoints(source: MarkovNode, target: MarkovNode) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  return {
    x1: source.x + ux * source.radius,
    y1: source.y + uy * source.radius,
    x2: target.x - ux * target.radius,
    y2: target.y - uy * target.radius,
  };
}

/** Midpoint of an edge, offset for label placement. */
export function getEdgeLabelPosition(
  source: MarkovNode,
  target: MarkovNode,
  curved: boolean,
  perp = 18
): Point {
  const { x1, y1, x2, y2 } = getEdgeEndpoints(source, target);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = curved ? 36 : perp;
  return { x: mx - (dy / dist) * offset, y: my + (dx / dist) * offset };
}

/** Returns SVG path 'd' for an edge between two distinct nodes. Pass curved=true for bidirectional pairs. */
export function getEdgePath(source: MarkovNode, target: MarkovNode, curved: boolean): string {
  const { x1, y1, x2, y2 } = getEdgeEndpoints(source, target);
  if (!curved) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = 36;
  const cx = (x1 + x2) / 2 - (dy / dist) * offset;
  const cy = (y1 + y2) / 2 + (dx / dist) * offset;
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
}

/** Returns SVG path 'd' for a self-loop. */
export function getSelfLoopPath(node: MarkovNode, loopAngle: number): string {
  const r = node.radius;
  const spread = 0.5;
  const pullOut = 80;
  const ax = node.x + r * Math.cos(loopAngle - spread);
  const ay = node.y + r * Math.sin(loopAngle - spread);
  const bx = node.x + r * Math.cos(loopAngle + spread);
  const by = node.y + r * Math.sin(loopAngle + spread);
  const c1x = ax + pullOut * Math.cos(loopAngle);
  const c1y = ay + pullOut * Math.sin(loopAngle);
  const c2x = bx + pullOut * Math.cos(loopAngle);
  const c2y = by + pullOut * Math.sin(loopAngle);
  return `M ${ax} ${ay} C ${c1x} ${c1y} ${c2x} ${c2y} ${bx} ${by}`;
}

/** Returns the arrowhead angle at the end of a self-loop path (tangent at t=1). */
export function getSelfLoopArrowAngle(node: MarkovNode, loopAngle: number): number {
  const r = node.radius;
  const spread = 0.5;
  const pullOut = 80;
  const bx = node.x + r * Math.cos(loopAngle + spread);
  const by = node.y + r * Math.sin(loopAngle + spread);
  const c2x = bx + pullOut * Math.cos(loopAngle);
  const c2y = by + pullOut * Math.sin(loopAngle);
  return Math.atan2(by - c2y, bx - c2x);
}

/** Get self-loop label position. */
export function getSelfLoopLabelPosition(node: MarkovNode, loopAngle: number): Point {
  const pullOut = 72;
  return {
    x: node.x + pullOut * Math.cos(loopAngle),
    y: node.y + pullOut * Math.sin(loopAngle),
  };
}

/**
 * Interpolate a particle position along a non-self-loop edge at t ∈ [0,1].
 * Uses center-to-center interpolation so particles emerge from / are absorbed
 * into each node cleanly, with no circumference jump between transitions.
 */
export function interpolateEdge(
  source: { x: number; y: number },
  target: { x: number; y: number },
  t: number,
  curved = false
): Point {
  if (!curved) {
    return {
      x: source.x + (target.x - source.x) * t,
      y: source.y + (target.y - source.y) * t,
    };
  }
  // Curved (bidirectional): quadratic bezier through a center-based control point,
  // same lateral offset direction as getEdgePath.
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const cx = (source.x + target.x) / 2 - (dy / dist) * 36;
  const cy = (source.y + target.y) / 2 + (dx / dist) * 36;
  const mt = 1 - t;
  return {
    x: mt * mt * source.x + 2 * mt * t * cx + t * t * target.x,
    y: mt * mt * source.y + 2 * mt * t * cy + t * t * target.y,
  };
}

/**
 * Interpolate a particle position along a self-loop at t ∈ [0,1].
 * Uses a composite path: short ramp from node center → self-loop arc → short ramp back to center.
 * Starts and ends at the node center so there is no position jump between transitions.
 */
export function interpolateSelfLoop(node: { x: number; y: number; radius: number }, loopAngle: number, t: number): Point {
  const r = node.radius;
  const spread = 0.5;
  const pullOut = 80;
  // Visual arc endpoints (same as getSelfLoopPath)
  const ax = node.x + r * Math.cos(loopAngle - spread);
  const ay = node.y + r * Math.sin(loopAngle - spread);
  const bx = node.x + r * Math.cos(loopAngle + spread);
  const by = node.y + r * Math.sin(loopAngle + spread);
  const c1x = ax + pullOut * Math.cos(loopAngle);
  const c1y = ay + pullOut * Math.sin(loopAngle);
  const c2x = bx + pullOut * Math.cos(loopAngle);
  const c2y = by + pullOut * Math.sin(loopAngle);

  const RAMP = 0.08; // fraction of t dedicated to enter/exit ramp

  if (t < RAMP) {
    // Linear ramp from node center to arc entry point
    const s = t / RAMP;
    return { x: node.x + (ax - node.x) * s, y: node.y + (ay - node.y) * s };
  } else if (t > 1 - RAMP) {
    // Linear ramp from arc exit point back to node center
    const s = (t - (1 - RAMP)) / RAMP;
    return { x: bx + (node.x - bx) * s, y: by + (node.y - by) * s };
  } else {
    // Remap to [0,1] and follow the visual arc bezier exactly
    const u = (t - RAMP) / (1 - 2 * RAMP);
    const mt = 1 - u;
    return {
      x: mt * mt * mt * ax + 3 * mt * mt * u * c1x + 3 * mt * u * u * c2x + u * u * u * bx,
      y: mt * mt * mt * ay + 3 * mt * mt * u * c1y + 3 * mt * u * u * c2y + u * u * u * by,
    };
  }
}
