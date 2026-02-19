import Phaser from 'phaser';
import { TILESETS, TILESET_MAP } from './tile-registry';
import { useEditorStore } from './useEditorStore';
import type { LayerName, DeskAssignment } from '../../types/tilemap';

const TILE = 48;
const LAYER_ORDER: LayerName[] = ['floor', 'walls', 'furniture', 'decoration'];
const LAYER_DEPTH: Record<LayerName, number> = { floor: 0, walls: 1, furniture: 2, decoration: 3 };
const GRID_DEPTH = 10;
const AGENT_MARKER_DEPTH = 15;
const HOVER_DEPTH = 20;

interface AgentMarker {
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
}

export class EditorScene extends Phaser.Scene {
  private layerContainers = new Map<LayerName, Phaser.GameObjects.Container>();
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private hoverGraphics!: Phaser.GameObjects.Graphics;
  private agentMarkers = new Map<string, AgentMarker>();
  private isPainting = false;
  private unsubscribe?: () => void;
  private mapWidth = 18;
  private mapHeight = 13;

  constructor() {
    super({ key: 'EditorScene' });
  }

  preload() {
    // Load all tilesets as spritesheets
    for (const ts of TILESETS) {
      this.load.spritesheet(ts.key, ts.src, {
        frameWidth: TILE,
        frameHeight: TILE,
      });
    }

    // Load character idle sheet for agent markers
    this.load.spritesheet('hc_idle_sheet', '/sprites/idle.png', {
      frameWidth: 79,
      frameHeight: 79,
    });

    // Load background image as reference when no tilemap exists
    this.load.image('office_bg', '/sprites/office_bg.png');
  }

