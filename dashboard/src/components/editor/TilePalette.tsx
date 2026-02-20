import { useEffect, useState } from 'react';
import { useEditorStore } from './useEditorStore';
import { getTilesetsByCategory, CATEGORY_LABELS, CATEGORY_TO_LAYER, type TileCategory, type TilesetMeta } from './tile-registry';
import type { LayerName } from '../../types/tilemap';

const CATEGORIES: TileCategory[] = ['floor', 'wall', 'furniture', 'decoration'];
const TILE = 48;
const VISIBILITY_CACHE = new Map<string, boolean[]>();

function computeTileVisibility(image: HTMLImageElement, cols: number, rows: number): boolean[] {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new Array(cols * rows).fill(true);
  }
  ctx.drawImage(image, 0, 0);

  const visibility: boolean[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const data = ctx.getImageData(col * TILE, row * TILE, TILE, TILE).data;
      let visible = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) {
          visible = true;
          break;
        }
      }
      visibility.push(visible);
    }
  }
  return visibility;
}

function TilesetGrid({ tileset }: { tileset: TilesetMeta }) {
  const { selectedTile, setSelectedTile, setActiveLayer } = useEditorStore();
  const totalFrames = tileset.cols * tileset.rows;
  const [visibility, setVisibility] = useState<boolean[] | null>(
    VISIBILITY_CACHE.get(tileset.key) ?? null,
  );

  useEffect(() => {
    const cached = VISIBILITY_CACHE.get(tileset.key);
    if (cached) {
      setVisibility(cached);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const mask = computeTileVisibility(image, tileset.cols, tileset.rows);
      VISIBILITY_CACHE.set(tileset.key, mask);
      setVisibility(mask);
    };
    image.onerror = () => {
      if (cancelled) return;
      const fallback = new Array(totalFrames).fill(true);
      VISIBILITY_CACHE.set(tileset.key, fallback);
      setVisibility(fallback);
    };
    image.src = encodeURI(tileset.src);

    return () => {
      cancelled = true;
    };
  }, [tileset.key, tileset.src, tileset.cols, tileset.rows, totalFrames]);

  useEffect(() => {
    if (!visibility || !selectedTile) return;
    if (selectedTile.ts !== tileset.key) return;
    const idx = selectedTile.f;
    if (idx >= 0 && idx < visibility.length && !visibility[idx]) {
      setSelectedTile(null);
    }
  }, [visibility, selectedTile, setSelectedTile, tileset.key]);

  if (!visibility) {
    return (
      <div className="mb-3">
        <p className="text-xs text-gray-400 mb-1 px-1">{tileset.label}</p>
        <p className="text-[10px] text-gray-500 px-1">Loading tiles...</p>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <p className="text-xs text-gray-400 mb-1 px-1">{tileset.label}</p>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(auto-fill, ${TILE}px)` }}
      >
        {Array.from({ length: totalFrames }, (_, i) => {
          if (!visibility[i]) return null;
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
              style={
                tileset.alphaBlack
                  ? {
                      backgroundImage: `url("${encodeURI(tileset.src)}"), repeating-conic-gradient(#404040 0% 25%, #303030 0% 50%)`,
                      backgroundPosition: `-${col * TILE}px -${row * TILE}px, 0 0`,
                      backgroundSize: `${tileset.cols * TILE}px ${tileset.rows * TILE}px, 8px 8px`,
                      backgroundBlendMode: 'screen',
                      imageRendering: 'pixelated',
                    }
                  : {
                      backgroundImage: `url("${encodeURI(tileset.src)}")`,
                      backgroundPosition: `-${col * TILE}px -${row * TILE}px`,
                      backgroundSize: `${tileset.cols * TILE}px ${tileset.rows * TILE}px`,
                      imageRendering: 'pixelated',
                    }
              }
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        {tilesets.length === 0 ? (
          <p className="text-xs text-gray-500 p-2">No tilesets available</p>
        ) : (
          tilesets.map((ts) => <TilesetGrid key={ts.key} tileset={ts} />)
        )}
      </div>
    </div>
  );
}
