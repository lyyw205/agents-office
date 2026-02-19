import { create } from 'zustand';
import type { TilePlacement, TilemapData, LayerName, SceneConfig, TileLayer, TileLayerStack } from '../../types/tilemap';

export type EditorTool = 'paint' | 'erase' | 'select' | 'agent';

const MAX_HISTORY = 80;

interface EditorState {
  tool: EditorTool;
  activeLayer: LayerName;
  selectedTile: TilePlacement | null;
  tilemap: TilemapData;
  dirty: boolean;
  showGrid: boolean;
  layerVisibility: Record<LayerName, boolean>;

  // Camera
  zoom: number;
  /** Increment to signal EditorScene to reset camera position and zoom */
  resetViewFlag: number;

  // Undo/Redo
  history: TilemapData[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setTool: (tool: EditorTool) => void;
  setActiveLayer: (layer: LayerName) => void;
  setSelectedTile: (tile: TilePlacement | null) => void;
  setShowGrid: (show: boolean) => void;
  toggleLayerVisibility: (layer: LayerName) => void;
  setZoom: (zoom: number) => void;
  resetView: () => void;
  paintTile: (x: number, y: number) => void;
  eraseTile: (x: number, y: number) => void;
  assignAgent: (agentId: string, x: number, y: number) => void;
  removeAgent: (agentId: string) => void;
  undo: () => void;
  redo: () => void;
  initFromSceneConfig: (sceneConfig?: string | null, agents?: Array<{ id: string; persona_json: string | null }>) => void;
  getTilemapForSave: () => TilemapData;
  clearAll: () => void;
  reset: () => void;
}

function createEmptyTilemap(): TilemapData {
  return {
    version: 1,
    width: 18,
    height: 13,
    tileSize: 48,
    tilesets: [],
    layers: {
      floor: {},
      walls: {},
      furniture: {},
      decoration: {},
    },
    agentDesks: [],
  };
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function normalizeLayer(layer?: TileLayer): TileLayerStack {
  const out: TileLayerStack = {};
  if (!layer) return out;
  for (const [key, entry] of Object.entries(layer)) {
    const stack = Array.isArray(entry) ? entry : [entry];
    if (stack.length === 0) continue;
    out[key] = stack.map((p) => ({ ...p }));
  }
  return out;
}

function normalizeTilemap(tm: TilemapData): TilemapData {
  return {
    ...tm,
    layers: {
      floor: normalizeLayer(tm.layers?.floor),
      walls: normalizeLayer(tm.layers?.walls),
      furniture: normalizeLayer(tm.layers?.furniture),
      decoration: normalizeLayer(tm.layers?.decoration),
    },
  };
}

function cloneTilemap(tm: TilemapData): TilemapData {
  return {
    ...tm,
    tilesets: [...tm.tilesets],
    layers: {
      floor: normalizeLayer(tm.layers.floor),
      walls: normalizeLayer(tm.layers.walls),
      furniture: normalizeLayer(tm.layers.furniture),
      decoration: normalizeLayer(tm.layers.decoration),
    },
    agentDesks: tm.agentDesks.map((d) => ({ ...d })),
  };
}

/** Push new tilemap to history, truncating any redo states */
function pushHistory(state: EditorState, newTilemap: TilemapData) {
  const truncated = state.history.slice(0, state.historyIndex + 1);
  const history = [...truncated, cloneTilemap(newTilemap)].slice(-MAX_HISTORY);
  const historyIndex = history.length - 1;
  return {
    tilemap: newTilemap,
    history,
    historyIndex,
    canUndo: historyIndex > 0,
    canRedo: false,
    dirty: true,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tool: 'paint',
  activeLayer: 'floor',
  selectedTile: null,
  tilemap: createEmptyTilemap(),
  dirty: false,
  showGrid: true,
  layerVisibility: { floor: true, walls: true, furniture: true, decoration: true },
  zoom: 1,
  resetViewFlag: 0,
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,

  setTool: (tool) => set({ tool }),
  setActiveLayer: (activeLayer) => set({ activeLayer }),
  setSelectedTile: (selectedTile) => set({ selectedTile }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setZoom: (zoom) => set({ zoom }),
  resetView: () => set((s) => ({ zoom: 1, resetViewFlag: s.resetViewFlag + 1 })),

  toggleLayerVisibility: (layer) =>
    set((s) => ({
      layerVisibility: { ...s.layerVisibility, [layer]: !s.layerVisibility[layer] },
    })),

  paintTile: (x, y) => {
    const state = get();
    const { selectedTile, activeLayer, tilemap } = state;
    if (!selectedTile) return;

    const key = tileKey(x, y);

    // Skip if same tile already placed at this position on this layer
    const existing = tilemap.layers[activeLayer][key];
    const stack = Array.isArray(existing)
      ? [...existing]
      : existing
        ? [{ ...existing }]
        : [];
    const top = stack[stack.length - 1];
    if (top && top.ts === selectedTile.ts && top.f === selectedTile.f) return;

    stack.push({ ...selectedTile });
    const newLayer = { ...tilemap.layers[activeLayer], [key]: stack };
    const newLayers = { ...tilemap.layers, [activeLayer]: newLayer };

    const usedTilesets = new Set(tilemap.tilesets);
    usedTilesets.add(selectedTile.ts);

    const newTilemap: TilemapData = {
      ...tilemap,
      tilesets: [...usedTilesets],
      layers: newLayers,
    };

    set(pushHistory(state, newTilemap));
  },

  eraseTile: (x, y) => {
    const state = get();
    const { activeLayer, tilemap } = state;
    const key = tileKey(x, y);

    // Skip if nothing to erase on this layer
    const existing = tilemap.layers[activeLayer][key];
    if (!existing) return;

    const stack = Array.isArray(existing)
      ? [...existing]
      : [{ ...existing }];
    stack.pop();
    const newLayer = { ...tilemap.layers[activeLayer] };
    if (stack.length === 0) {
      delete newLayer[key];
    } else {
      newLayer[key] = stack;
    }
    const newLayers = { ...tilemap.layers, [activeLayer]: newLayer };

    const newTilemap: TilemapData = {
      ...tilemap,
      layers: newLayers,
    };

    set(pushHistory(state, newTilemap));
  },

  assignAgent: (agentId, x, y) => {
    const state = get();
    const { tilemap } = state;
    const desks = tilemap.agentDesks.filter((d) => d.agentId !== agentId);
    desks.push({ agentId, x, y });

    const newTilemap: TilemapData = { ...tilemap, agentDesks: desks };
    set(pushHistory(state, newTilemap));
  },

  removeAgent: (agentId) => {
    const state = get();
    const { tilemap } = state;

    const newTilemap: TilemapData = {
      ...tilemap,
      agentDesks: tilemap.agentDesks.filter((d) => d.agentId !== agentId),
    };
    set(pushHistory(state, newTilemap));
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;

    const newIndex = historyIndex - 1;
    set({
      tilemap: cloneTilemap(history[newIndex]),
      historyIndex: newIndex,
      canUndo: newIndex > 0,
      canRedo: true,
      dirty: true,
    });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;

    const newIndex = historyIndex + 1;
    set({
      tilemap: cloneTilemap(history[newIndex]),
      historyIndex: newIndex,
      canUndo: true,
      canRedo: newIndex < history.length - 1,
      dirty: true,
    });
  },

  initFromSceneConfig: (sceneConfig, agents?) => {
    let tilemap = createEmptyTilemap();
    if (sceneConfig) {
      try {
        const parsed = JSON.parse(sceneConfig) as SceneConfig;
        if (parsed.tilemap) {
          tilemap = normalizeTilemap(parsed.tilemap);
        } else if (parsed.deskMap && agents) {
          const desks: Array<{ agentId: string; x: number; y: number }> = [];
          for (const agent of agents) {
            let deskKey: string | undefined;
            if (agent.persona_json) {
              try {
                const persona = JSON.parse(agent.persona_json) as { office?: { desk?: string } };
                deskKey = persona.office?.desk;
              } catch { /* ignore */ }
            }
            if (deskKey && parsed.deskMap[deskKey]) {
              const pos = parsed.deskMap[deskKey];
              desks.push({ agentId: agent.id, x: pos.x, y: pos.y });
            }
          }
          tilemap.agentDesks = desks;
        }
      } catch {
        // Use empty tilemap on parse failure
      }
    }
    const initial = cloneTilemap(tilemap);
    set({
      tilemap,
      dirty: false,
      history: [initial],
      historyIndex: 0,
      canUndo: false,
      canRedo: false,
    });
  },

  getTilemapForSave: () => get().tilemap,

  clearAll: () => {
    const state = get();
    set(pushHistory(state, createEmptyTilemap()));
  },

  reset: () =>
    set({
      tool: 'paint',
      activeLayer: 'floor',
      selectedTile: null,
      tilemap: createEmptyTilemap(),
      dirty: false,
      showGrid: true,
      layerVisibility: { floor: true, walls: true, furniture: true, decoration: true },
      zoom: 1,
      resetViewFlag: 0,
      history: [],
      historyIndex: -1,
      canUndo: false,
      canRedo: false,
    }),
}));
