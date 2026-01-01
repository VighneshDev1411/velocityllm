'use client';

import { useState, useEffect } from 'react';
import { workerAPI, WorkerStats, WorkerMetrics } from '@/lib/api';
import { Server, Activity, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerStats[]>([]);
  const [metrics, setMetrics] = useState<WorkerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [statsRes, metricsRes] = await Promise.all([
        workerAPI.getStats(),
        workerAPI.getMetrics(),
      ]);

      setWorkers(statsRes.data.data.workers || []);
      setMetrics(metricsRes.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch worker data');
      console.error('Error fetching worker data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workers...</p>
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
            <h3 className="text-lg font-semibold text-red-900">Error</h3>
          </div>
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Worker Pool</h1>
            <p className="text-gray-500 mt-2">Monitor and manage worker instances</p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <SummaryCard
            icon={<Server className="w-6 h-6" />}
            label="Total Workers"
            value={metrics?.total_workers || 0}
            color="blue"
          />
          <SummaryCard
            icon={<Activity className="w-6 h-6" />}
            label="Busy Workers"
            value={metrics?.busy_workers || 0}
            color="orange"
          />
          <SummaryCard
            icon={<TrendingUp className="w-6 h-6" />}
            label="Idle Workers"
            value={metrics?.idle_workers || 0}
            color="green"
          />
          <SummaryCard
            icon={<AlertCircle className="w-6 h-6" />}
            label="Unhealthy"
            value={metrics?.unhealthy_workers || 0}
            color="red"
          />
        </div>

        {/* Worker Grid */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Active Workers</h2>
          </div>
          
          <div className="p-6">
            {workers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Server className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No workers available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workers.map((worker) => (
                  <WorkerCard key={worker.id} worker={worker} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Summary Card Component
function SummaryCard({ icon, label, value, color }: any) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className={`inline-flex p-3 rounded-lg mb-4 ${colorClasses[color as keyof typeof colorClasses]}`}>
        {icon}
      </div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// Worker Card Component
function WorkerCard({ worker }: { worker: WorkerStats }) {
  const getStatusColor = () => {
    switch (worker.status) {
      case 'idle':
        return 'status-idle';
      case 'busy':
        return 'status-busy';
      case 'unhealthy':
        return 'status-critical';
      default:
        return 'status-degraded';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 rounded-lg">
            <Server className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{worker.id}</p>
            <span className={`status-badge ${getStatusColor()}`}>
              {worker.status}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Jobs Processed</span>
          <span className="text-sm font-semibold text-gray-900">
            {worker.jobs_processed}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Jobs Failed</span>
          <span className="text-sm font-semibold text-red-600">
            {worker.jobs_failed}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Health Score</span>
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  worker.health_score >= 80 ? 'bg-green-500' :
                  worker.health_score >= 50 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${worker.health_score}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {worker.health_score.toFixed(0)}%
            </span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Uptime</span>
          <span className="text-sm font-semibold text-gray-900">
            {formatUptime(worker.uptime_seconds)}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Last Heartbeat</span>
          <span className="text-sm font-semibold text-gray-900">
            {formatDate(worker.last_heartbeat)}
          </span>
        </div>
      </div>

      {/* Current Job (if any) */}
      {(worker as any).current_job && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 mb-2">Current Job:</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-gray-900 truncate">
                {(worker as any).current_job.id}
              </p>
              <p className="text-xs text-gray-500">
                {((worker as any).current_job.duration / 1000).toFixed(1)}s
              </p>
            </div>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          </div>
        </div>
      )}
    </div>
  );
}