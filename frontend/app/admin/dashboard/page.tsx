'use client';

import React, { useState, useEffect } from 'react';
import { adminDashboardAPI } from '@/lib/api';

interface SystemHealth {
  status: string;
  uptime_seconds: number;
  uptime_human: string;
  go_version: string;
  goroutines: number;
  cpu_cores: number;
  memory: {
    alloc_mb: number;
    total_alloc_mb: number;
    sys_mb: number;
    gc_cycles: number;
  };
  database: {
    status: string;
    open_connections: number;
    in_use: number;
    idle: number;
    max_open: number;
  };
}

interface DashboardOverview {
  users: { total: number; active: number; tiers: { tier: string; count: number }[] };
  quotas: { over_limit_users: number; rate_limit_events_24h: number };
  webhooks: { total: number; active: number };
  load_tests: { total: number; running: number };
  api_keys: { total: number; active: number };
  recent_activity: any[];
}

interface TableStat {
  table: string;
  count: number;
}

export default function AdminDashboardPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [dbStats, setDbStats] = useState<TableStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    try {
      const [healthRes, overviewRes, dbRes] = await Promise.all([
        adminDashboardAPI.health(),
        adminDashboardAPI.overview(),
        adminDashboardAPI.databaseStats(),
      ]);
      if (healthRes.data) setHealth(healthRes.data);
      if (overviewRes.data) setOverview(overviewRes.data);
      if (dbRes.data) setDbStats(dbRes.data.tables || []);
    } catch (e) {
      console.error('Failed to fetch admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

        {/* System Health */}
        {health && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">System Health</h2>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  health.status === 'healthy'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {health.status.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Uptime</p>
                <p className="text-lg font-bold text-blue-900">{health.uptime_human}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Goroutines</p>
                <p className="text-lg font-bold text-green-900">{health.goroutines}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-purple-600 font-medium">Memory (Alloc)</p>
                <p className="text-lg font-bold text-purple-900">{health.memory.alloc_mb.toFixed(1)} MB</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-orange-600 font-medium">GC Cycles</p>
                <p className="text-lg font-bold text-orange-900">{health.memory.gc_cycles}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Go Version</p>
                <p className="font-semibold">{health.go_version}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">CPU Cores</p>
                <p className="font-semibold">{health.cpu_cores}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">System Memory</p>
                <p className="font-semibold">{health.memory.sys_mb.toFixed(1)} MB</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">DB Connections</p>
                <p className="font-semibold">
                  {health.database?.in_use || 0}/{health.database?.max_open || 0}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Overview Stats */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{overview.users.total}</p>
              <p className="text-sm text-gray-500">Total Users</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{overview.users.active}</p>
              <p className="text-sm text-gray-500">Active Users</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-purple-600">{overview.api_keys.active}</p>
              <p className="text-sm text-gray-500">Active API Keys</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-orange-600">{overview.webhooks.active}</p>
              <p className="text-sm text-gray-500">Active Webhooks</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{overview.quotas.over_limit_users}</p>
              <p className="text-sm text-gray-500">Over Limit</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-3xl font-bold text-yellow-600">{overview.quotas.rate_limit_events_24h}</p>
              <p className="text-sm text-gray-500">Rate Limits (24h)</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subscription Tiers */}
          {overview && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription Distribution</h2>
              {(overview.users.tiers || []).length === 0 ? (
                <p className="text-gray-500">No subscriptions yet.</p>
              ) : (
                <div className="space-y-3">
                  {overview.users.tiers.map((tier) => {
                    const total = overview.users.total || 1;
                    const pct = ((tier.count / total) * 100).toFixed(1);
                    const colors: Record<string, string> = {
                      free: 'bg-gray-400',
                      pro: 'bg-blue-500',
                      enterprise: 'bg-purple-500',
                    };
                    return (
                      <div key={tier.tier}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="capitalize font-medium">{tier.tier}</span>
                          <span className="text-gray-500">{tier.count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-full rounded-full ${colors[tier.tier] || 'bg-gray-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Database Table Stats */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Database Tables</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Table</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {dbStats.map((stat) => (
                    <tr key={stat.table} className="border-b border-gray-100">
                      <td className="py-2 text-sm font-mono text-gray-900">{stat.table}</td>
                      <td className="py-2 text-sm text-right font-semibold text-gray-900">
                        {stat.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {overview && overview.recent_activity && overview.recent_activity.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {overview.recent_activity.map((activity: any, index: number) => (
                <div key={index} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.action || activity.event_type}</p>
                    <p className="text-xs text-gray-500">
                      User #{activity.user_id} - {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
