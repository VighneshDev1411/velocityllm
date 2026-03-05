import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
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

// Billing & Usage Tracking API (Day 21)
export const billingAPI = {
  getSubscription: () => api.get('/api/v1/billing/subscription'),
  updateSubscription: (tier: string) =>
    api.post('/api/v1/billing/subscription/update', { tier }),
  getUsage: () => api.get('/api/v1/billing/usage'),
  getUsageHistory: () => api.get('/api/v1/billing/usage/history'),
  exportUsage: (format: 'json' | 'csv') =>
    api.get('/api/v1/billing/usage/export', { params: { format } }),
  listInvoices: () => api.get('/api/v1/billing/invoices'),
  generateInvoice: () => api.post('/api/v1/billing/invoices/generate'),
};

// API Key Management API (Day 20)
export const apiKeyAPI = {
  list: () => api.get('/api/v1/keys'),
  create: (data: { name: string; scopes?: string; rate_limit?: number; expires_in_days?: number }) =>
    api.post('/api/v1/keys/create', data),
  revoke: (keyId: string) =>
    api.post('/api/v1/keys/revoke', { key_id: keyId }),
  rotate: (keyId: string) =>
    api.post('/api/v1/keys/rotate', { key_id: keyId }),
  delete: (keyId: string) =>
    api.delete('/api/v1/keys/delete', { params: { key_id: keyId } }),
  getUsage: (keyId: string) =>
    api.get('/api/v1/keys/usage', { params: { key_id: keyId } }),
};

