import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useSSE() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/sse');
    eventSourceRef.current = es;

    es.addEventListener('connected', () => setConnected(true));
    es.addEventListener('heartbeat', () => {});

    es.addEventListener('task_updated', () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    });
    es.addEventListener('task_completed', () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    });
    es.addEventListener('task_failed', () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    });
    es.addEventListener('agent_status', () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    });

    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [queryClient]);

  return { connected };
}
