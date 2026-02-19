import type { Agent } from '../../types';
import { useEditorStore } from './useEditorStore';
import { AgentDragItem } from './AgentDragItem';

interface AgentPanelProps {
  agents: Agent[];
}

export function AgentPanel({ agents }: AgentPanelProps) {
  const { tilemap, removeAgent } = useEditorStore();
  const placedIds = new Set(tilemap.agentDesks.map((d) => d.agentId));

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800">
      <div className="px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-medium text-gray-300">Agents</span>
        <p className="text-[10px] text-gray-500 mt-0.5">Drag to place on map</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {agents.map((agent) => (
          <AgentDragItem
            key={agent.id}
            agent={agent}
            isPlaced={placedIds.has(agent.id)}
          />
        ))}
        {agents.length === 0 && (
          <p className="text-xs text-gray-500 p-2 text-center">No agents in project</p>
        )}
      </div>

      {/* Placed agents list */}
      {tilemap.agentDesks.length > 0 && (
        <div className="border-t border-gray-800 px-3 py-2">
          <p className="text-[10px] text-gray-500 mb-1">
            Placed ({tilemap.agentDesks.length})
          </p>
          <div className="space-y-1">
            {tilemap.agentDesks.map((desk) => {
              const agent = agents.find((a) => a.id === desk.agentId);
              return (
                <div
                  key={desk.agentId}
                  className="flex items-center justify-between text-xs text-gray-400 bg-gray-800/50 rounded px-2 py-1"
                >
                  <span className="truncate">
                    {agent?.emoji || '🤖'} {agent?.name || desk.agentId.slice(0, 8)}
                  </span>
                  <button
                    className="text-red-400/60 hover:text-red-400 ml-1 shrink-0"
                    onClick={() => removeAgent(desk.agentId)}
                    title="Remove placement"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
