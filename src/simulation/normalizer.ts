import type { MarkovEdge } from '@/types';

/**
 * After an edge's probability is manually set, redistribute the remaining
 * probability proportionally among sibling edges from the same source.
 */
export function enforceStochastic(
  edges: MarkovEdge[],
  changedEdgeId: string,
  newProb: number
): MarkovEdge[] {
  const changed = edges.find(e => e.id === changedEdgeId);
  if (!changed) return edges;

  const siblings = edges.filter(
    e => e.sourceId === changed.sourceId && e.id !== changedEdgeId
  );

  const clamped = Math.max(0, Math.min(1, newProb));
  const remaining = 1 - clamped;

  let updatedSiblings: MarkovEdge[];
  if (siblings.length === 0) {
    updatedSiblings = [];
  } else {
    const siblingSum = siblings.reduce((s, e) => s + e.probability, 0);
    if (siblingSum === 0) {
      const share = remaining / siblings.length;
      updatedSiblings = siblings.map(e => ({ ...e, probability: share }));
    } else {
      updatedSiblings = siblings.map(e => ({
        ...e,
        probability: (e.probability / siblingSum) * remaining,
      }));
    }
    // Correct floating point drift: assign remainder to the largest sibling
    const actualSum = updatedSiblings.reduce((s, e) => s + e.probability, 0);
    const drift = remaining - actualSum;
    if (Math.abs(drift) > 1e-10 && updatedSiblings.length > 0) {
      const maxIdx = updatedSiblings.reduce(
        (mi, e, i) => (e.probability > updatedSiblings[mi].probability ? i : mi), 0
      );
      updatedSiblings[maxIdx] = {
        ...updatedSiblings[maxIdx],
        probability: updatedSiblings[maxIdx].probability + drift,
      };
    }
  }

  const siblingMap = new Map(updatedSiblings.map(e => [e.id, e]));
  return edges.map(e => {
    if (e.id === changedEdgeId) return { ...e, probability: clamped };
    return siblingMap.get(e.id) ?? e;
  });
}

/**
 * After deleting a node, redistribute probabilities evenly for nodes
 * that had an outgoing edge to the deleted node.
 */
export function redistributeAfterDelete(
  edges: MarkovEdge[],
  sourceNodeId: string
): MarkovEdge[] {
  const outgoing = edges.filter(e => e.sourceId === sourceNodeId);
  if (outgoing.length === 0) return edges;
  const share = 1 / outgoing.length;
  return edges.map(e =>
    e.sourceId === sourceNodeId ? { ...e, probability: share } : e
  );
}
