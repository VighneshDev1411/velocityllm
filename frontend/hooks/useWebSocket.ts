import { useState, useEffect, useRef, useCallback } from 'react';

export interface RealtimeMetrics {
  requests_per_sec: number;
  active_connections: number;
  avg_latency_ms: number;
  total_requests: number;
  error_rate: number;
  total_errors: number;
  models: Array<{
    name: string;
    request_count: number;
    avg_latency: number;
    last_used: string;
  }>;
  cpu_usage: number;
  memory_usage_mb: number;
  memory_usage_pct: number;
  uptime_seconds: number;
  goroutines: number;
  timestamp: string;
}

export interface WSNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  category: string;
  read: boolean;
  action_url?: string;
  created_at: string;
}

interface WebSocketMessage {
  type: 'metrics' | 'notification';
  data: RealtimeMetrics | WSNotification;
}

interface UseWebSocketReturn {
  connected: boolean;
  metrics: RealtimeMetrics | null;
  lastUpdate: Date | null;
  reconnectCount: number;
  metricsHistory: RealtimeMetrics[];
  notifications: WSNotification[];
}

const MAX_HISTORY = 30; // 60 seconds at 2s intervals

export function useWebSocket(): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [metricsHistory, setMetricsHistory] = useState<RealtimeMetrics[]>([]);
  const [notifications, setNotifications] = useState<WSNotification[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef(1000);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).host
      : 'localhost:8080';
    const url = `${protocol}//${host}/api/v1/ws`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        reconnectDelayRef.current = 1000; // Reset backoff
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);
          if (msg.type === 'metrics' && msg.data) {
            setMetrics(msg.data as RealtimeMetrics);
            setLastUpdate(new Date());
            setMetricsHistory((prev) => {
              const next = [...prev, msg.data as RealtimeMetrics];
              return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
            });
          } else if (msg.type === 'notification' && msg.data) {
            setNotifications((prev) => [msg.data as WSNotification, ...prev].slice(0, 50));
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;

        // Auto-reconnect with exponential backoff
        const delay = reconnectDelayRef.current;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setReconnectCount((c) => c + 1);
            reconnectDelayRef.current = Math.min(delay * 2, 10000);
            connect();
          }
        }, delay);
      };

      ws.onerror = () => {
        // onclose will fire after onerror
      };
    } catch {
      // Connection failed, will retry via onclose logic
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { connected, metrics, lastUpdate, reconnectCount, metricsHistory, notifications };
}
