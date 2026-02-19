import type Phaser from 'phaser';

export type TileCategory = 'floor' | 'wall' | 'furniture' | 'decoration';

export interface TilesetMeta {
  key: string;
  label: string;
  src: string;
  cols: number;
  rows: number;
  category: TileCategory;
  /** Replace near-black pixels with transparent (RPG Maker autotile convention) */
  alphaBlack?: boolean;
  /** Make the bottom N pixels of each tile transparent (wall cutout) */
  maskBottomPx?: number;
}

export const TILESETS: TilesetMeta[] = [
  // Floor (custom tiles)
  { key: 'floor_fabric_custom', label: 'Fabric Floor (Custom)', src: '/tilesets/custom_fabric_floor.png', cols: 7, rows: 1, category: 'floor' },
  { key: 'floor_carpet_custom', label: 'Carpet Floor (Custom)', src: '/tilesets/custom_carpet_floor.png', cols: 7, rows: 1, category: 'floor' },

  // Wall (custom gray tiles: corners/edges/center)
  { key: 'wall_gray_custom', label: 'Gray Wall (Custom)', src: '/tilesets/custom_gray_walls.png', cols: 3, rows: 21, category: 'wall' },

  // Furniture (Tileset series: 768×768 = 16 cols × 16 rows)
  { key: 'furn_office', label: 'Office', src: '/tilesets/Tileset_ModernHouse_StorageOffice_Rasak.png', cols: 16, rows: 16, category: 'furniture' },
  { key: 'furn_living', label: 'Living Room', src: '/tilesets/Tileset_Modern Livingroom_Rasak.png', cols: 16, rows: 16, category: 'furniture' },
  { key: 'furn_kitchen', label: 'Kitchen & Toilet', src: '/tilesets/Tileset_Modern KitchenToilett_Rasak.png', cols: 16, rows: 16, category: 'furniture' },
  { key: 'furn_bedroom', label: 'Bedroom', src: '/tilesets/Tileset_Modern Bedroom_Rasak.png', cols: 16, rows: 16, category: 'furniture' },
  { key: 'furn_system', label: 'Electronics', src: '/tilesets/Tileset_ModernSystem_Rasak.png', cols: 16, rows: 16, category: 'furniture' },
  { key: 'furn_storage', label: 'Storage', src: '/tilesets/Tileset_ModernStorageroom_Rasak.png', cols: 16, rows: 16, category: 'furniture' },
  { key: 'furn_stage', label: 'Stage', src: '/tilesets/Tileset_ModernStage_Rasak.png', cols: 16, rows: 16, category: 'furniture' },
  { key: 'furn_hydro', label: 'Hydroponics', src: '/tilesets/Tileset_Hydroponics_Rasak.png', cols: 16, rows: 16, category: 'furniture' },
  { key: 'furn_japanese', label: 'Japanese', src: '/tilesets/Tileset_Japanese_Inside_Rasak.png', cols: 16, rows: 16, category: 'furniture' },
  { key: 'furn_hospital', label: 'Hospital', src: '/tilesets/tilesetHospital/tilesethospital-4.png', cols: 16, rows: 16, category: 'furniture' },

  // Decoration (Tileset series: 768×768 = 16 cols × 16 rows)
  { key: 'deco_items', label: 'Decorations', src: '/tilesets/Tileset_ModernHouse_Decoration_Rasak.png', cols: 16, rows: 16, category: 'decoration' },
  { key: 'deco_garden', label: 'Modern Garden', src: '/tilesets/Tileset_ModernGarden_Rasak.png', cols: 16, rows: 16, category: 'decoration' },
  { key: 'deco_garden_classic', label: 'Garden', src: '/tilesets/Tileset_Garden_Rasak.png', cols: 16, rows: 16, category: 'decoration' },
  { key: 'deco_garbage', label: 'Garbage', src: '/tilesets/Tileset_ModernGarbage_Rasak.png', cols: 16, rows: 16, category: 'decoration' },
  { key: 'deco_fences', label: 'Fences', src: '/tilesets/Tileset_Fences_Rasak.png', cols: 16, rows: 16, category: 'decoration' },
  { key: 'deco_defences', label: 'Defences', src: '/tilesets/Tileset_Defences_Rasak.png', cols: 16, rows: 16, category: 'decoration' },
  { key: 'deco_city', label: 'City', src: '/tilesets/Tileset_Modern_City_Rasak.png', cols: 16, rows: 16, category: 'decoration' },
  { key: 'deco_street', label: 'Street', src: '/tilesets/Tileset_Modern_Street_Rasak.png', cols: 16, rows: 16, category: 'decoration' },
];

/** Key-based lookup */
export const TILESET_MAP = new Map(TILESETS.map((ts) => [ts.key, ts]));

/** Filter by category */
export function getTilesetsByCategory(category: TileCategory): TilesetMeta[] {
  return TILESETS.filter((ts) => ts.category === category);
}

/** Category labels for tabs */
export const CATEGORY_LABELS: Record<TileCategory, string> = {
  floor: 'Floor',
  wall: 'Wall',
  furniture: 'Furniture',
  decoration: 'Decoration',
};

/** Category to default layer mapping */
export const CATEGORY_TO_LAYER: Record<TileCategory, string> = {
  floor: 'floor',
  wall: 'walls',
  furniture: 'furniture',
  decoration: 'decoration',
};

/**
 * Process tilesets flagged with `alphaBlack` to replace near-black pixels
 * with transparency. This matches RPG Maker behaviour where black in A4
 * autotile templates means "show the layer below".
 *
 * Call once at the start of a Phaser Scene's `create()`, before rendering.
 */
export function processAlphaBlackTextures(
  textures: Phaser.Textures.TextureManager,
  tileSize: number,
) {
  const BLACK_THRESHOLD = 20;

  for (const ts of TILESETS) {
    const cutout = ts.maskBottomPx ?? 0;
    if (!ts.alphaBlack && cutout <= 0) continue;
    if (!textures.exists(ts.key)) continue;

    const texture = textures.get(ts.key);
    const source = texture.getSourceImage() as HTMLImageElement;

    // Draw original image onto a canvas
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, 0, 0);

    // Replace near-black pixels with transparent
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    const w = canvas.width;
    const h = canvas.height;
    const maxCutout = Math.max(0, Math.min(cutout, tileSize));
    for (let y = 0; y < h; y++) {
      const yInTile = y % tileSize;
      const inCutout = maxCutout > 0 && yInTile >= tileSize - maxCutout;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (ts.alphaBlack) {
          if (
            d[i] < BLACK_THRESHOLD &&
            d[i + 1] < BLACK_THRESHOLD &&
            d[i + 2] < BLACK_THRESHOLD
          ) {
            d[i + 3] = 0;
            continue;
          }
        }
        if (inCutout) {
          d[i + 3] = 0;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Replace the Phaser texture with the processed canvas
    textures.remove(ts.key);
    const canvasTex = textures.addCanvas(ts.key, canvas);

    // Re-create spritesheet frames manually
    let idx = 0;
    for (let row = 0; row < ts.rows; row++) {
      for (let col = 0; col < ts.cols; col++) {
        canvasTex.add(idx, 0, col * tileSize, row * tileSize, tileSize, tileSize);
        idx++;
      }
    }
  }
}
