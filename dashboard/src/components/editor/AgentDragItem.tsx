import type { Agent } from '../../types';

interface AgentDragItemProps {
  agent: Agent;
  isPlaced: boolean;
}

export function AgentDragItem({ agent, isPlaced }: AgentDragItemProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/agent-id', agent.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`flex items-center gap-2 p-2 rounded cursor-grab active:cursor-grabbing border transition-colors ${
        isPlaced
          ? 'bg-blue-900/20 border-blue-800/50'
          : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
      }`}
    >
      <span className="text-lg">{agent.emoji || '🤖'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{agent.name}</p>
        <p className="text-[10px] text-gray-500 truncate">{agent.role}</p>
      </div>
      {isPlaced && (
        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" title="Placed on map" />
      )}
    </div>
  );
}
