'use client';

import { useState } from 'react';
import { useContexts, useContextStats, useTokenCache } from '@/hooks/useTokens';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Activity, Database, Zap, TrendingUp } from 'lucide-react';

export default function TokensPage() {
  const { data: contextsData, isLoading: contextsLoading } = useContexts();
  const { data: statsData, isLoading: statsLoading } = useContextStats();
  const { data: cacheData, isLoading: cacheLoading } = useTokenCache();

  const stats = statsData?.data || {};
  const contexts = contextsData?.data?.contexts || [];
  const cache = cacheData?.data || {};

  if (contextsLoading || statsLoading || cacheLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Token Management</h1>
            <p className="text-sm text-gray-500 mt-1">
              Context windows, token counting, and budget allocation
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Database className="w-6 h-6" />}
            label="Total Contexts"
            value={stats.total_contexts || 0}
            sublabel={`${stats.active_contexts || 0} active`}
            color="blue"
          />

          <StatCard
            icon={<Activity className="w-6 h-6" />}
            label="Total Messages"
            value={formatNumber(stats.total_messages || 0)}
            sublabel={`${stats.messages_truncated || 0} truncated`}
            color="green"
          />

          <StatCard
            icon={<Zap className="w-6 h-6" />}
            label="Total Tokens"
            value={formatNumber(stats.total_tokens || 0)}
            sublabel="processed"
            color="purple"
          />

          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            label="Cache Size"
            value={cache.cache_size || 0}
            sublabel="entries"
            color="orange"
          />
        </div>

        {/* Context Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Context Statistics
            </h2>
            <div className="space-y-4">
              <MetricRow
                label="Contexts Created"
                value={stats.contexts_created || 0}
                color="blue"
              />
              <MetricRow
                label="Active Contexts"
                value={stats.active_contexts || 0}
                max={stats.contexts_created || 1}
                color="green"
              />
              <MetricRow
                label="Expired Contexts"
                value={stats.contexts_expired || 0}
                max={stats.contexts_created || 1}
                color="yellow"
              />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Token Processing
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Total Messages</span>
                  <span className="text-sm font-bold">
                    {formatNumber(stats.total_messages || 0)}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Messages Truncated</span>
                  <span className="text-sm font-bold">
                    {stats.messages_truncated || 0}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Total Tokens</span>
                  <span className="text-sm font-bold">
                    {formatNumber(stats.total_tokens || 0)}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Active Contexts */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Active Contexts
            </h2>
            <Badge variant="default">{contexts.length} contexts</Badge>
          </div>

          {contexts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Database className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No active contexts</p>
              <p className="text-sm mt-1">Create a context to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contexts.slice(0, 10).map((contextId: string) => (
                <div
                  key={contextId}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">{contextId}</p>
                      <p className="text-xs text-gray-500">Active context</p>
                    </div>
                  </div>
                  <Badge variant="default">Active</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, sublabel, color }: any) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`p-2 rounded-lg ${
            colorClasses[color as keyof typeof colorClasses]
          }`}
        >
          {icon}
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-gray-500">{sublabel}</p>
    </Card>
  );
}

function MetricRow({ label, value, max, color = 'blue' }: any) {
  const percentage = max ? (value / max) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-bold text-gray-900">{value}</span>
      </div>
      {max && <Progress value={percentage} className="h-2" />}
    </div>
  );
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
