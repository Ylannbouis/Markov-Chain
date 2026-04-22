# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server (Vite HMR)
npm run build      # tsc -b && vite build
npm run lint       # eslint
npx tsc --noEmit   # type-check only (faster than full build)
```

No test suite is configured.

## Architecture

This is a Markov Chain visualization tool built with React 19 + Vite + TypeScript (strict) + Tailwind CSS v4.

**Path alias:** `@/` maps to `src/`.

**Tailwind dark mode** uses `@custom-variant dark (&:where(.dark, .dark *))` (not the standard `media` or `class` strategies). Toggle by adding/removing `dark` class on `document.documentElement`.

### State management — three separate contexts

| Context | What it owns | How it works |
|---|---|---|
| `GraphContext` | `GraphState` (nodes + edges) | `useReducer` with `graphReducer` |
| `UIContext` | dark mode, active tool, simulation mode, selection, modal visibility | `useState` |
| `SimulationContext` | animation loop, particles, timing | `useRef` + rAF; React state only for `running`, `resetCount`, `speed`, `hasStarted`, `ensembleCount` |

Provider nesting in `App.tsx`: `GraphProvider > UIProvider > SimulationProvider` (SimulationProvider needs UIContext's `mode`, so AppInner reads `simulationMode` and passes it in).

### 60fps particle animation — bypasses React entirely

Particles live in `particlesRef` (a `useRef<Particle[]>`). Every animation frame, `tick()` in `SimulationContext` mutates particle positions and writes directly to SVG DOM via `el.setAttribute('cx', ...)`. React state is never touched during animation.

`ParticleLayer` renders the `<circle>` elements on mount and registers `particleLayerRef` pointing at its `<g>` so the tick loop can find the DOM nodes. When `resetCount` increments, `ParticleLayer` remounts (via `key={resetCount}` in `GraphCanvas`) and re-reads initial positions from `particlesRef`.

Ensemble indicator elements (fill rings, count text, bar chart fills) on each node are similarly written via refs registered in `nodeFillRefsMap`, `nodeCountTextRefsMap`, `nodeBarRefsMap`.

The ensemble fill ring uses `stroke-dasharray: frac*C C` with `rotate(-90deg)` to draw a clockwise arc starting at 12 o'clock. No `stroke-dashoffset` — the rotation alone handles the start position. Ensemble particle count is configurable up to 1000.

### Particle counting semantics

During transit, `p.currentNodeId` still holds the **last resting node** (it only advances to `edge.targetId` when `t >= 1`). Counts are always taken from `currentNodeId` for all particles, so bars and counts never drop to zero while particles are mid-transition.

### Edge geometry

`getEdgeEndpoints()` returns circumference-to-circumference points (used for drawing paths and arrowheads). `interpolateEdge()` uses **center-to-center** linear or quadratic bezier interpolation (avoids flicker at transition endpoints). Self-loops use `interpolateSelfLoop()` with an 8% linear ramp from center → arc entry, 84% along the cubic bezier arc, 8% ramp back to center.

Bidirectional edge pairs `(A→B, B→A)` are detected in `EdgeLayer` and `buildEdgeMaps()` and rendered/animated as curved quadratic beziers with a 36px perpendicular offset.

Self-loop probability labels are placed at `pullOut=72` from the node center along the loop axis (`getSelfLoopLabelPosition`). This positions the label inside the loop where the arc sides are ~±18px apart, wide enough for the text and avoiding intersection with the arc path. The arc control points extend to `pullOut=80` from the arc entry points, putting the arc peak at ~99 units from center.

### Probability normalization

`enforceStochastic()` in `src/simulation/normalizer.ts` is called from the reducer whenever an edge probability changes. It proportionally rescales sibling edges so all outgoing edges from a node sum to 1.

### Graph reducer actions

`ADD_NODE`, `UPDATE_NODE_POSITION`, `UPDATE_NODE_LABEL`, `DELETE_NODE` (cascades to incident edges + redistributes), `ADD_EDGE` (auto-assigns remaining probability), `UPDATE_EDGE_PROBABILITY` (normalizes siblings), `DELETE_EDGE` (redistributes), `LOAD_GRAPH`.

### Pan and zoom

All graph content lives in a `<g ref={viewGroupRef}>` inside the SVG. Pan and zoom are applied by writing `transform="translate(x y) scale(s)"` directly to that element via `viewGroupRef.current.setAttribute(...)` — no React state, same bypass pattern as particles.

- **Pan**: pointer down on background starts tracking. Once the pointer moves > 3px, `isPanningRef` flips true and each `pointermove` updates `panZoomRef` and calls `applyTransform()`. Pointer is captured on the SVG so panning continues outside the element. A sub-3px release is treated as a click (add node / deselect).
- **Zoom**: a non-passive native `wheel` listener (required for `preventDefault` to work) zooms to cursor. The world point under the cursor stays fixed: `newPanX = cursorSVG.x - worldX * newScale`.
- **Coordinate conversion**: `toSVG()` first converts screen→SVG via `getScreenCTM()`, then un-applies pan/zoom: `worldX = (svgX - panX) / scale`.
- The grid rect is `x="-50000" y="-50000" width="100000" height="100000"` so it covers any pan distance. `patternUnits="userSpaceOnUse"` means the 40-unit grid tiles scale naturally with zoom.

### Canvas interaction model

`GraphCanvas` handles pointer events at several levels:

- **SVG-level** (`onPointerDown` on the `<svg>`): Only fires for background clicks (guard: `t !== svgRef.current && t.id !== 'grid-bg'`). Records pan start; actual tool actions (add node / deselect) fire on `pointerup` only if the pointer moved < 3px (i.e., was a click, not a pan drag).
- **Node-level** (`onPointerDown` on each node `<g>`): Calls `e.stopPropagation()` so SVG-level never fires. In `delete` mode dispatches `DELETE_NODE` immediately (one-click); in `select` mode starts a drag; in `addEdge` mode starts a ghost edge.
- **Node label** (`onClick` / `onPointerDown` on the label `<text>`): Both events stop propagation so clicking the label neither selects the node nor starts a drag. Single click enters inline edit mode (same pattern as `ProbabilityLabel`). Blur or Enter commits via `UPDATE_NODE_LABEL`; Escape cancels.
- **Edge-level** (`onClick` on each edge `<g>`): In `delete` mode dispatches `DELETE_EDGE` immediately; otherwise selects the edge. No `stopPropagation` — SVG `onPointerDown` fires first but returns early because the path target is not `grid-bg`.

Delete behavior is symmetric: both nodes and edges are removed on a single click/tap with no confirmation while the `delete` tool is active.

### Layout

`App.tsx` uses a `flex flex-col h-screen` root. The canvas wrapper has `flex-1 min-h-0 overflow-hidden` — the `min-h-0` is required so the flex item can shrink below its content height when the toolbar or simulation controls wrap to multiple lines on smaller windows.

### Step mode

`step()` teleports any mid-transition particles to their destination, then starts one new transition per particle. `stepModeRef = true` suppresses the "auto-pick next edge" logic inside `tick()` so the loop stops naturally once all particles land.
