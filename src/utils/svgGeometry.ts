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
  const pullOut = 90;
  return {
    x: node.x + pullOut * Math.cos(loopAngle),
    y: node.y + pullOut * Math.sin(loopAngle),
  };
}

/** Interpolate a point along a straight or quadratic edge at t ∈ [0,1]. */
export function interpolateEdge(source: MarkovNode, target: MarkovNode, t: number, curved = false): Point {
  const { x1, y1, x2, y2 } = getEdgeEndpoints(source, target);
  if (!curved) return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const cx = (x1 + x2) / 2 - (dy / dist) * 36;
  const cy = (y1 + y2) / 2 + (dx / dist) * 36;
  const mt = 1 - t;
  return {
    x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
    y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2,
  };
}

/** Interpolate a point along a self-loop cubic bezier at t ∈ [0,1]. */
export function interpolateSelfLoop(node: MarkovNode, loopAngle: number, t: number): Point {
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
  const mt = 1 - t;
  return {
    x: mt * mt * mt * ax + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * bx,
    y: mt * mt * mt * ay + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * by,
  };
}

/** Arrow angle for straight edges (at target endpoint). */
export function getEdgeArrowAngle(source: MarkovNode, target: MarkovNode): number {
  return Math.atan2(target.y - source.y, target.x - source.x);
}
