'use client';

import { useEffect, useState } from 'react';
import { workerAPI, streamAPI, WorkerMetrics, StreamMetrics } from '@/lib/api';
import { Activity, Zap, Server, TrendingUp, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const [workerMetrics, setWorkerMetrics] = useState<WorkerMetrics | null>(null);
  const [streamMetrics, setStreamMetrics] = useState<StreamMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all metrics
  const fetchMetrics = async () => {
    try {
      const [workerRes, streamRes] = await Promise.all([
        workerAPI.getMetrics(),
        streamAPI.getMetrics(),
      ]);

      setWorkerMetrics(workerRes.data.data);
      setStreamMetrics(streamRes.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch metrics');
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchMetrics, 5000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Connection Error</h3>
          </div>
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchMetrics}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">VelocityLLM Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Real-time system monitoring</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Live</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Workers */}
          <StatCard
            icon={<Server className="w-6 h-6" />}
            label="Total Workers"
            value={workerMetrics?.total_workers || 0}
            change={`${workerMetrics?.busy_workers || 0} busy`}
            color="blue"
          />

          {/* Jobs Processed */}
          <StatCard
            icon={<Activity className="w-6 h-6" />}
            label="Jobs Processed"
            value={formatNumber(workerMetrics?.total_jobs_processed || 0)}
            change={`${workerMetrics?.total_jobs_failed || 0} failed`}
            color="green"
          />

          {/* Active Streams */}
          <StatCard
            icon={<Zap className="w-6 h-6" />}
            label="Active Streams"
            value={streamMetrics?.active_streams || 0}
            change={`${streamMetrics?.total_streams || 0} total`}
            color="purple"
          />

          {/* Queue Utilization */}
          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            label="Queue Usage"
            value={`${(workerMetrics?.queue_utilization || 0).toFixed(1)}%`}
            change={`${workerMetrics?.queued_jobs || 0} queued`}
            color="orange"
          />
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Worker Pool Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Worker Pool Status</h2>
            <div className="space-y-4">
              <MetricRow
                label="Total Workers"
                value={workerMetrics?.total_workers || 0}
                max={50}
              />
              <MetricRow
                label="Idle Workers"
                value={workerMetrics?.idle_workers || 0}
                max={workerMetrics?.total_workers || 1}
                color="green"
              />
              <MetricRow
                label="Busy Workers"
                value={workerMetrics?.busy_workers || 0}
                max={workerMetrics?.total_workers || 1}
                color="blue"
              />
              <MetricRow
                label="Unhealthy"
                value={workerMetrics?.unhealthy_workers || 0}
                max={workerMetrics?.total_workers || 1}
                color="red"
              />
            </div>
          </div>

          {/* Stream Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Streaming Status</h2>
            <div className="space-y-4">
              <MetricRow
                label="Active Streams"
                value={streamMetrics?.active_streams || 0}
                max={100}
                color="purple"
              />
              <MetricRow
                label="Completed"
                value={streamMetrics?.completed_streams || 0}
                max={streamMetrics?.total_streams || 1}
                color="green"
              />
              <MetricRow
                label="Cancelled"
                value={streamMetrics?.cancelled_streams || 0}
                max={streamMetrics?.total_streams || 1}
                color="yellow"
              />
              <MetricRow
                label="Errored"
                value={streamMetrics?.errored_streams || 0}
                max={streamMetrics?.total_streams || 1}
                color="red"
              />
            </div>
          </div>
        </div>

        {/* Performance Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Avg Job Duration</p>
              <p className="text-2xl font-bold text-gray-900">
                {(workerMetrics?.avg_job_duration_ms || 0).toFixed(0)}ms
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Throughput</p>
              <p className="text-2xl font-bold text-gray-900">
                {(workerMetrics?.throughput_jobs_per_sec || 0).toFixed(2)} jobs/s
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Data Streamed</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatBytes(streamMetrics?.bytes_streamed || 0)}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon, label, value, change, color }: any) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 card-hover">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-gray-500">{change}</p>
    </div>
  );
}

// Metric Row Component
function MetricRow({ label, value, max, color = 'blue' }: any) {
  const percentage = (value / max) * 100;
  
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-900">{value}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${colorClasses[color as keyof typeof colorClasses]}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}