  create() {
    const store = useEditorStore.getState();
    this.mapWidth = store.tilemap.width;
    this.mapHeight = store.tilemap.height;

    const hasTiles = Object.values(store.tilemap.layers).some(
      (layer) => Object.keys(layer).length > 0,
    );

    // Show background image as reference if no tiles painted yet
    if (!hasTiles && this.textures.exists('office_bg')) {
      this.add.image(0, 0, 'office_bg').setOrigin(0, 0).setDepth(-1).setAlpha(0.5);
    }

    // Create idle animation if not exists
    if (!this.anims.exists('hc_idle')) {
      this.anims.create({
        key: 'hc_idle',
        frames: this.anims.generateFrameNumbers('hc_idle_sheet', { start: 0, end: 3 }),
        frameRate: 6,
        repeat: -1,
      });
    }

    // Create layer containers
    for (const layer of LAYER_ORDER) {
      const container = this.add.container(0, 0).setDepth(LAYER_DEPTH[layer]);
      this.layerContainers.set(layer, container);
    }

    // Grid overlay
    this.gridGraphics = this.add.graphics().setDepth(GRID_DEPTH);
    this.drawGrid();

    // Hover indicator
    this.hoverGraphics = this.add.graphics().setDepth(HOVER_DEPTH);

    // Render existing tilemap data
    this.renderAllLayers();
    this.renderAgentMarkers(store.tilemap.agentDesks);

    // Pointer events
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isPainting = true;
      this.handlePointer(pointer);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.updateHover(pointer);
      if (this.isPainting) {
        this.handlePointer(pointer);
      }
    });

    this.input.on('pointerup', () => {
      this.isPainting = false;
    });

    this.input.on('pointerout', () => {
      this.isPainting = false;
      this.hoverGraphics.clear();
    });

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        useEditorStore.getState().undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
        event.preventDefault();
        useEditorStore.getState().redo();
      }
    });

    // Subscribe to store changes for reactivity
    this.unsubscribe = useEditorStore.subscribe((state, prevState) => {
      if (state.showGrid !== prevState.showGrid) {
        this.gridGraphics.setVisible(state.showGrid);
      }
      if (state.layerVisibility !== prevState.layerVisibility) {
        for (const layer of LAYER_ORDER) {
          const container = this.layerContainers.get(layer);
          if (container) {
            container.setVisible(state.layerVisibility[layer]);
          }
        }
      }
      if (state.tilemap !== prevState.tilemap) {
        this.renderAllLayers();
        this.renderAgentMarkers(state.tilemap.agentDesks);
      }
    });
  }

  private toTile(pointer: Phaser.Input.Pointer): { tx: number; ty: number } | null {
    const tx = Math.floor(pointer.worldX / TILE);
    const ty = Math.floor(pointer.worldY / TILE);
    if (tx < 0 || tx >= this.mapWidth || ty < 0 || ty >= this.mapHeight) return null;
    return { tx, ty };
  }

  private handlePointer(pointer: Phaser.Input.Pointer) {
    const pos = this.toTile(pointer);
    if (!pos) return;

    const store = useEditorStore.getState();

    if (store.tool === 'paint') {
      store.paintTile(pos.tx, pos.ty);
    } else if (store.tool === 'erase') {
      store.eraseTile(pos.tx, pos.ty);
    }
  }

  private updateHover(pointer: Phaser.Input.Pointer) {
    this.hoverGraphics.clear();
    const pos = this.toTile(pointer);
    if (!pos) return;

    const store = useEditorStore.getState();
    const color = store.tool === 'erase' ? 0xff4444 : 0x4488ff;
    this.hoverGraphics.lineStyle(2, color, 0.8);
    this.hoverGraphics.strokeRect(pos.tx * TILE, pos.ty * TILE, TILE, TILE);
    this.hoverGraphics.fillStyle(color, 0.15);
    this.hoverGraphics.fillRect(pos.tx * TILE, pos.ty * TILE, TILE, TILE);
  }

  private drawGrid() {
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0xffffff, 0.08);
    for (let x = 0; x <= this.mapWidth; x++) {
      this.gridGraphics.moveTo(x * TILE, 0);
      this.gridGraphics.lineTo(x * TILE, this.mapHeight * TILE);
    }
    for (let y = 0; y <= this.mapHeight; y++) {
      this.gridGraphics.moveTo(0, y * TILE);
      this.gridGraphics.lineTo(this.mapWidth * TILE, y * TILE);
    }
    this.gridGraphics.strokePath();
  }

  renderAllLayers() {
    const store = useEditorStore.getState();

    for (const layer of LAYER_ORDER) {
      const container = this.layerContainers.get(layer);
      if (!container) continue;
      container.removeAll(true);

      const layerData = store.tilemap.layers[layer];
      for (const [key, placement] of Object.entries(layerData)) {
        const [xStr, yStr] = key.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);
        const tsMeta = TILESET_MAP.get(placement.ts);
        if (!tsMeta) continue;

        // Check if tileset texture is loaded
        if (!this.textures.exists(placement.ts)) continue;

        const sprite = this.add.sprite(
          x * TILE + TILE / 2,
          y * TILE + TILE / 2,
          placement.ts,
          placement.f,
        );
        container.add(sprite);
      }

      container.setVisible(store.layerVisibility[layer]);
    }
  }

  private renderAgentMarkers(desks: DeskAssignment[]) {
    // Clear existing markers
    for (const [, marker] of this.agentMarkers) {
      marker.sprite.destroy();
      marker.label.destroy();
    }
    this.agentMarkers.clear();

    // Get agents data from window
    const agentsData = (window as any).__editorAgents as Array<{
      id: string;
      name: string;
      emoji: string | null;
    }> | undefined;

    for (const desk of desks) {
      const cx = desk.x * TILE + TILE / 2;
      const cy = desk.y * TILE + TILE / 2;
      const agentInfo = agentsData?.find((a) => a.id === desk.agentId);

      const sprite = this.add.sprite(cx, cy, 'hc_idle_sheet', 0)
        .setScale(1.4)
        .setDepth(AGENT_MARKER_DEPTH);

      if (this.anims.exists('hc_idle')) {
        sprite.play('hc_idle');
      }

      const name = agentInfo?.name ?? desk.agentId.slice(0, 8);
      const label = this.add.text(cx, cy + 22, name, {
        fontSize: '7px',
        color: '#ffffff',
        fontFamily: 'monospace',
        backgroundColor: '#000000aa',
        padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(AGENT_MARKER_DEPTH + 1);

      this.agentMarkers.set(desk.agentId, { sprite, label });
    }
  }

  /** Called externally to handle agent drop from HTML drag-and-drop */
  handleAgentDrop(agentId: string, worldX: number, worldY: number) {
    const tx = Math.floor(worldX / TILE);
    const ty = Math.floor(worldY / TILE);
    if (tx < 0 || tx >= this.mapWidth || ty < 0 || ty >= this.mapHeight) return;
    useEditorStore.getState().assignAgent(agentId, tx, ty);
  }

  shutdown() {
    this.unsubscribe?.();
  }
}
