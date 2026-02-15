'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Server, Activity, Wifi, Shield, AlertTriangle, CheckCircle,
  XCircle, Clock, Zap, Database, HardDrive, Globe, RefreshCw,
  Bell, TrendingUp
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6'];

// --- Data Hooks ---

function useSystemHealth() {
  return useQuery({
    queryKey: ['monitoring-system-health'],
    queryFn: async () => {
      const res = await api.get('/api/v1/system/health');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useWorkerMetrics() {
  return useQuery({
    queryKey: ['monitoring-worker-metrics'],
    queryFn: async () => {
      const res = await api.get('/api/v1/workers/metrics');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useWorkerList() {
  return useQuery({
    queryKey: ['monitoring-workers'],
    queryFn: async () => {
      const res = await api.get('/api/v1/workers');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useConnectionPools() {
  return useQuery({
    queryKey: ['monitoring-pools'],
    queryFn: async () => {
      const res = await api.get('/api/v1/optimization/pools');
      return res.data?.data;
    },
    refetchInterval: 10000,
  });
}

function useRateLimiter() {
  return useQuery({
    queryKey: ['monitoring-rate-limiter'],
    queryFn: async () => {
      const res = await api.get('/api/v1/metrics/rate-limiter');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useBackpressure() {
  return useQuery({
    queryKey: ['monitoring-backpressure'],
    queryFn: async () => {
      const res = await api.get('/api/v1/metrics/backpressure/status');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useMetricsSnapshot() {
  return useQuery({
    queryKey: ['monitoring-metrics'],
    queryFn: async () => {
      const res = await api.get('/api/v1/metrics/snapshot');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

// --- Main Component ---

export default function MonitoringPage() {
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: workerMetrics } = useWorkerMetrics();
  const { data: workers } = useWorkerList();
  const { data: pools } = useConnectionPools();
  const { data: rateLimiter } = useRateLimiter();
  const { data: backpressure } = useBackpressure();
  const { data: metricsSnapshot } = useMetricsSnapshot();

  // Generate alerts based on current state
  const alerts = generateAlerts(health, workerMetrics, backpressure, metricsSnapshot);

  if (healthLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Connecting to monitoring...</p>
        </div>
      </div>
    );
  }

  const systemStatus = health?.status || 'unknown';
  const statusColor = systemStatus === 'healthy' ? 'text-green-400' : systemStatus === 'degraded' ? 'text-yellow-400' : 'text-red-400';
  const statusBg = systemStatus === 'healthy' ? 'bg-green-500/10 border-green-500/30' : systemStatus === 'degraded' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30';
  const statusDot = systemStatus === 'healthy' ? 'bg-green-500' : systemStatus === 'degraded' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-green-400" />
              <div>
                <h1 className="text-xl font-bold text-white">System Monitoring</h1>
                <p className="text-xs text-gray-400">Real-time infrastructure health</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Auto-refresh 5s
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusBg}`}>
                <div className={`w-2 h-2 rounded-full ${statusDot} animate-pulse`}></div>
                <span className={`text-sm font-medium capitalize ${statusColor}`}>{systemStatus}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Backpressure Alert */}
        {backpressure?.active && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-300">Backpressure Active</p>
              <p className="text-sm text-red-400">{backpressure.reason || 'System is under heavy load. Some requests may be rejected.'}</p>
            </div>
          </div>
        )}

        {/* Alert Notifications */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-gray-300">Alerts ({alerts.length})</span>
            </div>
            {alerts.map((alert, i) => (
              <div key={i} className={`rounded-lg p-3 flex items-center gap-3 text-sm ${
                alert.severity === 'critical' ? 'bg-red-900/20 border border-red-500/30 text-red-300' :
                alert.severity === 'warning' ? 'bg-yellow-900/20 border border-yellow-500/30 text-yellow-300' :
                'bg-blue-900/20 border border-blue-500/30 text-blue-300'
              }`}>
                {alert.severity === 'critical' ? <XCircle className="w-4 h-4 flex-shrink-0" /> :
                 alert.severity === 'warning' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> :
                 <Bell className="w-4 h-4 flex-shrink-0" />}
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* System Health Checks */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-400" />
            Health Checks
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {health?.checks && Object.entries(health.checks).map(([name, check]: [string, any]) => (
              <div key={name} className={`rounded-lg p-3 border ${
                check.status ? 'bg-green-900/10 border-green-500/20' : 'bg-red-900/10 border-red-500/20'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {check.status ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                  <span className="text-xs font-medium text-gray-300 capitalize">{name.replace('_', ' ')}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {typeof check === 'object' ? Object.entries(check).filter(([k]) => k !== 'status').map(([k, v]) => `${k}: ${v}`).join(', ') : String(check)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Worker Pool Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Worker Grid */}
          <div className="lg:col-span-2 bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              Worker Pool ({workerMetrics?.total_workers || 0} workers)
            </h2>
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2 mb-4">
              {(workers || []).map((w: any, i: number) => (
                <WorkerDot key={i} worker={w} />
              ))}
              {(!workers || workers.length === 0) && Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-gray-700/50 border border-gray-600/30 flex items-center justify-center">
                  <span className="text-[10px] text-gray-500">{i + 1}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500"></span> Idle</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500"></span> Busy</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500"></span> Unhealthy</span>
            </div>
          </div>

          {/* Queue Status */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              Queue Status
            </h2>
            <div className="space-y-4">
              <GaugeCircle
                value={workerMetrics?.queue_utilization || 0}
                label="Queue Utilization"
                color={
                  (workerMetrics?.queue_utilization || 0) > 80 ? '#ef4444' :
                  (workerMetrics?.queue_utilization || 0) > 50 ? '#f59e0b' : '#10b981'
                }
              />
              <div className="grid grid-cols-2 gap-3 mt-4">
                <MetricBox label="Queued" value={workerMetrics?.queued_jobs || 0} color="yellow" />
                <MetricBox label="In Progress" value={workerMetrics?.jobs_in_progress || 0} color="blue" />
                <MetricBox label="Processed" value={workerMetrics?.total_jobs_processed || 0} color="green" />
                <MetricBox label="Failed" value={workerMetrics?.total_jobs_failed || 0} color="red" />
              </div>
              <div className="pt-3 border-t border-gray-700">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Throughput</span>
                  <span className="text-gray-300 font-mono">{(workerMetrics?.throughput_jobs_per_sec || 0).toFixed(2)} jobs/s</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-500">Avg Duration</span>
                  <span className="text-gray-300 font-mono">{(workerMetrics?.avg_job_duration_ms || 0).toFixed(0)}ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Pools */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PoolCard
            icon={<Database className="w-4 h-4" />}
            title="Database Pool"
            data={pools?.database}
            color="blue"
          />
          <PoolCard
            icon={<HardDrive className="w-4 h-4" />}
            title="Redis Pool"
            data={pools?.redis}
            color="purple"
          />
          <PoolCard
            icon={<Globe className="w-4 h-4" />}
            title="HTTP Pool"
            data={pools?.http}
            color="green"
          />
        </div>

        {/* Rate Limiting & Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Rate Limiter */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-yellow-400" />
              Rate Limiting
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Total Requests</span>
                <span className="text-sm font-mono text-gray-200">{rateLimiter?.total_requests || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Allowed</span>
                <span className="text-sm font-mono text-green-400">{rateLimiter?.allowed || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Rejected</span>
                <span className="text-sm font-mono text-red-400">{rateLimiter?.rejected || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Active Users</span>
                <span className="text-sm font-mono text-gray-200">{rateLimiter?.active_users || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Limit</span>
                <span className="text-sm font-mono text-gray-200">{rateLimiter?.requests_per_minute || 100} req/min</span>
              </div>
              {/* Rejection rate bar */}
              <div className="pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">Rejection Rate</span>
                  <span className="text-gray-400">
                    {rateLimiter?.total_requests > 0
                      ? ((rateLimiter.rejected / rateLimiter.total_requests) * 100).toFixed(1)
                      : '0.0'}%
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-red-500 transition-all"
                    style={{
                      width: `${rateLimiter?.total_requests > 0
                        ? Math.min((rateLimiter.rejected / rateLimiter.total_requests) * 100, 100)
                        : 0}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Performance Summary */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-400" />
              Performance Metrics
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Total Requests</span>
                <span className="text-sm font-mono text-gray-200">{metricsSnapshot?.throughput?.total_requests || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Req/Second</span>
                <span className="text-sm font-mono text-blue-400">{metricsSnapshot?.throughput?.requests_per_second || '0.00'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">P50 Latency</span>
                <span className="text-sm font-mono text-green-400">{metricsSnapshot?.latency?.p50_ms || 0}ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">P99 Latency</span>
                <span className="text-sm font-mono text-yellow-400">{metricsSnapshot?.latency?.p99_ms || 0}ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Error Rate</span>
                <span className={`text-sm font-mono ${
                  parseFloat(metricsSnapshot?.errors?.error_rate || '0') > 5 ? 'text-red-400' : 'text-green-400'
                }`}>{metricsSnapshot?.errors?.error_rate || '0.00%'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Total Cost</span>
                <span className="text-sm font-mono text-gray-200">{metricsSnapshot?.cost?.total_cost || '$0.0000'}</span>
              </div>
              {/* Latency bar chart */}
              <div className="pt-3 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-2">Latency Percentiles</p>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'P50', value: metricsSnapshot?.latency?.p50_ms || 0 },
                      { name: 'P90', value: metricsSnapshot?.latency?.p90_ms || 0 },
                      { name: 'P95', value: metricsSnapshot?.latency?.p95_ms || 0 },
                      { name: 'P99', value: metricsSnapshot?.latency?.p99_ms || 0 },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="ms" />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px', color: '#e5e7eb' }} />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Backpressure Status */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Backpressure Status
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                backpressure?.active ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'
              }`}>
                {backpressure?.active ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                {backpressure?.active ? 'Active' : 'Inactive'}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Status</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-mono font-bold text-gray-200">{backpressure?.queue_usage || '0.00%'}</p>
              <p className="text-[10px] text-gray-500">Queue Usage</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-mono font-bold text-gray-200">{backpressure?.worker_utilization || '0.00%'}</p>
              <p className="text-[10px] text-gray-500">Worker Utilization</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-mono font-bold text-red-400">{backpressure?.requests_rejected || 0}</p>
              <p className="text-[10px] text-gray-500">Rejected</p>
            </div>
          </div>
        </div>

        {/* Model Performance */}
        {metricsSnapshot?.models && metricsSnapshot.models.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Model Performance
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Model</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">Requests</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">Success Rate</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">Avg Latency</th>
                    <th className="text-right py-2 px-3 text-gray-400 font-medium">Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {metricsSnapshot.models.map((m: any, i: number) => (
                    <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                      <td className="py-2 px-3 text-gray-200 font-mono">{m.model_name}</td>
                      <td className="py-2 px-3 text-right text-gray-300">{m.request_count}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={parseFloat(m.success_rate) > 95 ? 'text-green-400' : 'text-yellow-400'}>
                          {m.success_rate}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-gray-300">{m.avg_latency_ms}ms</td>
                      <td className="py-2 px-3 text-right text-gray-300">{m.total_cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// --- Sub Components ---

function WorkerDot({ worker }: { worker: any }) {
  const status = worker.status || 'idle';
  const colorMap: Record<string, string> = {
    idle: 'bg-green-500/80 border-green-400/30',
    busy: 'bg-blue-500/80 border-blue-400/30',
    unhealthy: 'bg-red-500/80 border-red-400/30 animate-pulse',
  };

  const bgColor = colorMap[status] || colorMap.idle;

  return (
    <div
      className={`aspect-square rounded-lg border flex items-center justify-center cursor-default ${bgColor}`}
      title={`Worker ${worker.id || '?'} - ${status} (Jobs: ${worker.jobs_processed || 0})`}
    >
      <span className="text-[9px] font-mono text-white/70">{(worker.id || '').replace('worker-', '')}</span>
    </div>
  );
}

function GaugeCircle({ value, label, color }: { value: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" className="transform -rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#374151" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="40" fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute mt-8 text-center">
        <p className="text-lg font-bold font-mono text-gray-200">{value.toFixed(1)}%</p>
      </div>
      <p className="text-[10px] text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'text-green-400',
    blue: 'text-blue-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  };

  return (
    <div className="bg-gray-700/30 rounded-lg p-2 text-center">
      <p className={`text-lg font-bold font-mono ${colorMap[color]}`}>{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}

function PoolCard({ icon, title, data, color }: { icon: React.ReactNode; title: string; data: any; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    green: 'text-green-400',
  };
  const barColor: Record<string, string> = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
  };

  const active = data?.active_connections || data?.active || 0;
  const idle = data?.idle_connections || data?.idle || 0;
  const total = data?.max_connections || data?.total || data?.max || 10;
  const used = active + idle;
  const pct = total > 0 ? (used / total) * 100 : 0;

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={colorMap[color]}>{icon}</span>
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Active</span>
          <span className="text-gray-300 font-mono">{active}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Idle</span>
          <span className="text-gray-300 font-mono">{idle}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Max</span>
          <span className="text-gray-300 font-mono">{total}</span>
        </div>
        <div className="pt-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Usage</span>
            <span className="text-gray-400">{pct.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all duration-500 ${barColor[color]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Alert Generation ---

interface Alert {
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

function generateAlerts(health: any, workerMetrics: any, backpressure: any, metrics: any): Alert[] {
  const alerts: Alert[] = [];

  if (health?.status === 'degraded') {
    alerts.push({ severity: 'warning', message: 'System health is degraded. Check individual health checks for details.' });
  }

  if (health?.issues && health.issues.length > 0) {
    health.issues.forEach((issue: string) => {
      alerts.push({ severity: 'warning', message: issue });
    });
  }

  if (backpressure?.active) {
    alerts.push({ severity: 'critical', message: `Backpressure active: ${backpressure.reason || 'High system load'}` });
  }

  if (workerMetrics?.unhealthy_workers > 0) {
    alerts.push({ severity: 'warning', message: `${workerMetrics.unhealthy_workers} unhealthy worker(s) detected` });
  }

  if ((workerMetrics?.queue_utilization || 0) > 80) {
    alerts.push({ severity: 'warning', message: `Queue utilization is high: ${workerMetrics.queue_utilization.toFixed(1)}%` });
  }

  const errorRate = parseFloat(metrics?.errors?.error_rate || '0');
  if (errorRate > 5) {
    alerts.push({ severity: 'critical', message: `High error rate: ${errorRate.toFixed(2)}%` });
  }

  return alerts;
}
