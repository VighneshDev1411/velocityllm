import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add any auth tokens here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Worker Pool API
export const workerAPI = {
  // Get pool metrics
  getMetrics: () => api.get('/api/v1/workers/metrics'),

  // Get worker statistics
  getStats: () => api.get('/api/v1/workers/stats'),

  // Get pool health
  getHealth: () => api.get('/api/v1/workers/health'),
  
  // Get pool configuration
  getConfig: () => api.get('/api/v1/worker/config'),
  
  // Get queue statistics
  getQueueStats: () => api.get('/api/v1/worker/queues'),
  
  // Get performance statistics
  getPerformance: () => api.get('/api/v1/worker/performance'),
  
  // Submit a job
  submitJob: (jobData: any) => api.post('/api/v1/worker/jobs', jobData),
  
  // Batch submit jobs
  batchSubmitJobs: (jobs: any[]) => api.post('/api/v1/worker/jobs/batch', { jobs }),
  
  // Get job status
  getJobStatus: (jobId: string) => api.get(`/api/v1/worker/jobs/${jobId}`),
  
  // Cancel job
  cancelJob: (jobId: string) => api.delete(`/api/v1/worker/jobs/${jobId}`),
  
  // Get worker details
  getWorkerDetails: (workerId: string) => api.get(`/api/v1/worker/workers/${workerId}`),
};

// Streaming API
export const streamAPI = {
  // Get stream metrics
  getMetrics: () => api.get('/api/v1/streaming/stats'),

  // Get stream statistics
  getStats: () => api.get('/api/v1/streaming/stats'),

  // Get stream health
  getHealth: () => api.get('/api/v1/streaming/stats'),

  // Get active streams
  getActiveStreams: () => api.get('/api/v1/streaming/stats'),

  // Get stream status
  getStreamStatus: (streamId: string) => api.get(`/api/v1/streaming/stats`),

  // Cancel stream
  cancelStream: (streamId: string) => api.delete(`/api/v1/streaming/stats`),
  
  // Start completion stream (using EventSource for SSE)
  startCompletionStream: (prompt: string, options: any = {}) => {
    return new EventSource(
      `${API_BASE_URL}/api/v1/stream/completion?` +
      new URLSearchParams({
        prompt,
        ...options,
      })
    );
  },
};

// System API
export const systemAPI = {
  // Get system health
  getHealth: () => api.get('/api/v1/health'),

  // Get system statistics
  getStats: () => api.get('/api/v1/stats'),

  // Ping
  ping: () => api.get('/api/v1/ping'),

  // List models
  listModels: () => api.get('/api/v1/models'),
};

// Analytics / Dashboard API
export const analyticsAPI = {
  // Get dashboard overview (aggregated metrics)
  getDashboardOverview: () => api.get('/api/v1/analytics/dashboard'),

  // Get time-series data for charts
  getTimeSeries: (period: string = '24h') =>
    api.get(`/api/v1/analytics/timeseries?period=${period}`),

  // Get model comparison data
  getModelComparison: () => api.get('/api/v1/analytics/models'),

  // Get cost breakdown for charts
  getCostBreakdown: () => api.get('/api/v1/analytics/cost-breakdown'),

  // Get latency metrics
  getLatencyMetrics: () => api.get('/api/v1/metrics/latency'),

  // Get throughput metrics
  getThroughputMetrics: () => api.get('/api/v1/metrics/throughput'),

  // Get metrics snapshot
  getMetricsSnapshot: () => api.get('/api/v1/metrics/snapshot'),

  // Get request log with filtering (Day 16)
  getRequestLog: (params?: { model?: string; status?: string; limit?: number; offset?: number }) =>
    api.get('/api/v1/analytics/requests', { params }),

  // Get comprehensive analytics summary (Day 16)
  getAnalyticsSummary: () => api.get('/api/v1/analytics/summary'),
};

// Settings API (Day 17)
export const settingsAPI = {
  getSettings: () => api.get('/api/v1/settings'),
  updateRoutingStrategy: (strategy: string) =>
    api.post('/api/v1/settings/routing/strategy', { strategy }),
  testProvider: (provider: string) =>
    api.post('/api/v1/settings/providers/test', { provider }),
};

// Types
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
  status: string;
  jobs_processed: number;
  jobs_failed: number;
  health_score: number;
  uptime_seconds: number;
  last_heartbeat: string;
}

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
  status: string;
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

export interface SystemHealth {
  status: string;
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

export default api;