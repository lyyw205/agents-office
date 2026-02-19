import { useState } from 'react';
import { useEditorStore } from './useEditorStore';
import { getTilesetsByCategory, CATEGORY_LABELS, CATEGORY_TO_LAYER, type TileCategory, type TilesetMeta } from './tile-registry';
import type { LayerName } from '../../types/tilemap';

const CATEGORIES: TileCategory[] = ['floor', 'wall', 'furniture', 'decoration'];
const TILE = 48;

function TilesetGrid({ tileset }: { tileset: TilesetMeta }) {
  const { selectedTile, setSelectedTile, setActiveLayer } = useEditorStore();
  const totalFrames = tileset.cols * tileset.rows;

  return (
    <div className="mb-3">
      <p className="text-xs text-gray-400 mb-1 px-1">{tileset.label}</p>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${Math.min(tileset.cols, 6)}, ${TILE}px)` }}
      >
        {Array.from({ length: totalFrames }, (_, i) => {
          const col = i % tileset.cols;
          const row = Math.floor(i / tileset.cols);
          const isSelected = selectedTile?.ts === tileset.key && selectedTile?.f === i;

          return (
            <button
              key={i}
              className={`w-12 h-12 border cursor-pointer transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-gray-700 hover:border-gray-500'
              }`}
              style={{
                backgroundImage: `url(${tileset.src})`,
                backgroundPosition: `-${col * TILE}px -${row * TILE}px`,
                backgroundSize: `${tileset.cols * TILE}px ${tileset.rows * TILE}px`,
                imageRendering: 'pixelated',
              }}
              onClick={() => {
                setSelectedTile({ ts: tileset.key, f: i });
                // Auto-switch layer to match category
                setActiveLayer(CATEGORY_TO_LAYER[tileset.category] as LayerName);
              }}
              title={`${tileset.label} #${i}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function TilePalette() {
  const [activeTab, setActiveTab] = useState<TileCategory>('floor');

  const tilesets = getTilesetsByCategory(activeTab);

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Category tabs */}
      <div className="flex border-b border-gray-800">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
              activeTab === cat
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800/50'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab(cat)}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Tile grids */}
      <div className="flex-1 overflow-y-auto p-2">
        {tilesets.length === 0 ? (
          <p className="text-xs text-gray-500 p-2">No tilesets available</p>
        ) : (
          tilesets.map((ts) => <TilesetGrid key={ts.key} tileset={ts} />)
        )}
      </div>
    </div>
  );
}
