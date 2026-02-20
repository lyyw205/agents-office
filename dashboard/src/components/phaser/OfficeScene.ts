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

const ACTIVITY_COLORS: Record<string, number> = {
  agent_message: 0x38bdf8,
  agent_spawn: 0x4ade80,
  task_create: 0xfbbf24,
  task_update: 0xa78bfa,
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
      this.renderTilemap(this.tilemapData);
    } else {
      this.add.image(0, 0, 'office_bg').setOrigin(0, 0).setDepth(0);
    }

    // Zone labels (skip workspace-only default)
    for (const zone of this.zones) {
      if (zone.id === 'workspace') continue;
      this.add.text(zone.x * TILE + 6, zone.y * TILE + 6, zone.label, {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#00000088',
        padding: { x: 4, y: 2 },
      }).setAlpha(0.9).setDepth(1);
    }

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

  // ---------------------------------------------------------------------------
  // Communication visualization
  // ---------------------------------------------------------------------------

  showCommunication(
    senderId: string | null,
    recipientId: string | null,
    summary: string,
    activityType: string,
  ) {
    const color = ACTIVITY_COLORS[activityType] ?? 0x38bdf8;
    const senderSprite = senderId ? this.agentSprites.get(senderId) : null;
    const recipientSprite = recipientId ? this.agentSprites.get(recipientId) : null;

    // Need at least one sprite to show anything
    const anchor = senderSprite ?? recipientSprite;
    if (!anchor) return;

    // Glow on both endpoints
    if (senderSprite) this.showGlow(senderSprite.sprite, color);
    if (recipientSprite) this.showGlow(recipientSprite.sprite, color);

    // Connection line between sender and recipient
    if (senderSprite && recipientSprite) {
      this.showConnectionLine(
        senderSprite.sprite.x, senderSprite.sprite.y,
        recipientSprite.sprite.x, recipientSprite.sprite.y,
        color,
      );
    }

    // Speech bubble on the anchor (sender if available, otherwise recipient)
    this.showBubble(anchor.sprite.x, anchor.sprite.y, summary, color);
  }

  private showGlow(sprite: Phaser.GameObjects.Sprite, color: number) {
    const glow = this.add.circle(sprite.x, sprite.y, 28, color, 0.3).setDepth(9);

    this.tweens.add({
      targets: glow,
      scaleX: 1.6,
      scaleY: 1.6,
      alpha: 0,
      duration: 1200,
      ease: 'Sine.easeOut',
      onComplete: () => glow.destroy(),
    });
  }

  private showConnectionLine(x1: number, y1: number, x2: number, y2: number, color: number) {
    const gfx = this.add.graphics().setDepth(8);
    gfx.lineStyle(2, color, 0.7);
    gfx.beginPath();
    gfx.moveTo(x1, y1);
    gfx.lineTo(x2, y2);
    gfx.strokePath();

    // Arrow head at recipient
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowLen = 8;
    const arrowAngle = Math.PI / 6;
    gfx.beginPath();
    gfx.moveTo(x2, y2);
    gfx.lineTo(
      x2 - arrowLen * Math.cos(angle - arrowAngle),
      y2 - arrowLen * Math.sin(angle - arrowAngle),
    );
    gfx.moveTo(x2, y2);
    gfx.lineTo(
      x2 - arrowLen * Math.cos(angle + arrowAngle),
      y2 - arrowLen * Math.sin(angle + arrowAngle),
    );
    gfx.strokePath();

    this.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 2500,
      delay: 500,
      ease: 'Sine.easeIn',
      onComplete: () => gfx.destroy(),
    });
  }

  private showBubble(x: number, y: number, text: string, color: number) {
    const truncated = text.length > 40 ? text.slice(0, 38) + '..' : text;
    const bubbleY = y - 48;

    const label = this.add.text(x, bubbleY, truncated, {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: `#${color.toString(16).padStart(6, '0')}cc`,
      padding: { x: 6, y: 3 },
      maxLines: 1,
      wordWrap: { width: 180 },
    }).setOrigin(0.5).setDepth(20).setAlpha(0);

    // Fade in, hold, float up + fade out
    this.tweens.add({
      targets: label,
      alpha: 1,
      y: bubbleY - 4,
      duration: 300,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: label,
          alpha: 0,
          y: bubbleY - 20,
          duration: 1500,
          delay: 2000,
          ease: 'Sine.easeIn',
          onComplete: () => label.destroy(),
        });
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Agent management
  // ---------------------------------------------------------------------------

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

        const nameLabel = this.add.text(cx, cy + 18, agent.name, {
          fontSize: '11px',
          color: '#ffffff',
          fontFamily: '"Pretendard", "Inter", system-ui, sans-serif',
          fontStyle: 'bold',
          backgroundColor: '#0f172ae6',
          padding: { x: 5, y: 3 },
          align: 'center',
          wordWrap: { width: 80 },
          shadow: { offsetX: 0, offsetY: 1, color: '#000000', blur: 3, fill: true },
        }).setOrigin(0.5, 0).setDepth(12);

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
