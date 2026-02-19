export type TileCategory = 'floor' | 'wall' | 'furniture' | 'decoration';

export interface TilesetMeta {
  key: string;
  label: string;
  src: string;
  cols: number;
  rows: number;
  category: TileCategory;
}

export const TILESETS: TilesetMeta[] = [
  // Floor (A5 series: 384×768 = 8 cols × 16 rows)
  { key: 'floor_modern', label: 'Modern Floor', src: '/tilesets/A5_Modern_Rasak.png', cols: 8, rows: 16, category: 'floor' },
  { key: 'floor_fabric', label: 'Fabric Floor', src: '/tilesets/A5_ModernFabric_Rasak.png', cols: 8, rows: 16, category: 'floor' },
  { key: 'floor_street', label: 'Street', src: '/tilesets/A5_Street_Rasak.png', cols: 8, rows: 16, category: 'floor' },

  // Wall (A2/A3/A4 series)
  { key: 'wall_modern_a2', label: 'Modern (A2)', src: '/tilesets/A2_Modern_Rasak.png', cols: 16, rows: 12, category: 'wall' },
  { key: 'wall_buildings', label: 'Buildings', src: '/tilesets/A3_Buildings_Rasak.png', cols: 14, rows: 8, category: 'wall' },
  { key: 'wall_fabric', label: 'Fabric Wall', src: '/tilesets/A4_Fabric_Rasak.png', cols: 16, rows: 15, category: 'wall' },
  { key: 'wall_modern', label: 'Modern House', src: '/tilesets/A4_ModernHouse_Rasak.png', cols: 16, rows: 15, category: 'wall' },

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
