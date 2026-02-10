// Worker Pool Types
export interface WorkerMetrics {
  total_workers: number;
  idle_workers: number;
  busy_workers: number;
  unhealthy_workers: number;
  queued_jobs: number;
  queue_utilization: number;
  total_jobs_processed: number;
  total_jobs_failed: number;
  avg_job_duration_ms: number;
  throughput_jobs_per_sec: number;
}

export interface WorkerStats {
  id: string;
  status: 'idle' | 'busy' | 'unhealthy';
  jobs_processed: number;
  jobs_failed: number;
  health_score: number;
  uptime_seconds: number;
  last_heartbeat: string;
}

// Job Types
export interface JobSubmission {
  type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  payload: Record<string, any>;
  timeout_seconds?: number;
  metadata?: Record<string, string>;
}

export interface JobStatus {
  job_id: string;
  type: string;
  priority: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  queued_at?: string;
  started_at?: string;
  completed_at?: string;
  worker_id?: string;
  duration_ms?: number;
  wait_time_ms?: number;
  result?: any;
  error?: string;
}

// Streaming Types
export interface StreamMetrics {
  active_streams: number;
  total_streams: number;
  completed_streams: number;
  cancelled_streams: number;
  errored_streams: number;
  avg_duration_ms: number;
  avg_chunks_per_stream: number;
  bytes_streamed: number;
}

// System Types
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime_seconds: number;
  total_requests: number;
  worker_pool?: {
    total_workers: number;
    busy_workers: number;
    jobs_processed: number;
    queue_utilization: number;
  };
  streaming?: {
    active_streams: number;
    total_streams: number;
    completed_streams: number;
  };
}

// Model Types
export interface Model {
  id: string;
  name: string;
  provider: string;
  type: 'completion' | 'chat' | 'embedding';
  context_window: number;
  max_tokens: number;
  cost_per_1k_tokens: {
    prompt: number;
    completion: number;
  };
  capabilities: string[];
  enabled: boolean;
}

// Request Types
export interface CompletionRequest {
  model: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  user_id?: string;
  metadata?: Record<string, string>;
}

export interface CompletionResponse {
  id: string;
  model: string;
  choices: {
    text: string;
    finish_reason: string;
    index: number;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  created_at: string;
}

// Analytics Types
export interface LatencyMetrics {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
}

export interface ThroughputMetrics {
  requests_per_second: number;
  tokens_per_second: number;
  bytes_per_second: number;
}

export interface CostMetrics {
  total_cost: number;
  cost_by_model: Record<string, number>;
  cost_by_user: Record<string, number>;
  estimated_monthly: number;
}

// Cache Types
export interface CacheStats {
  hits: number;
  misses: number;
  hit_rate: number;
  evictions: number;
  total_keys: number;
  memory_used_bytes: number;
  memory_limit_bytes: number;
}

// Router Types
export interface RouterStats {
  total_requests: number;
  requests_by_strategy: Record<string, number>;
  requests_by_model: Record<string, number>;
  avg_latency_ms: number;
  success_rate: number;
}

// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'developer' | 'viewer';
  api_key: string;
  created_at: string;
  last_login: string;
}

// API Key Types
export interface APIKey {
  id: string;
  name: string;
  key: string;
  user_id: string;
  scopes: string[];
  rate_limit: number;
  created_at: string;
  last_used: string;
  expires_at?: string;
}
