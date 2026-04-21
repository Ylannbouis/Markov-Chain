import type { GraphState } from '@/types';

export const weatherExample: GraphState = {
  nodes: [
    { id: 'n_sunny', label: 'Sunny', x: 400, y: 200, radius: 44 },
    { id: 'n_cloudy', label: 'Cloudy', x: 650, y: 380, radius: 44 },
    { id: 'n_rainy', label: 'Rainy', x: 200, y: 380, radius: 44 },
  ],
  edges: [
    // Sunny outgoing
    { id: 'e_ss', sourceId: 'n_sunny', targetId: 'n_sunny', probability: 0.7, loopAngle: -Math.PI / 2 },
    { id: 'e_sc', sourceId: 'n_sunny', targetId: 'n_cloudy', probability: 0.2, loopAngle: 0 },
    { id: 'e_sr', sourceId: 'n_sunny', targetId: 'n_rainy', probability: 0.1, loopAngle: 0 },
    // Cloudy outgoing
    { id: 'e_cs', sourceId: 'n_cloudy', targetId: 'n_sunny', probability: 0.3, loopAngle: 0 },
    { id: 'e_cc', sourceId: 'n_cloudy', targetId: 'n_cloudy', probability: 0.4, loopAngle: -Math.PI / 2 },
    { id: 'e_cr', sourceId: 'n_cloudy', targetId: 'n_rainy', probability: 0.3, loopAngle: 0 },
    // Rainy outgoing
    { id: 'e_rs', sourceId: 'n_rainy', targetId: 'n_sunny', probability: 0.1, loopAngle: 0 },
    { id: 'e_rc', sourceId: 'n_rainy', targetId: 'n_cloudy', probability: 0.4, loopAngle: 0 },
    { id: 'e_rr', sourceId: 'n_rainy', targetId: 'n_rainy', probability: 0.5, loopAngle: -Math.PI / 2 },
  ],
};
