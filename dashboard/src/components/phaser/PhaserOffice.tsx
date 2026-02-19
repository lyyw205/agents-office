import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { OfficeScene } from './OfficeScene';
import type { Agent } from '../../types';

interface PhaserOfficeProps {
  agents: Agent[];
  sceneConfig?: string | null;
}

import type { TilemapData } from '../../types/tilemap';

interface ParsedSceneConfig {
  zones?: Array<{ id: string; label: string; x: number; y: number; w: number; h: number; color: string }>;
  deskMap?: Record<string, { zone: string; x: number; y: number }>;
  tilemap?: TilemapData;
}

// New layout: 18 cols × 13 rows (864 × 624)
const GAME_W = 18 * 48;
const GAME_H = 13 * 48;

const DEFAULT_ZONES: ParsedSceneConfig['zones'] = [
  { id: 'pm_office', label: 'PM Office', x: 1, y: 1, w: 4, h: 3, color: '#F97316' },
  { id: 'meeting', label: 'Meeting Room', x: 10, y: 1, w: 7, h: 3, color: '#8B5CF6' },
  { id: 'workspace', label: 'Workspace', x: 1, y: 5, w: 12, h: 8, color: '#3B82F6' },
  { id: 'breakroom', label: 'Break Room', x: 13, y: 7, w: 4, h: 5, color: '#10B981' },
];

const DEFAULT_DESK_MAP: NonNullable<ParsedSceneConfig['deskMap']> = {
  A1: { zone: 'workspace', x: 2, y: 7 },
  B2: { zone: 'workspace', x: 5, y: 7 },
  C1: { zone: 'workspace', x: 8, y: 7 },
  D3: { zone: 'workspace', x: 2, y: 10 },
  E1: { zone: 'workspace', x: 5, y: 10 },
  F2: { zone: 'workspace', x: 8, y: 10 },
  G1: { zone: 'workspace', x: 2, y: 12 },
  H3: { zone: 'workspace', x: 5, y: 12 },
  I1: { zone: 'workspace', x: 8, y: 12 },
};

function parseSceneConfig(sceneConfig?: string | null): ParsedSceneConfig {
  if (!sceneConfig) return {};
  try {
    return JSON.parse(sceneConfig) as ParsedSceneConfig;
  } catch {
    return {};
  }
}

function agentDesk(agent: Agent): string | undefined {
  if (!agent.persona_json) return undefined;
  try {
    const persona = JSON.parse(agent.persona_json) as { office?: { desk?: string } };
    return persona.office?.desk;
  } catch {
    return undefined;
  }
}

export function PhaserOffice({ agents, sceneConfig }: PhaserOfficeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<OfficeScene | null>(null);

  const parsed = parseSceneConfig(sceneConfig);
  const zones = parsed.zones ?? DEFAULT_ZONES;
  const deskMap = parsed.deskMap ?? DEFAULT_DESK_MAP;

  const agentData = agents.map((a) => ({
    id: a.id,
    name: a.name,
    emoji: a.emoji,
    status: a.status,
    desk: agentDesk(a),
    role: a.role,
    department: a.department,
  }));

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    (window as any).__officeSceneData = { zones, deskMap, agents: agentData, tilemap: parsed.tilemap };

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: GAME_W,
      height: GAME_H,
      backgroundColor: '#1a1a2e',
      scene: [OfficeScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        pixelArt: true,
        antialias: false,
      },
    });

    gameRef.current = game;

    game.events.once('ready', () => {
      const scene = game.scene.getScene('OfficeScene') as OfficeScene;
      sceneRef.current = scene;
    });

    return () => {
      delete (window as any).__officeSceneData;
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sceneRef.current) {
      try {
        sceneRef.current.updateAgents(agentData);
      } catch {
        // Scene not ready yet
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">Office View</span>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Idle
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> Working
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Failed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" /> Inactive
          </span>
        </div>
      </div>
      <div ref={containerRef} className="w-full" style={{ aspectRatio: `${GAME_W} / ${GAME_H}` }} />
    </div>
  );
}
