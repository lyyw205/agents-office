import { useEditorStore, type EditorTool } from './useEditorStore';
import type { LayerName } from '../../types/tilemap';

const TOOLS: Array<{ id: EditorTool; label: string; icon: string }> = [
  { id: 'paint', label: 'Paint', icon: 'P' },
  { id: 'erase', label: 'Erase', icon: 'E' },
  { id: 'agent', label: 'Agent', icon: 'A' },
];

const LAYERS: Array<{ id: LayerName; label: string }> = [
  { id: 'floor', label: 'Floor' },
  { id: 'walls', label: 'Walls' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'decoration', label: 'Decoration' },
];

interface EditorToolbarProps {
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

export function EditorToolbar({ onSave, onCancel, saving }: EditorToolbarProps) {
  const { tool, setTool, activeLayer, setActiveLayer, showGrid, setShowGrid, dirty, canUndo, canRedo, undo, redo, zoom, setZoom, resetView } =
    useEditorStore();

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-800">
      {/* Tools */}
      <div className="flex items-center gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              tool === t.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
            onClick={() => setTool(t.id)}
            title={t.label}
          >
            <span className="mr-1 font-mono">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-gray-700" />

      {/* Layer selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Layer:</span>
        <select
          value={activeLayer}
          onChange={(e) => setActiveLayer(e.target.value as LayerName)}
          className="bg-gray-800 text-gray-200 text-xs px-2 py-1.5 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
        >
          {LAYERS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-gray-700" />

      {/* Grid toggle */}
      <button
        className={`px-3 py-1.5 text-xs rounded transition-colors ${
          showGrid
            ? 'bg-gray-700 text-gray-200'
            : 'bg-gray-800 text-gray-500 hover:text-gray-300'
        }`}
        onClick={() => setShowGrid(!showGrid)}
      >
        Grid
      </button>

      {/* Separator */}
      <div className="w-px h-6 bg-gray-700" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          className="px-1.5 py-1.5 text-xs bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 rounded transition-colors"
          onClick={() => setZoom(Math.min(4, Math.max(0.25, zoom * 0.8)))}
          title="Zoom Out"
        >
          &minus;
        </button>
        <button
          className="px-2 py-1.5 text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 rounded transition-colors tabular-nums min-w-[3.5rem] text-center"
          onClick={resetView}
          title="Reset View"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          className="px-1.5 py-1.5 text-xs bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 rounded transition-colors"
          onClick={() => setZoom(Math.min(4, Math.max(0.25, zoom * 1.25)))}
          title="Zoom In"
        >
          +
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-gray-700" />

      {/* Undo / Redo */}
      <div className="flex items-center gap-1">
        <button
          className={`px-2.5 py-1.5 text-xs rounded transition-colors ${
            canUndo
              ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
          }`}
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          className={`px-2.5 py-1.5 text-xs rounded transition-colors ${
            canRedo
              ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              : 'bg-gray-800/50 text-gray-600 cursor-not-allowed'
          }`}
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          Redo
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-gray-700" />

      {/* Reset All */}
      <button
        className="px-3 py-1.5 text-xs bg-gray-800 text-red-400/70 hover:bg-red-900/30 hover:text-red-400 rounded transition-colors"
        onClick={() => {
          if (window.confirm('Reset all tiles and agent placements?')) {
            useEditorStore.getState().clearAll();
          }
        }}
      >
        Reset All
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save / Cancel */}
      <button
        className="px-4 py-1.5 text-xs bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 rounded transition-colors"
        onClick={onCancel}
      >
        Cancel
      </button>
      <button
        className={`px-4 py-1.5 text-xs rounded font-medium transition-colors ${
          dirty
            ? 'bg-blue-600 text-white hover:bg-blue-500'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
        }`}
        onClick={onSave}
        disabled={!dirty || saving}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}
