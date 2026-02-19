import Phaser from 'phaser';
import type { TilemapData, LayerName } from '../../types/tilemap';
import { TILESET_MAP, processAlphaBlackTextures } from '../editor/tile-registry';

interface AgentSprite {
  sprite: Phaser.GameObjects.Sprite;
  currentAnim: string;
  status: Phaser.GameObjects.Arc;
  nameLabel: Phaser.GameObjects.Text;
}

interface ZoneConfig {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface DeskConfig {
  zone: string;
  x: number;
  y: number;
}

interface AgentData {
  id: string;
  name: string;
  emoji: string | null;
  status: string;
  desk?: string;
  role?: string;
  department?: string | null;
}

const TILE = 48;
const SPRITE_SCALE = 1.8;
const Y_OFFSET = 8;

const STATUS_COLORS: Record<string, number> = {
  idle: 0x22c55e,
  working: 0xeab308,
  completed: 0x3b82f6,
  failed: 0xef4444,
  inactive: 0x6b7280,
};

const DEPARTMENT_TINTS: Record<string, number> = {
  'R&D': 0x6699ff,
  'Design': 0xaa77ff,
  'Engineering': 0x55dd88,
  'QA': 0xffcc44,
  'Architecture': 0xff6655,
  'Security': 0x99aabb,
  'Management': 0xff9944,
};

interface SheetConfig {
  key: string;
  file: string;
  frameWidth: number;
  frameHeight: number;
}

const SHEETS: SheetConfig[] = [
  { key: 'hc_idle_sheet', file: '/sprites/idle.png', frameWidth: 79, frameHeight: 79 },
  { key: 'hc_walk_sheet', file: '/sprites/walk.png', frameWidth: 79, frameHeight: 79 },
  { key: 'hc_run_sheet', file: '/sprites/run.png', frameWidth: 79, frameHeight: 79 },
  { key: 'hc_pickup_sheet', file: '/sprites/pick_up.png', frameWidth: 79, frameHeight: 79 },
  { key: 'hc_hurt_sheet', file: '/sprites/hurt.png', frameWidth: 79, frameHeight: 79 },
  { key: 'hc_death_sheet', file: '/sprites/death.png', frameWidth: 79, frameHeight: 79 },
  { key: 'hc_jump_sheet', file: '/sprites/jump.png', frameWidth: 79, frameHeight: 79 },
];

// Row 0 = front/down-facing direction (sample has 3 rows: front, side, back)
const DIR_ROW = 0;

export class OfficeScene extends Phaser.Scene {
  private agentSprites = new Map<string, AgentSprite>();
  private zones: ZoneConfig[] = [];
  private deskMap: Record<string, DeskConfig> = {};
  private tilemapData?: TilemapData;

  constructor() {
    super({ key: 'OfficeScene' });
  }

