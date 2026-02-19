import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { OfficeScene } from './OfficeScene';
import type { Agent } from '../../types';

interface PhaserOfficeProps {
  agents: Agent[];
  sceneConfig?: string | null;
}

interface ParsedSceneConfig {
  zones?: Array<{ id: string; label: string; x: number; y: number; w: number; h: number; color: string }>;
  deskMap?: Record<string, { zone: string; x: number; y: number }>;
}

const DEFAULT_ZONES: ParsedSceneConfig['zones'] = [
  { id: 'entrance', label: 'Entrance', x: 0, y: 0, w: 4, h: 2, color: '#94A3B8' },
  { id: 'rd', label: 'R&D', x: 0, y: 2, w: 4, h: 3, color: '#3B82F6' },
  { id: 'design', label: 'Design', x: 4, y: 2, w: 4, h: 3, color: '#8B5CF6' },
  { id: 'engineering', label: 'Engineering', x: 0, y: 5, w: 4, h: 3, color: '#10B981' },
  { id: 'qa', label: 'QA', x: 4, y: 5, w: 4, h: 3, color: '#F59E0B' },
  { id: 'architecture', label: 'Architecture', x: 0, y: 8, w: 4, h: 3, color: '#EF4444' },
  { id: 'security', label: 'Security', x: 4, y: 8, w: 4, h: 3, color: '#6B7280' },
  { id: 'pm_office', label: 'PM Office', x: 4, y: 0, w: 4, h: 2, color: '#F97316' },
];

const DEFAULT_DESK_MAP: NonNullable<ParsedSceneConfig['deskMap']> = {
  A1: { zone: 'rd', x: 1, y: 3 },
  B2: { zone: 'design', x: 5, y: 4 },
  C1: { zone: 'engineering', x: 1, y: 6 },
  D3: { zone: 'architecture', x: 2, y: 9 },
  E1: { zone: 'qa', x: 5, y: 6 },
  F2: { zone: 'qa', x: 6, y: 7 },
  G1: { zone: 'engineering', x: 2, y: 6 },
  H3: { zone: 'engineering', x: 3, y: 7 },
  I1: { zone: 'security', x: 5, y: 9 },
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
  }));

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    // Store agent data on window so the scene can access it after creation
    (window as any).__officeSceneData = { zones, deskMap, agents: agentData };

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 8 * 48,
      height: 11 * 48,
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

    // Get the actual scene instance after Phaser creates it
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
      <div ref={containerRef} className="w-full aspect-[384/528]" />
    </div>
  );
}
