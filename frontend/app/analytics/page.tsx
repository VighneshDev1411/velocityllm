'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '@/lib/api';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  BarChart3, Clock, DollarSign, AlertCircle, Zap, Timer,
  RefreshCw, Download, FileJson, ChevronLeft, ChevronRight,
  Check, Minus, Filter
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      const r = await analyticsAPI.getAnalyticsSummary();
      return r.data?.data;
    },
    refetchInterval: 10000,
  });
}

function useTimeSeries(period: string) {
  return useQuery({
    queryKey: ['analytics-timeseries', period],
    queryFn: async () => {
      const r = await analyticsAPI.getTimeSeries(period);
      return r.data?.data;
    },
    refetchInterval: 30000,
  });
}

function useRequestLog(params: { model?: string; status?: string; limit: number; offset: number }) {
  return useQuery({
    queryKey: ['analytics-request-log', params],
    queryFn: async () => {
      const r = await analyticsAPI.getRequestLog({
        model: params.model || undefined,
        status: params.status || undefined,
        limit: params.limit,
        offset: params.offset,
      });
      return r.data?.data;
    },
    refetchInterval: 15000,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHART_BLUE = '#3b82f6';
const CHART_GREEN = '#10b981';
const CHART_PURPLE = '#8b5cf6';
const CHART_YELLOW = '#f59e0b';
const CHART_RED = '#ef4444';

function formatNumber(num: number): string {
  if (num == null) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCost(cost: number): string {
  if (cost == null) return '$0.0000';
  return `$${cost.toFixed(4)}`;
}

function formatUptime(seconds: number): string {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function truncate(str: string, len: number): string {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('24h');
  const [logModel, setLogModel] = useState('');
  const [logStatus, setLogStatus] = useState('');
  const [logOffset, setLogOffset] = useState(0);
  const logLimit = 20;

  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } = useAnalyticsSummary();
  const { data: timeSeries, isLoading: tsLoading } = useTimeSeries(period);
  const { data: logData, isLoading: logLoading } = useRequestLog({
    model: logModel, status: logStatus, limit: logLimit, offset: logOffset,
  });

  // Derived
  const latency = summary?.latency || {};
  const throughput = summary?.throughput || {};
  const cost = summary?.cost || {};
  const errors = summary?.errors || {};
  const models: any[] = summary?.models || [];
  const requestLog: any[] = logData?.requests || [];
  const pagination = logData?.pagination || { limit: logLimit, offset: 0, total: 0 };

  // Model names for the filter dropdown
  const modelNames = models.map((m: any) => m.model_name || m.model).filter(Boolean);

  // CSV export
  const exportCSV = () => {
    const headers = ['Timestamp', 'Model', 'Provider', 'Prompt', 'Latency (ms)', 'Cost ($)', 'Tokens', 'Status', 'Cache Hit'];
    const rows = requestLog.map((r: any) => [
      r.timestamp, r.model, r.provider, `"${(r.prompt || '').replace(/"/g, '""')}"`,
      r.latency_ms, r.cost, r.tokens, r.status, r.cache_hit,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velocityllm-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON summary export
  const exportSummary = () => {
    const payload = { exported_at: new Date().toISOString(), period, summary, timeSeries };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velocityllm-summary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ------ Loading state ------
  if (summaryLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // ------ Error state ------
  if (summaryError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Connection Error</h3>
          </div>
          <p className="text-red-700">Failed to load analytics data. Make sure the backend is running.</p>
          <button
            onClick={() => refetchSummary()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
              <p className="text-sm text-gray-500 mt-1">
                Deep-dive into request patterns, latency, costs, and model performance
              </p>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {['1h', '6h', '24h', '7d'].map((r) => (
                <button
                  key={r}
                  onClick={() => setPeriod(r)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    period === r
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* KPI Summary Row                                                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard icon={<BarChart3 className="w-5 h-5" />} label="Total Requests"
            value={formatNumber(throughput.total_requests || 0)} color="blue" />
          <KPICard icon={<Clock className="w-5 h-5" />} label="Avg Latency"
            value={`${latency.mean_ms ?? 0}ms`} color="purple" />
          <KPICard icon={<DollarSign className="w-5 h-5" />} label="Total Cost"
            value={formatCost(cost.total_cost || 0)} color="green" />
          <KPICard icon={<AlertCircle className="w-5 h-5" />} label="Error Rate"
            value={`${errors.error_rate ?? 0}%`} color="red" />
          <KPICard icon={<Zap className="w-5 h-5" />} label="Throughput"
            value={`${throughput.requests_per_second ?? 0} req/s`} color="yellow" />
          <KPICard icon={<Timer className="w-5 h-5" />} label="Uptime"
            value={formatUptime(throughput.uptime_seconds || 0)} color="blue" />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Latency Analysis                                                 */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Latency Percentiles Time Series */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              Latency Percentiles Over Time
            </h3>
            <div className="h-64">
              {tsLoading ? (
                <ChartPlaceholder />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeries?.latency || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tickFormatter={formatTime}
                      tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="ms" />
                    <Tooltip labelFormatter={(l) => new Date(l as string).toLocaleString()}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                    <Legend iconType="line" wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="p50_ms" name="P50" stroke={CHART_GREEN} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="p90_ms" name="P90" stroke={CHART_YELLOW} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="p95_ms" name="P95" stroke={CHART_PURPLE} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="p99_ms" name="P99" stroke={CHART_RED} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Latency Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              Latency Distribution
            </h3>
            <div className="space-y-4">
              <PercentileBar label="P50 (Median)" value={latency.p50_ms || 0} max={latency.p99_ms || 100} color="bg-green-500" />
              <PercentileBar label="P90" value={latency.p90_ms || 0} max={latency.p99_ms || 100} color="bg-yellow-500" />
              <PercentileBar label="P95" value={latency.p95_ms || 0} max={latency.p99_ms || 100} color="bg-purple-500" />
              <PercentileBar label="P99" value={latency.p99_ms || 0} max={latency.p99_ms || 100} color="bg-red-500" />
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Min</p>
                <p className="text-sm font-bold text-gray-900">{latency.min_ms ?? 0}ms</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Mean</p>
                <p className="text-sm font-bold text-gray-900">{latency.mean_ms ?? 0}ms</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Max</p>
                <p className="text-sm font-bold text-gray-900">{latency.max_ms ?? 0}ms</p>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Throughput & Cost Analysis                                        */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request Throughput */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              Request Throughput
            </h3>
            <div className="h-64">
              {tsLoading ? (
                <ChartPlaceholder />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeries?.requests || []}>
                    <defs>
                      <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tickFormatter={formatTime}
                      tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip labelFormatter={(l) => new Date(l as string).toLocaleString()}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="requests" stroke={CHART_BLUE}
                      strokeWidth={2} fill="url(#throughputGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Cumulative Cost */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Cumulative Cost
            </h3>
            <div className="h-64">
              {tsLoading ? (
                <ChartPlaceholder />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeries?.cost || []}>
                    <defs>
                      <linearGradient id="costGradientAnalytics" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tickFormatter={formatTime}
                      tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `$${v}`} />
                    <Tooltip labelFormatter={(l) => new Date(l as string).toLocaleString()}
                      formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="cost" stroke={CHART_GREEN}
                      strokeWidth={2} fill="url(#costGradientAnalytics)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Model Comparison Table                                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Model Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Model</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Requests</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Success Rate</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Latency</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Cost</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Cost/Req</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Used</th>
                </tr>
              </thead>
              <tbody>
                {models.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-sm">No model data available</td></tr>
                )}
                {models.map((m: any, i: number) => {
                  const rate = parseFloat(m.success_rate || '0');
                  return (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 1 ? 'bg-gray-50' : ''} hover:bg-blue-50/30 transition`}>
                      <td className="py-3 px-4 font-medium text-gray-900">{m.model_name || m.model}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{formatNumber(m.request_count || m.requests || 0)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          rate >= 99 ? 'bg-green-100 text-green-700' :
                          rate >= 95 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {m.success_rate ?? `${rate.toFixed(1)}%`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">{m.avg_latency_ms ?? 0}ms</td>
                      <td className="py-3 px-4 text-right text-gray-700">{m.total_cost ?? '$0.0000'}</td>
                      <td className="py-3 px-4 text-right text-gray-700">{m.avg_cost_per_request ?? '$0.0000'}</td>
                      <td className="py-3 px-4 text-right text-gray-500 text-xs">
                        {m.last_used ? formatTimestamp(m.last_used) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Request History Table                                             */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              Request History
            </h3>
            <div className="flex items-center gap-3">
              <select
                value={logModel}
                onChange={(e) => { setLogModel(e.target.value); setLogOffset(0); }}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Models</option>
                {modelNames.map((n: string) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <select
                value={logStatus}
                onChange={(e) => { setLogStatus(e.target.value); setLogOffset(0); }}
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="cache_hit">Cache Hit</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Time</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Model</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Provider</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Prompt</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Latency</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Cost</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Cache</th>
                </tr>
              </thead>
              <tbody>
                {logLoading && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400 text-sm">Loading requests...</td></tr>
                )}
                {!logLoading && requestLog.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-400 text-sm">No requests found</td></tr>
                )}
                {!logLoading && requestLog.map((r: any, i: number) => (
                  <tr key={i} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''} hover:bg-blue-50/20 transition`}>
                    <td className="py-2 px-3 text-xs text-gray-600 whitespace-nowrap">
                      {r.timestamp ? formatTimestamp(r.timestamp) : '-'}
                    </td>
                    <td className="py-2 px-3 text-xs font-medium text-gray-900">{r.model || '-'}</td>
                    <td className="py-2 px-3">
                      <ProviderBadge provider={r.provider} />
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-600 max-w-[200px]" title={r.prompt}>
                      {truncate(r.prompt || '', 50)}
                    </td>
                    <td className="py-2 px-3 text-xs text-right text-gray-700">{r.latency_ms ?? '-'}ms</td>
                    <td className="py-2 px-3 text-xs text-right text-gray-700">{r.cost != null ? formatCost(r.cost) : '-'}</td>
                    <td className="py-2 px-3 text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-2 px-3 text-center">
                      {r.cache_hit
                        ? <Check className="w-4 h-4 text-green-500 mx-auto" />
                        : <Minus className="w-4 h-4 text-gray-300 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {pagination.total > 0 ? pagination.offset + 1 : 0}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLogOffset(Math.max(0, logOffset - logLimit))}
                disabled={logOffset === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-3 h-3" /> Previous
              </button>
              <button
                onClick={() => setLogOffset(logOffset + logLimit)}
                disabled={logOffset + logLimit >= pagination.total}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Export Section                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Export Analytics</h3>
          <p className="text-xs text-gray-500 mb-4">Download analytics data for offline analysis or reporting.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              <Download className="w-4 h-4" /> Export as CSV
            </button>
            <button
              onClick={exportSummary}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
            >
              <FileJson className="w-4 h-4" /> Export Summary
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KPICard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colorMap[color] || colorMap.blue}`}>{icon}</div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}

function PercentileBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span className="text-xs font-bold text-gray-900">{value}ms</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    cache_hit: 'bg-blue-100 text-blue-700',
    error: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status || 'unknown'}
    </span>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const map: Record<string, string> = {
    openai: 'bg-emerald-100 text-emerald-700',
    anthropic: 'bg-orange-100 text-orange-700',
    google: 'bg-blue-100 text-blue-700',
    cohere: 'bg-purple-100 text-purple-700',
    local: 'bg-gray-100 text-gray-600',
  };
  const cls = map[(provider || '').toLowerCase()] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {provider || '-'}
    </span>
  );
}

function ChartPlaceholder() {
  return (
    <div className="h-full flex items-center justify-center text-gray-400">
      <div className="text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mx-auto" />
        <p className="mt-2 text-xs">Loading chart...</p>
      </div>
    </div>
  );
}
