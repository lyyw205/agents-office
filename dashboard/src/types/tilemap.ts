/** Tile placement: which tileset, which frame */
export interface TilePlacement {
  ts: string;
  f: number;
}

/** Layer: "x,y" -> TilePlacement (sparse map) */
export type TileLayer = Record<string, TilePlacement>;

/** Agent desk assignment on the tilemap */
export interface DeskAssignment {
  agentId: string;
  x: number;
  y: number;
}

/** Full tilemap data stored in scene_config.tilemap */
export interface TilemapData {
  version: 1;
  width: number;
  height: number;
  tileSize: number;
  tilesets: string[];
  layers: {
    floor: TileLayer;
    walls: TileLayer;
    furniture: TileLayer;
    decoration: TileLayer;
  };
  agentDesks: DeskAssignment[];
}

export type LayerName = keyof TilemapData['layers'];

/** scene_config extended with tilemap (backward-compatible) */
export interface SceneConfig {
  zones?: Array<{ id: string; label: string; x: number; y: number; w: number; h: number; color: string }>;
  deskMap?: Record<string, { zone: string; x: number; y: number }>;
  tilemap?: TilemapData;
}
