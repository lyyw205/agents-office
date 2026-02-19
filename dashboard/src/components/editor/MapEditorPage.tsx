import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import Phaser from 'phaser';
import { api } from '../../lib/api';
import { useEditorStore } from './useEditorStore';
import { EditorScene } from './EditorScene';
import { TilePalette } from './TilePalette';
import { EditorToolbar } from './EditorToolbar';
import { AgentPanel } from './AgentPanel';
import type { SceneConfig } from '../../types/tilemap';

const GAME_W = 18 * 48;
const GAME_H = 13 * 48;

export function MapEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<EditorScene | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.getProject(id!),
    enabled: !!id,
  });

  const initFromSceneConfig = useEditorStore((s) => s.initFromSceneConfig);
  const getTilemapForSave = useEditorStore((s) => s.getTilemapForSave);
  const reset = useEditorStore((s) => s.reset);

  // Initialize store from project scene_config
  useEffect(() => {
    if (project) {
      initFromSceneConfig(project.scene_config, project.agents);
    }
    return () => {
      reset();
    };
  }, [project, initFromSceneConfig, reset]);

  // Initialize Phaser game
  useEffect(() => {
    if (!containerRef.current || gameRef.current || !project) return;

    // Expose agents data for EditorScene markers
    (window as any).__editorAgents = project.agents.map((a) => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji,
    }));

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: GAME_W,
      height: GAME_H,
      backgroundColor: '#1a1a2e',
      scene: [EditorScene],
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
      const scene = game.scene.getScene('EditorScene') as EditorScene;
      sceneRef.current = scene;
    });

    return () => {
      delete (window as any).__editorAgents;
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // Handle HTML5 drag-and-drop for agents onto the Phaser canvas
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const agentId =
      e.dataTransfer.getData('application/agent-id') ||
      e.dataTransfer.getData('text/plain');
    if (!agentId || !sceneRef.current || !containerRef.current) return;

    const canvas = containerRef.current.querySelector('canvas');
    if (!canvas) return;

    // Convert browser coords → game coords (accounting for Scale.FIT)
    const rect = canvas.getBoundingClientRect();
    const scaleX = GAME_W / rect.width;
    const scaleY = GAME_H / rect.height;
    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;

    // Convert game coords → world coords (accounting for camera zoom/scroll)
    const camera = sceneRef.current.cameras.main;
    const worldPoint = camera.getWorldPoint(screenX, screenY);

    sceneRef.current.handleAgentDrop(agentId, worldPoint.x, worldPoint.y);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Save handler
  const handleSave = async () => {
    if (!id) return;
    setSaving(true);

    try {
      const tilemap = getTilemapForSave();

      // Build scene_config preserving existing fields
      let existing: SceneConfig = {};
      if (project?.scene_config) {
        try {
          existing = JSON.parse(project.scene_config) as SceneConfig;
        } catch {
          // ignore
        }
      }

      // Generate deskMap from agentDesks for backward compatibility
      const deskMap: Record<string, { zone: string; x: number; y: number }> = {};
      for (const desk of tilemap.agentDesks) {
        const deskLabel = `desk_${desk.agentId.slice(0, 4)}`;
        deskMap[deskLabel] = { zone: 'workspace', x: desk.x, y: desk.y };
      }

      const sceneConfig: SceneConfig = {
        ...existing,
        deskMap,
        tilemap,
      };

      await api.updateProject(id, {
        scene_config: JSON.stringify(sceneConfig),
      });

      // Update each agent's persona_json desk assignment
      for (const desk of tilemap.agentDesks) {
        const agent = project?.agents.find((a) => a.id === desk.agentId);
        let persona: Record<string, any> = {};
        if (agent?.persona_json) {
          try {
            persona = JSON.parse(agent.persona_json);
          } catch {
            // ignore
          }
        }

        const deskKey = `desk_${desk.agentId.slice(0, 4)}`;
        persona.office = { ...persona.office, desk: deskKey };

        await api.updateAgent(desk.agentId, {
          persona_json: JSON.stringify(persona),
        });
      }

      useEditorStore.setState({ dirty: false });
      toast.success('Office layout saved!');
      navigate(`/projects/${id}`);
    } catch (err) {
      toast.error('Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/projects/${id}`);
  };

  if (isLoading) {
    return <div className="p-8 text-gray-400">Loading editor...</div>;
  }

  if (!project) {
    return <div className="p-8 text-red-400">Project not found</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar onSave={handleSave} onCancel={handleCancel} saving={saving} />

      <div className="flex-1 flex min-h-0">
        {/* Left: Tile Palette */}
        <div className="w-64 shrink-0 overflow-hidden">
          <TilePalette />
        </div>

        {/* Center: Phaser Canvas */}
        <div
          className="flex-1 bg-gray-950 flex items-center justify-center overflow-hidden"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div
            ref={containerRef}
            className="w-full max-w-4xl"
            style={{ aspectRatio: `${GAME_W} / ${GAME_H}` }}
          />
        </div>

        {/* Right: Agent Panel */}
        <div className="w-60 shrink-0 overflow-hidden">
          <AgentPanel agents={project.agents} />
        </div>
      </div>
    </div>
  );
}