// User Management API (Day 19)
export const userManagementAPI = {
  // List all users (admin)
  listUsers: (params?: { limit?: number; offset?: number }) =>
    api.get('/api/v1/auth/users', { params }),

  // Get user details
  getUser: (userId: string) =>
    api.get('/api/v1/admin/users/get', { params: { user_id: userId } }),

  // Update user
  updateUser: (data: { user_id: string; first_name?: string; last_name?: string; username?: string; active?: boolean }) =>
    api.put('/api/v1/admin/users/update', data),

  // Delete user
  deleteUser: (userId: string) =>
    api.delete('/api/v1/admin/users/delete', { params: { user_id: userId } }),

  // Search users
  searchUsers: (query: string) =>
    api.get('/api/v1/admin/users/search', { params: { q: query } }),

  // Update user role
  updateRole: (userId: string, role: string) =>
    api.post('/api/v1/admin/users/role', { user_id: userId, role }),

  // Get user stats
  getUserStats: () =>
    api.get('/api/v1/admin/users/stats'),

  // Get activity logs
  getActivityLogs: (params?: { user_id?: string; limit?: number; offset?: number }) =>
    api.get('/api/v1/admin/activity', { params }),

  // Teams
  listTeams: () => api.get('/api/v1/admin/teams'),
  createTeam: (name: string, description: string) =>
    api.post('/api/v1/admin/teams/create', { name, description }),
  getTeamMembers: (teamId: string) =>
    api.get('/api/v1/admin/teams/members', { params: { team_id: teamId } }),
  addTeamMember: (teamId: string, userId: string, role: string) =>
    api.post('/api/v1/admin/teams/members/manage', { team_id: teamId, user_id: userId, role }),
  removeTeamMember: (teamId: string, userId: string) =>
    api.delete('/api/v1/admin/teams/members/manage', { data: { team_id: teamId, user_id: userId } }),
  deleteTeam: (teamId: string) =>
    api.delete('/api/v1/admin/teams/delete', { params: { team_id: teamId } }),
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

// Quota Management API (Day 22)
export const quotaAPI = {
  // Get current user's quota usage
  getMyUsage: () => api.get('/api/v1/quota/usage'),

  // Get current user's custom quotas
  getMyQuotas: () => api.get('/api/v1/quota/quotas'),

  // Get alert configuration
  getAlertConfig: () => api.get('/api/v1/quota/alerts/config'),

  // Update alert configuration
  updateAlertConfig: (config: any) => api.put('/api/v1/quota/alerts/config/update', config),

  // Get rate limit events
  getRateLimitEvents: (limit: number = 20) => api.get(`/api/v1/quota/rate-limits?limit=${limit}`),

  // Admin: Set custom quota for a user
  adminSetQuota: (data: {
    user_id: number;
    type: string;
    period: string;
    limit: number;
    reason: string;
  }) => api.post('/api/v1/admin/quota/set', data),

  // Admin: Get all quotas for a user
  adminGetUserQuotas: (userId: number) => api.get(`/api/v1/admin/quota/user?user_id=${userId}`),

  // Admin: Get all custom quotas
  adminGetAllQuotas: (page: number = 1, limit: number = 20) =>
    api.get(`/api/v1/admin/quota/all?page=${page}&limit=${limit}`),

  // Admin: Delete a custom quota
  adminDeleteQuota: (quotaId: number) => api.delete(`/api/v1/admin/quota/delete?quota_id=${quotaId}`),

  // Admin: Get rate limit statistics
  adminGetRateLimitStats: () => api.get('/api/v1/admin/quota/stats'),
};

export default api;
// Load Testing API (Day 23)
export const loadTestAPI = {
  // Configuration management
  listConfigs: (limit: number = 50) => api.get(`/api/v1/loadtest/configs?limit=${limit}`),
  getConfig: (id: number) => api.get(`/api/v1/loadtest/config?id=${id}`),
  createConfig: (config: any) => api.post('/api/v1/loadtest/create', config),

  // Test execution
  startTest: (configId: number) => api.post('/api/v1/loadtest/start', { config_id: configId }),
  stopTest: (runId: number) => api.post('/api/v1/loadtest/stop', { run_id: runId }),

  // Results and metrics
  listRuns: (limit: number = 20) => api.get(`/api/v1/loadtest/runs?limit=${limit}`),
  getRun: (id: number) => api.get(`/api/v1/loadtest/run?id=${id}`),
  getMetrics: (runId: number) => api.get(`/api/v1/loadtest/metrics?run_id=${runId}`),

  // Quick benchmark
  quickBenchmark: (targetRPS: number, model: string) =>
    api.post('/api/v1/loadtest/quick', { target_rps: targetRPS, model }),
};

// Webhook & Events API (Day 24)
export const webhookAPI = {
  list: () => api.get('/api/v1/webhooks'),
  create: (data: any) => api.post('/api/v1/webhooks/create', data),
  update: (data: any) => api.put('/api/v1/webhooks/update', data),
  delete: (id: number) => api.delete(`/api/v1/webhooks/delete?id=${id}`),
  toggle: (id: number, active: boolean) => api.post('/api/v1/webhooks/toggle', { id, active }),
  deliveries: (endpointId: number, limit: number = 50) =>
    api.get(`/api/v1/webhooks/deliveries?endpoint_id=${endpointId}&limit=${limit}`),
  stats: () => api.get('/api/v1/webhooks/stats'),
  availableEvents: () => api.get('/api/v1/webhooks/events'),
  eventLogs: (limit: number = 50) => api.get(`/api/v1/events/logs?limit=${limit}`),
};

// Logs & Debugging API (Day 27)
export const logsAPI = {
  getRequestLogs: (params?: { model?: string; status?: string; limit?: number; offset?: number }) =>
    api.get('/api/v1/analytics/requests', { params }),
  getActivityLogs: (params?: { user_id?: string; limit?: number; offset?: number }) =>
    api.get('/api/v1/admin/activity', { params }),
  getEventLogs: (limit: number = 100) =>
    api.get('/api/v1/events/logs', { params: { limit } }),
  getWebhookDeliveries: (endpointId: number, limit: number = 50) =>
    api.get('/api/v1/webhooks/deliveries', { params: { endpoint_id: endpointId, limit } }),
  listWebhooks: () => api.get('/api/v1/webhooks'),
};

// Admin Dashboard API (Day 25)
export const adminDashboardAPI = {
  health: () => api.get('/api/v1/admin/dashboard/health'),
  overview: () => api.get('/api/v1/admin/dashboard/overview'),
  recentEvents: () => api.get('/api/v1/admin/dashboard/events'),
  databaseStats: () => api.get('/api/v1/admin/dashboard/database'),
};

// RAG / Knowledge Base API (Day 37)
export const ragAPI = {
  listDocuments: (limit: number = 50, offset: number = 0) =>
    api.get(`/api/v1/rag/documents?limit=${limit}&offset=${offset}`),
  uploadDocument: (data: { name: string; content: string; type?: string }) =>
    api.post('/api/v1/rag/documents', data),
  getDocument: (id: string) =>
    api.get(`/api/v1/rag/documents/${id}`),
  deleteDocument: (id: string) =>
    api.delete(`/api/v1/rag/documents/${id}`),
  getStats: () => api.get('/api/v1/rag/stats'),
};

// Vector DB API (Day 38)
export const vectorAPI = {
  search: (query: string, collectionId?: string, limit: number = 10) =>
    api.post('/api/v1/vectors/search', { query, collection_id: collectionId, limit }),
  neighbors: (chunkId: string, limit: number = 5) =>
    api.post('/api/v1/vectors/neighbors', { chunk_id: chunkId, limit }),
  projection: (collectionId?: string, limit: number = 500) =>
    api.post('/api/v1/vectors/projection', { collection_id: collectionId, limit }),
  getStats: () => api.get('/api/v1/vectors/stats'),
  listCollections: () => api.get('/api/v1/vectors/collections'),
  createCollection: (name: string, description: string, color: string) =>
    api.post('/api/v1/vectors/collections', { name, description, color }),
  deleteCollection: (id: string) =>
    api.delete(`/api/v1/vectors/collections/${id}`),
  addDocToCollection: (collectionId: string, documentId: string) =>
    api.post(`/api/v1/vectors/collections/${collectionId}/documents`, { document_id: documentId }),
  removeDocFromCollection: (collectionId: string, documentId: string) =>
    api.delete(`/api/v1/vectors/collections/${collectionId}/documents/${documentId}`),
};

// Prompts / Prompt Library API (Day 9 backend, Day 39 frontend)
export const promptsAPI = {
  listTemplates: () => api.get('/api/v1/prompts/templates'),
  getTemplate: (id: string) => api.get('/api/v1/prompts/template', { params: { id } }),
  createTemplate: (data: any) => api.post('/api/v1/prompts/create', data),
  renderTemplate: (id: string, values: Record<string, string>) =>
    api.post('/api/v1/prompts/render', { template_id: id, values }),
  getVersions: (id: string) => api.get('/api/v1/prompts/versions', { params: { id } }),
  searchTemplates: (category?: string, tags?: string) =>
    api.get('/api/v1/prompts/search', { params: { category, tags } }),
  getStats: () => api.get('/api/v1/prompts/stats'),
  createABTest: (data: any) => api.post('/api/v1/prompts/abtest/create', data),
  getABTestResults: (templateId: string) =>
    api.get('/api/v1/prompts/abtest/results', { params: { template_id: templateId } }),
  stopABTest: (templateId: string) =>
    api.post('/api/v1/prompts/abtest/stop', { template_id: templateId }),
};

// Fine-Tuning API (Day 40)
export const finetuningAPI = {
  listDatasets: () => api.get('/api/v1/finetuning/datasets'),
  createDataset: (data: { name: string; description: string; format: string; examples: { input: string; output: string }[] }) =>
    api.post('/api/v1/finetuning/datasets', data),
  getDataset: (id: string) => api.get('/api/v1/finetuning/datasets/get', { params: { id } }),
  deleteDataset: (id: string) => api.delete('/api/v1/finetuning/datasets/delete', { params: { id } }),
  listJobs: () => api.get('/api/v1/finetuning/jobs'),
  createJob: (data: { dataset_id: string; base_model: string; epochs: number; learning_rate: number; batch_size: number }) =>
    api.post('/api/v1/finetuning/jobs', data),
  cancelJob: (id: string) => api.post('/api/v1/finetuning/jobs/cancel', { id }),
  listModels: () => api.get('/api/v1/finetuning/models'),
  getStats: () => api.get('/api/v1/finetuning/stats'),
};

// Model Versioning API (Day 41)
export const versioningAPI = {
  listVersions: () => api.get('/api/v1/versioning/versions'),
  createVersion: (data: { model_name: string; version: string; description: string; base_model: string; config: Record<string, string> }) =>
    api.post('/api/v1/versioning/versions', data),
  getVersion: (id: string) => api.get('/api/v1/versioning/versions/get', { params: { id } }),
  promoteVersion: (id: string) => api.post('/api/v1/versioning/versions/promote', { id }),
  archiveVersion: (id: string) => api.post('/api/v1/versioning/versions/archive', { id }),
  listABTests: () => api.get('/api/v1/versioning/abtests'),
  createABTest: (data: { model_name: string; version_a: string; version_b: string; traffic_split: number }) =>
    api.post('/api/v1/versioning/abtests', data),
  stopABTest: (id: string) => api.post('/api/v1/versioning/abtests/stop', { id }),
  getStats: () => api.get('/api/v1/versioning/stats'),
};

// Chat API (Day 36)
export const chatAPI = {
  listConversations: (limit: number = 50, offset: number = 0) =>
    api.get(`/api/v1/chat/conversations?limit=${limit}&offset=${offset}`),
  createConversation: (title?: string, model?: string) =>
    api.post('/api/v1/chat/conversations', { title, model }),
  getConversation: (id: string) =>
    api.get(`/api/v1/chat/conversations/${id}`),
  renameConversation: (id: string, title: string) =>
    api.put(`/api/v1/chat/conversations/${id}/rename`, { title }),
  deleteConversation: (id: string) =>
    api.delete(`/api/v1/chat/conversations/${id}`),
  getStats: () => api.get('/api/v1/chat/stats'),
};
