'use client';

import { useState, useEffect } from 'react';
import { streamAPI, StreamMetrics } from '@/lib/api';
import { Zap, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function StreamsPage() {
  const [metrics, setMetrics] = useState<StreamMetrics | null>(null);
  const [activeStreams, setActiveStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [metricsRes, activeRes] = await Promise.all([
        streamAPI.getMetrics(),
        streamAPI.getActiveStreams(),
      ]);

      setMetrics(metricsRes.data.data);
      setActiveStreams(activeRes.data.data || []);
    } catch (err) {
      console.error('Error fetching stream data:', err);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Stream Monitoring</h1>
          <p className="text-gray-500 mt-2">Real-time stream activity and metrics</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Activity className="w-6 h-6" />}
            label="Active Streams"
            value={metrics?.active_streams || 0}
            color="blue"
          />
          <StatCard
            icon={<CheckCircle className="w-6 h-6" />}
            label="Completed"
            value={metrics?.completed_streams || 0}
            color="green"
          />
          <StatCard
            icon={<XCircle className="w-6 h-6" />}
            label="Cancelled"
            value={metrics?.cancelled_streams || 0}
            color="yellow"
          />
          <StatCard
            icon={<Clock className="w-6 h-6" />}
            label="Errored"
            value={metrics?.errored_streams || 0}
            color="red"
          />
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-2">Avg Duration</p>
            <p className="text-3xl font-bold text-gray-900">
              {(metrics?.avg_duration_ms || 0).toFixed(0)}ms
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-2">Avg Chunks</p>
            <p className="text-3xl font-bold text-gray-900">
              {(metrics?.avg_chunks_per_stream || 0).toFixed(1)}
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-2">Data Streamed</p>
            <p className="text-3xl font-bold text-gray-900">
              {formatBytes(metrics?.bytes_streamed || 0)}
            </p>
          </div>
        </div>

        {/* Active Streams */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Active Streams</h2>
          </div>
          
          <div className="p-6">
            {activeStreams.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Zap className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No active streams</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeStreams.map((stream: any, index: number) => (
                  <div
                    key={stream.stream_id || index}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="animate-pulse h-3 w-3 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="font-mono text-sm text-gray-900">
                            {stream.stream_id || `Stream ${index + 1}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {stream.type || 'completion'}
                          </p>
                        </div>
                      </div>
                      <span className="status-badge status-busy">
                        Active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: any) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
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