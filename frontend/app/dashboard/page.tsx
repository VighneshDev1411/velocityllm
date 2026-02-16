'use client';

import { useState } from 'react';
import {
  Activity, Zap, Server, TrendingUp, AlertCircle, DollarSign,
  Clock, BarChart3, RefreshCw
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useDashboardOverview, useTimeSeries, useModelComparison, useCostBreakdown } from '@/hooks/useAnalytics';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('24h');

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useDashboardOverview();
  const { data: timeSeries, isLoading: tsLoading } = useTimeSeries(timeRange);
  const { data: modelData } = useModelComparison();
  const { data: costData } = useCostBreakdown();

  if (overviewLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (overviewError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Connection Error</h3>
          </div>
          <p className="text-red-700">Failed to fetch dashboard data. Make sure the backend is running.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const ov = overview?.overview || {};
  const latency = overview?.latency || {};
  const workers = overview?.workers || {};

  const formatNumber = (num: number) => {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCost = (cost: number) => {
    if (!cost && cost !== 0) return '$0.00';
    return `$${cost.toFixed(4)}`;
  };

  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const hasData = Number(ov.total_requests || 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* No data banner */}
      {!hasData && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-blue-800">
                <span className="font-medium">No requests yet.</span> Send prompts via the Playground or run{' '}
                <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs font-mono">./scripts/demo-load.sh --quick</code>{' '}
                to populate dashboards with real data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Real-time system monitoring & analytics</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${overview?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
                <span className="text-sm font-medium text-gray-600 capitalize">{overview?.status || 'unknown'}</span>
              </div>
              {/* Time range selector */}
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {['1h', '6h', '24h', '7d'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                      timeRange === range
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<Activity className="w-5 h-5" />}
            label="Total Requests"
            value={formatNumber(ov.total_requests || 0)}
            subtext={`${ov.requests_per_second || '0.00'} req/s`}
            color="blue"
          />
          <StatCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Total Cost"
            value={formatCost(ov.total_cost || 0)}
            subtext={`Avg ${formatCost(ov.avg_cost_per_request || 0)}/req`}
            color="green"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Avg Latency"
            value={`${latency.mean_ms || 0}ms`}
            subtext={`P99: ${latency.p99_ms || 0}ms`}
            color="purple"
          />
          <StatCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="Error Rate"
            value={`${(ov.error_rate || 0).toFixed(2)}%`}
            subtext={`${ov.total_errors || 0} total errors`}
            color={ov.error_rate > 5 ? 'red' : 'green'}
          />
        </div>

        {/* Charts Row 1: Request Volume + Latency */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Request Volume Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Request Volume
            </h3>
            <div className="h-64">
              {tsLoading ? (
                <div className="h-full flex items-center justify-center text-gray-400">Loading chart...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeries?.requests || []}>
                    <defs>
                      <linearGradient id="requestGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="time"
                      tickFormatter={formatTime}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      labelFormatter={(label) => new Date(label).toLocaleString()}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="requests"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#requestGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Latency Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Latency Distribution
            </h3>
            <div className="h-64">
              {tsLoading ? (
                <div className="h-full flex items-center justify-center text-gray-400">Loading chart...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeries?.latency || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="time"
                      tickFormatter={formatTime}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      unit="ms"
                    />
                    <Tooltip
                      labelFormatter={(label) => new Date(label).toLocaleString()}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Legend iconType="line" wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="p50_ms" name="P50" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="p90_ms" name="P90" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="p99_ms" name="P99" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Charts Row 2: Cost Breakdown + Model Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Cost Breakdown Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Cost by Provider
            </h3>
            <div className="h-64 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costData?.by_provider || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: $${value.toFixed(2)}`}
                  >
                    {(costData?.by_provider || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model Comparison Bar Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              Model Performance
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelData?.models || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="model"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="requests" name="Requests" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts Row 3: Cost Trend + Error Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Cost Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Cost Trend
            </h3>
            <div className="h-56">
              {tsLoading ? (
                <div className="h-full flex items-center justify-center text-gray-400">Loading chart...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeries?.cost || []}>
                    <defs>
                      <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="time"
                      tickFormatter={formatTime}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      labelFormatter={(label) => new Date(label).toLocaleString()}
                      formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cost"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#costGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Error Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              Error Trend
            </h3>
            <div className="h-56">
              {tsLoading ? (
                <div className="h-full flex items-center justify-center text-gray-400">Loading chart...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeSeries?.errors || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="time"
                      tickFormatter={formatTime}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      labelFormatter={(label) => new Date(label).toLocaleString()}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Bar dataKey="errors" name="Errors" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Workers + Latency Percentiles + Streams */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Worker Pool Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-600" />
              Worker Pool
            </h3>
            <div className="space-y-3">
              <MetricBar label="Idle" value={workers.idle || 0} max={workers.total || 10} color="green" />
              <MetricBar label="Busy" value={workers.busy || 0} max={workers.total || 10} color="blue" />
              <MetricBar label="Unhealthy" value={workers.unhealthy || 0} max={workers.total || 10} color="red" />
              <div className="pt-2 border-t">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Queue Utilization</span>
                  <span className="font-semibold text-gray-900">{(workers.utilization || 0).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-500">Queued Jobs</span>
                  <span className="font-semibold text-gray-900">{workers.queued_jobs || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Latency Percentiles */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Latency Percentiles
            </h3>
            <div className="space-y-3">
              <LatencyRow label="P50 (Median)" value={latency.p50_ms || 0} maxVal={latency.p99_ms || 100} color="green" />
              <LatencyRow label="P90" value={latency.p90_ms || 0} maxVal={latency.p99_ms || 100} color="yellow" />
              <LatencyRow label="P95" value={latency.p95_ms || 0} maxVal={latency.p99_ms || 100} color="orange" />
              <LatencyRow label="P99" value={latency.p99_ms || 0} maxVal={latency.p99_ms || 100} color="red" />
              <div className="pt-2 border-t">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Min / Max</span>
                  <span className="font-semibold text-gray-900">{latency.min_ms || 0}ms / {latency.max_ms || 0}ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Model Cost Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-600" />
              Cost by Model
            </h3>
            <div className="space-y-2">
              {(costData?.by_model || []).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-xs font-medium text-gray-700 truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">${item.value?.toFixed(4)}</span>
                </div>
              ))}
              {(costData?.by_model || []).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No cost data yet</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// --- Sub-components ---

function StatCard({ icon, label, value, subtext, color }: {
  icon: React.ReactNode; label: string; value: string | number;
  subtext: string; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorMap[color] || colorMap.blue}`}>{icon}</div>
      </div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{subtext}</p>
    </div>
  );
}

function MetricBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const colorMap: Record<string, string> = {
    green: 'bg-green-500', blue: 'bg-blue-500', red: 'bg-red-500', yellow: 'bg-yellow-500',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs font-bold text-gray-900">{value}/{max}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${colorMap[color] || 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function LatencyRow({ label, value, maxVal, color }: {
  label: string; value: number; maxVal: number; color: string;
}) {
  const pct = maxVal > 0 ? Math.min((value / maxVal) * 100, 100) : 0;
  const colorMap: Record<string, string> = {
    green: 'bg-green-500', yellow: 'bg-yellow-500', orange: 'bg-orange-500', red: 'bg-red-500',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs font-bold text-gray-900">{value}ms</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${colorMap[color] || 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
