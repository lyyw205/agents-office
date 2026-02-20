import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AgentCommunication } from '../types';

const BASE_DELAY = 1_000;
const MAX_DELAY = 30_000;
const MAX_COMM_BUFFER = 50;

export interface RealtimeComm extends AgentCommunication {
  _seq: number;
}

export function useSSE() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [communications, setCommunications] = useState<RealtimeComm[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource('/api/sse');
    esRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
      retryRef.current = 0;
    });

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
    es.addEventListener('hook_activity', () => {
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    });

    es.addEventListener('agent_communication', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as AgentCommunication;
        const seq = ++seqRef.current;
        setCommunications((prev) => [...prev.slice(-(MAX_COMM_BUFFER - 1)), { ...data, _seq: seq }]);
      } catch { /* malformed event */ }
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;

      const delay = Math.min(BASE_DELAY * 2 ** retryRef.current, MAX_DELAY);
      retryRef.current++;
      timerRef.current = setTimeout(connect, delay);
    };
  }, [queryClient]);

  useEffect(() => {
    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (esRef.current) esRef.current.close();
    };
  }, [connect]);

  return { connected, communications };
}