  preload() {
    const initData = (window as any).__officeSceneData as {
      zones?: ZoneConfig[];
      deskMap?: Record<string, DeskConfig>;
      agents?: AgentData[];
      tilemap?: TilemapData;
    } | undefined;

    this.tilemapData = initData?.tilemap;

    if (this.tilemapData) {
      // Load referenced tilesets
      for (const tsKey of this.tilemapData.tilesets) {
        const meta = TILESET_MAP.get(tsKey);
        if (meta) {
          const src = encodeURI(meta.src);
          this.load.spritesheet(tsKey, src, {
            frameWidth: TILE,
            frameHeight: TILE,
          });
        }
      }
    } else {
      this.load.image('office_bg', '/sprites/office_bg.png');
    }

    for (const sheet of SHEETS) {
      this.load.spritesheet(sheet.key, sheet.file, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
  }

  create() {
    // Make black pixels transparent on A4 wall tilesets (RPG Maker convention)
    processAlphaBlackTextures(this.textures, TILE);

    this.createAnimations();

    const initData = (window as any).__officeSceneData as {
      zones?: ZoneConfig[];
      deskMap?: Record<string, DeskConfig>;
      agents?: AgentData[];
      tilemap?: TilemapData;
    } | undefined;
    this.zones = initData?.zones ?? [];
    this.deskMap = initData?.deskMap ?? {};
    const initialAgents = initData?.agents;

    if (this.tilemapData) {
      // Render tilemap layers
      this.renderTilemap(this.tilemapData);
    } else {
      // Fallback: static background image
      this.add.image(0, 0, 'office_bg').setOrigin(0, 0).setDepth(0);
    }

    // Zone labels
    for (const zone of this.zones) {
      this.add.text(zone.x * TILE + 6, zone.y * TILE + 6, zone.label, {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#00000088',
        padding: { x: 4, y: 2 },
      }).setAlpha(0.9).setDepth(1);
    }

    // Render initial agents
    if (initialAgents) {
      this.updateAgents(initialAgents);
    }
  }

  private renderTilemap(tilemap: TilemapData) {
    const layerOrder: LayerName[] = ['floor', 'walls', 'furniture', 'decoration'];
    const depthMap: Record<LayerName, number> = { floor: 0, walls: 1, furniture: 2, decoration: 3 };

    for (const layerName of layerOrder) {
      const layerData = tilemap.layers[layerName];
      const depth = depthMap[layerName];

      for (const [key, placement] of Object.entries(layerData)) {
        const [xStr, yStr] = key.split(',');
        const x = parseInt(xStr, 10);
        const y = parseInt(yStr, 10);

        const stack = Array.isArray(placement) ? placement : [placement];
        for (let i = 0; i < stack.length; i++) {
          const entry = stack[i];
          if (!this.textures.exists(entry.ts)) continue;
          this.add.sprite(
            x * TILE + TILE / 2,
            y * TILE + TILE / 2,
            entry.ts,
            entry.f,
          ).setDepth(depth + i * 0.01);
        }
      }
    }
  }

  private createAnimations() {
    this.anims.create({
      key: 'hc_idle',
      frames: this.anims.generateFrameNumbers('hc_idle_sheet', {
        start: DIR_ROW * 4,
        end: DIR_ROW * 4 + 3,
      }),
      frameRate: 6,
      repeat: -1,
    });

    this.anims.create({
      key: 'hc_walk',
      frames: this.anims.generateFrameNumbers('hc_walk_sheet', {
        start: DIR_ROW * 8,
        end: DIR_ROW * 8 + 7,
      }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'hc_pickup',
      frames: this.anims.generateFrameNumbers('hc_pickup_sheet', {
        start: DIR_ROW * 6,
        end: DIR_ROW * 6 + 5,
      }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'hc_jump',
      frames: this.anims.generateFrameNumbers('hc_jump_sheet', {
        start: DIR_ROW * 6,
        end: DIR_ROW * 6 + 5,
      }),
      frameRate: 10,
      repeat: 0,
    });

    this.anims.create({
      key: 'hc_hurt',
      frames: this.anims.generateFrameNumbers('hc_hurt_sheet', {
        start: DIR_ROW * 4,
        end: DIR_ROW * 4 + 3,
      }),
      frameRate: 8,
      repeat: 0,
    });

    this.anims.create({
      key: 'hc_death',
      frames: this.anims.generateFrameNumbers('hc_death_sheet', {
        start: DIR_ROW * 6,
        end: DIR_ROW * 6 + 5,
      }),
      frameRate: 6,
      repeat: 0,
    });
  }

  private statusToAnim(status: string): string {
    switch (status) {
      case 'working': return 'hc_pickup';
      case 'completed': return 'hc_jump';
      case 'failed': return 'hc_hurt';
      case 'inactive': return 'hc_death';
      default: return 'hc_idle';
    }
  }

  private getDepartmentTint(department?: string | null): number | undefined {
    if (!department) return undefined;
    return DEPARTMENT_TINTS[department];
  }

  updateAgents(agents: AgentData[]) {
    const currentIds = new Set(agents.map(a => a.id));
    for (const [id, agentSprite] of this.agentSprites) {
      if (!currentIds.has(id)) {
        agentSprite.sprite.destroy();
        agentSprite.status.destroy();
        agentSprite.nameLabel.destroy();
        this.agentSprites.delete(id);
      }
    }

    for (const agent of agents) {
      const desk = agent.desk ? this.deskMap[agent.desk] : null;
      if (!desk) continue;

      const cx = desk.x * TILE + TILE / 2;
      const cy = desk.y * TILE + TILE / 2 - Y_OFFSET;

      let agentSprite = this.agentSprites.get(agent.id);
      const targetAnim = this.statusToAnim(agent.status);

      if (!agentSprite) {
        const sprite = this.add.sprite(cx, cy, 'hc_idle_sheet', DIR_ROW * 4)
          .setScale(SPRITE_SCALE)
          .setDepth(10)
          .setInteractive({ useHandCursor: true });

        const tint = this.getDepartmentTint(agent.department);
        if (tint) {
          sprite.setTint(tint);
        }

        const status = this.add.circle(cx + 16, cy - 16, 4, STATUS_COLORS[agent.status] ?? 0x6b7280).setDepth(11);

        const nameLabel = this.add.text(cx, cy + 28, '', {
          fontSize: '11px',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#00000099',
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5).setDepth(12).setVisible(false);

        sprite.on('pointerover', () => {
          nameLabel.setText(agent.name.length > 14 ? agent.name.slice(0, 14) + '..' : agent.name);
          nameLabel.setVisible(true);
        });
        sprite.on('pointerout', () => {
          nameLabel.setVisible(false);
        });

        sprite.play(targetAnim);

        if (targetAnim === 'hc_jump') {
          sprite.once('animationcomplete', () => {
            sprite.play('hc_idle');
            const s = this.agentSprites.get(agent.id);
            if (s) s.currentAnim = 'hc_idle';
          });
        }

        agentSprite = { sprite, currentAnim: targetAnim, status, nameLabel };
        this.agentSprites.set(agent.id, agentSprite);
      } else {
        const statusColor = STATUS_COLORS[agent.status] ?? 0x6b7280;
        agentSprite.status.setFillStyle(statusColor);

        const tint = this.getDepartmentTint(agent.department);
        if (tint) {
          agentSprite.sprite.setTint(tint);
        } else {
          agentSprite.sprite.clearTint();
        }

        if (agentSprite.currentAnim !== targetAnim) {
          agentSprite.sprite.removeAllListeners('animationcomplete');
          agentSprite.sprite.play(targetAnim);
          agentSprite.currentAnim = targetAnim;

          if (targetAnim === 'hc_jump') {
            agentSprite.sprite.once('animationcomplete', () => {
              agentSprite!.sprite.play('hc_idle');
              agentSprite!.currentAnim = 'hc_idle';
            });
          }
        }
      }
    }
  }
}
