import Phaser from 'phaser';

interface AgentSprite {
  emoji: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Arc;
  nameLabel: Phaser.GameObjects.Text;
  tween?: Phaser.Tweens.Tween;
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
}

const TILE = 48;
const COLS = 8;
const ROWS = 11;

const STATUS_COLORS: Record<string, number> = {
  idle: 0x22c55e,
  working: 0xeab308,
  completed: 0x3b82f6,
  failed: 0xef4444,
  inactive: 0x6b7280,
};

export class OfficeScene extends Phaser.Scene {
  private agentSprites = new Map<string, AgentSprite>();
  private zones: ZoneConfig[] = [];
  private deskMap: Record<string, DeskConfig> = {};

  constructor() {
    super({ key: 'OfficeScene' });
  }

  create() {
    // Read initial data from window (set by PhaserOffice React component)
    const initData = (window as any).__officeSceneData as {
      zones?: ZoneConfig[];
      deskMap?: Record<string, DeskConfig>;
      agents?: AgentData[];
    } | undefined;
    this.zones = initData?.zones ?? [];
    this.deskMap = initData?.deskMap ?? {};
    const initialAgents = initData?.agents;
    // Background
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Draw grid
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x333355, 0.3);
    for (let x = 0; x <= COLS; x++) {
      graphics.lineBetween(x * TILE, 0, x * TILE, ROWS * TILE);
    }
    for (let y = 0; y <= ROWS; y++) {
      graphics.lineBetween(0, y * TILE, COLS * TILE, y * TILE);
    }

    // Draw zones
    for (const zone of this.zones) {
      const zoneGraphics = this.add.graphics();
      const color = parseInt(zone.color.replace('#', ''), 16);
      zoneGraphics.fillStyle(color, 0.15);
      zoneGraphics.fillRect(zone.x * TILE, zone.y * TILE, zone.w * TILE, zone.h * TILE);
      zoneGraphics.lineStyle(2, color, 0.4);
      zoneGraphics.strokeRect(zone.x * TILE, zone.y * TILE, zone.w * TILE, zone.h * TILE);

      // Zone label
      this.add.text(zone.x * TILE + 4, zone.y * TILE + 2, zone.label, {
        fontSize: '10px',
        color: zone.color,
        fontFamily: 'monospace',
      }).setAlpha(0.6);
    }

    // Draw desks
    const deskGraphics = this.add.graphics();
    for (const [deskId, desk] of Object.entries(this.deskMap)) {
      deskGraphics.fillStyle(0x334155, 0.5);
      deskGraphics.fillRoundedRect(desk.x * TILE + 4, desk.y * TILE + 4, TILE - 8, TILE - 8, 4);

      this.add.text(desk.x * TILE + TILE / 2, desk.y * TILE + TILE - 6, deskId, {
        fontSize: '7px',
        color: '#64748b',
        fontFamily: 'monospace',
      }).setOrigin(0.5, 1);
    }

    // Render initial agents
    if (initialAgents) {
      this.updateAgents(initialAgents);
    }
  }

  updateAgents(agents: AgentData[]) {
    // Remove old sprites for agents no longer present
    const currentIds = new Set(agents.map(a => a.id));
    for (const [id, sprite] of this.agentSprites) {
      if (!currentIds.has(id)) {
        sprite.emoji.destroy();
        sprite.status.destroy();
        sprite.nameLabel.destroy();
        sprite.tween?.destroy();
        this.agentSprites.delete(id);
      }
    }

    for (const agent of agents) {
      const desk = agent.desk ? this.deskMap[agent.desk] : null;
      if (!desk) continue;

      const cx = desk.x * TILE + TILE / 2;
      const cy = desk.y * TILE + TILE / 2 - 4;

      let sprite = this.agentSprites.get(agent.id);

      if (!sprite) {
        const emoji = this.add.text(cx, cy, agent.emoji ?? '🤖', {
          fontSize: '20px',
        }).setOrigin(0.5).setDepth(10).setInteractive({ useHandCursor: true });

        const status = this.add.circle(cx + 12, cy - 12, 4, STATUS_COLORS[agent.status] ?? 0x6b7280).setDepth(11);

        const nameLabel = this.add.text(cx, cy + 16, '', {
          fontSize: '8px',
          color: '#94a3b8',
          fontFamily: 'monospace',
        }).setOrigin(0.5).setDepth(10).setVisible(false);

        emoji.on('pointerover', () => {
          nameLabel.setText(agent.name.length > 12 ? agent.name.slice(0, 12) + '..' : agent.name);
          nameLabel.setVisible(true);
        });
        emoji.on('pointerout', () => {
          nameLabel.setVisible(false);
        });

        sprite = { emoji, status, nameLabel };
        this.agentSprites.set(agent.id, sprite);
      }

      // Update status color
      const statusColor = STATUS_COLORS[agent.status] ?? 0x6b7280;
      sprite.status.setFillStyle(statusColor);

      // Working animation
      if (agent.status === 'working' && !sprite.tween) {
        sprite.tween = this.tweens.add({
          targets: sprite.emoji,
          y: cy - 3,
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else if (agent.status !== 'working' && sprite.tween) {
        sprite.tween.destroy();
        sprite.tween = undefined;
        sprite.emoji.setY(cy);
      }
    }
  }
}
