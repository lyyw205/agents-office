import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { OfficeScene } from './OfficeScene';
import type { Agent } from '../../types';
import type { RealtimeComm } from '../../hooks/useSSE';

interface PhaserOfficeProps {
  agents: Agent[];
  sceneConfig?: string | null;
  communications?: RealtimeComm[];
}

import type { TilemapData } from '../../types/tilemap';

interface ParsedSceneConfig {
  zones?: Array<{ id: string; label: string; x: number; y: number; w: number; h: number; color: string }>;
  deskMap?: Record<string, { zone: string; x: number; y: number }>;
  tilemap?: TilemapData;
}

// New layout: 18 cols x 13 rows (864 x 624)
const GAME_W = 18 * 48;
const GAME_H = 13 * 48;

const DEFAULT_ZONES: ParsedSceneConfig['zones'] = [
  { id: 'workspace', label: 'Workspace', x: 1, y: 1, w: 16, h: 11, color: '#3B82F6' },
];

const DEFAULT_DESK_MAP: NonNullable<ParsedSceneConfig['deskMap']> = {
  A1: { zone: 'workspace', x: 2, y: 7 },
  B1: { zone: 'workspace', x: 5, y: 7 },
  C1: { zone: 'workspace', x: 8, y: 7 },
  D1: { zone: 'workspace', x: 2, y: 10 },
  E1: { zone: 'workspace', x: 5, y: 10 },
  F2: { zone: 'workspace', x: 8, y: 10 },
  G1: { zone: 'workspace', x: 2, y: 12 },
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

export function PhaserOffice({ agents, sceneConfig, communications }: PhaserOfficeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<OfficeScene | null>(null);
  const lastCommSeqRef = useRef(0);

  const parsed = parseSceneConfig(sceneConfig);
  const zones = parsed.zones ?? DEFAULT_ZONES;
  const deskMap = parsed.deskMap ?? DEFAULT_DESK_MAP;

  // Auto-assign desks to agents that don't have one
  const agentData = (() => {
    const deskKeys = Object.keys(deskMap);
    const assigned = new Set<string>();

    // First pass: collect explicitly assigned desks
    const mapped = agents.map((a) => {
      const desk = agentDesk(a);
      if (desk && deskKeys.includes(desk)) assigned.add(desk);
      return { id: a.id, name: a.name, emoji: a.emoji, status: a.status, desk, role: a.role, department: a.department };
    });

    // Second pass: auto-assign unassigned agents to available desks
    const available = deskKeys.filter((k) => !assigned.has(k));
    let nextIdx = 0;
    return mapped.map((a) => {
      if (!a.desk || !deskKeys.includes(a.desk)) {
        if (nextIdx < available.length) {
          a.desk = available[nextIdx++];
        }
      }
      return a;
    });
  })();

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
        pixelArt: false,
        antialias: true,
      },
      autoRound: false,
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

  // Forward agent updates to scene
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

  // Forward new communications to scene for visualization
  useEffect(() => {
    if (!sceneRef.current || !communications?.length) return;

    for (const comm of communications) {
      if (comm._seq <= lastCommSeqRef.current) continue;
      lastCommSeqRef.current = comm._seq;

      try {
        sceneRef.current.showCommunication(
          comm.sender_agent_id,
          comm.recipient_agent_id,
          comm.summary,
          comm.activity_type,
        );
      } catch {
        // Scene not ready
      }
    }
  }, [communications]);

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
