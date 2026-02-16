'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '@/lib/api';
import {
  Settings as SettingsIcon, Server, Cpu, Route, Database, Shield,
  Gauge, Layers, AlertCircle, RefreshCw, CheckCircle, XCircle,
  Loader2, Clock, Zap, HardDrive, Activity, ChevronDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function maskKey(key: string): string {
  if (!key) return 'Not configured';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

function formatDuration(val: string | number): string {
  if (typeof val === 'number') return `${val}s`;
  return String(val || '-');
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const r = await settingsAPI.getSettings();
      return r.data?.data;
    },
    refetchInterval: 30000,
  });

  // Routing strategy mutation
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [strategyMsg, setStrategyMsg] = useState('');

  const strategyMutation = useMutation({
    mutationFn: (strategy: string) => settingsAPI.updateRoutingStrategy(strategy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setStrategyMsg('Strategy updated successfully!');
      setTimeout(() => setStrategyMsg(''), 3000);
    },
    onError: () => {
      setStrategyMsg('Failed to update strategy.');
      setTimeout(() => setStrategyMsg(''), 3000);
    },
  });

  // Provider test state
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const testProviderMutation = useMutation({
    mutationFn: (provider: string) => settingsAPI.testProvider(provider),
    onSuccess: (res, provider) => {
      setTestResults((prev) => ({ ...prev, [provider]: { ...res.data?.data, success: true } }));
      setTestingProvider(null);
    },
    onError: (err: any, provider) => {
      setTestResults((prev) => ({
        ...prev,
        [provider]: { success: false, error: err?.message || 'Connection failed' },
      }));
      setTestingProvider(null);
    },
  });

  const handleTestProvider = (provider: string) => {
    setTestingProvider(provider);
    setTestResults((prev) => ({ ...prev, [provider]: undefined }));
    testProviderMutation.mutate(provider);
  };

  // Set selected strategy from settings once loaded
  const currentStrategy = settings?.routing?.strategy || 'round-robin';
  const activeStrategy = selectedStrategy || currentStrategy;

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Connection Error</h3>
          </div>
          <p className="text-red-700">Failed to load settings. Make sure the backend is running.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const sys = settings?.system || {};
  const srv = settings?.server || {};
  const providers = settings?.providers || {};
  const routing = settings?.routing || {};
  const workerPool = settings?.worker_pool || {};
  const cache = settings?.cache || {};
  const rateLimiting = settings?.rate_limiting || {};
  const backpressure = settings?.backpressure || {};
  const database = settings?.database || {};
  const redis = settings?.redis || {};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <SettingsIcon className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-500 mt-0.5">System configuration and preferences</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* System Information                                               */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600" />
            System Information
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoItem label="App Name" value={sys.app_name || 'VelocityLLM'} />
            <InfoItem label="Version" value={sys.version || '-'} />
            <InfoItem label="Environment">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                sys.environment === 'production'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {sys.environment || 'development'}
              </span>
            </InfoItem>
            <InfoItem label="Log Level" value={sys.log_level || '-'} />
            <InfoItem label="Host" value={srv.host || '-'} />
            <InfoItem label="Port" value={srv.port || '-'} />
            <InfoItem label="Read Timeout" value={formatDuration(srv.read_timeout)} />
            <InfoItem label="Write Timeout" value={formatDuration(srv.write_timeout)} />
            <InfoItem label="Idle Timeout" value={formatDuration(srv.idle_timeout)} />
            <InfoItem label="Uptime" value={formatUptime(sys.uptime_seconds || 0)} />
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* LLM Providers                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-600" />
            LLM Providers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OpenAI */}
            <ProviderCard
              name="OpenAI"
              provider={providers.openai}
              providerKey="openai"
              testing={testingProvider === 'openai'}
              testResult={testResults.openai}
              onTest={() => handleTestProvider('openai')}
            />
            {/* Anthropic */}
            <ProviderCard
              name="Anthropic"
              provider={providers.anthropic}
              providerKey="anthropic"
              testing={testingProvider === 'anthropic'}
              testResult={testResults.anthropic}
              onTest={() => handleTestProvider('anthropic')}
            />
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Routing Configuration                                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Route className="w-4 h-4 text-indigo-600" />
            Routing Configuration
          </h2>
          <div className="flex items-center gap-3 mb-5">
            <label className="text-sm font-medium text-gray-700">Strategy</label>
            <div className="relative">
              <select
                value={activeStrategy}
                onChange={(e) => setSelectedStrategy(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {['round-robin', 'least-cost', 'least-latency', 'best-quality', 'smart'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button
              onClick={() => strategyMutation.mutate(activeStrategy)}
              disabled={strategyMutation.isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              {strategyMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Apply
            </button>
            {strategyMsg && (
              <span className={`text-sm font-medium ${strategyMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {strategyMsg}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <InfoItem label="Fallback Enabled" value={routing.fallback_enabled != null ? String(routing.fallback_enabled) : '-'} />
            <InfoItem label="Circuit Breaker" value={routing.circuit_breaker_enabled != null ? String(routing.circuit_breaker_enabled) : '-'} />
            <InfoItem label="Max Retries" value={routing.max_retries ?? '-'} />
            <InfoItem label="Retry Delay" value={formatDuration(routing.retry_delay)} />
            <InfoItem label="Health Check Interval" value={formatDuration(routing.health_check_interval)} />
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Worker Pool                                                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-600" />
            Worker Pool
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <InfoItem label="Min Workers" value={workerPool.min_workers ?? '-'} />
            <InfoItem label="Max Workers" value={workerPool.max_workers ?? '-'} />
            <InfoItem label="Queue Size" value={workerPool.queue_size ?? '-'} />
            <InfoItem label="Job Timeout" value={formatDuration(workerPool.job_timeout)} />
          </div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Scaling Thresholds</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
            <InfoItem label="Scale Up" value={`${workerPool.scale_up_threshold ?? 80}%`} />
            <InfoItem label="Scale Down" value={`${workerPool.scale_down_threshold ?? 20}%`} />
            <InfoItem label="Scale Interval" value={formatDuration(workerPool.scale_interval)} />
          </div>
          {workerPool.status && (
            <>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Current Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoItem label="Active Workers" value={workerPool.status?.active_workers ?? '-'} />
                <InfoItem label="Busy Workers" value={workerPool.status?.busy_workers ?? '-'} />
                <div>
                  <p className="text-xs text-gray-500 mb-1">Queue Utilization</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 max-w-[120px]">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          (workerPool.status?.queue_utilization ?? 0) > 80 ? 'bg-red-500' :
                          (workerPool.status?.queue_utilization ?? 0) > 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(workerPool.status?.queue_utilization ?? 0, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {workerPool.status?.queue_utilization ?? 0}%
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Cache Configuration                                              */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-600" />
            Cache Configuration
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-5">
            <InfoItem label="Default TTL" value={formatDuration(cache.default_ttl)} />
            <InfoItem label="L1 Max Size" value={cache.l1_max_size ?? '-'} />
            <InfoItem label="L1 Max Memory" value={cache.l1_max_memory || '-'} />
            <InfoItem label="L1 TTL" value={formatDuration(cache.l1_ttl)} />
            <InfoItem label="L2 TTL" value={formatDuration(cache.l2_ttl)} />
          </div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Features</h3>
          <div className="flex flex-wrap gap-2">
            <FeatureBadge label="Multi-Level Cache" enabled={cache.multi_level} />
            <FeatureBadge label="Semantic Cache" enabled={cache.semantic_cache} />
            <FeatureBadge label="Write-Through" enabled={cache.write_through} />
          </div>
          {cache.semantic_threshold != null && (
            <p className="mt-3 text-xs text-gray-500">
              Semantic threshold: <span className="font-semibold text-gray-700">{cache.semantic_threshold}</span>
            </p>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Rate Limiting                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-amber-600" />
            Rate Limiting
          </h2>
          <div className="grid grid-cols-2 gap-4 max-w-xs mb-5">
            <InfoItem label="Default RPM" value={rateLimiting.default_rpm ?? '-'} />
            <InfoItem label="Burst Size" value={rateLimiting.default_burst ?? '-'} />
          </div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tier Limits</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tier</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">RPM</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Burst</th>
                </tr>
              </thead>
              <tbody>
                {(rateLimiting.tiers || [
                  { name: 'Free', rpm: 10, burst: 5 },
                  { name: 'Basic', rpm: 60, burst: 20 },
                  { name: 'Premium', rpm: 300, burst: 50 },
                  { name: 'Enterprise', rpm: 1000, burst: 200 },
                  { name: 'VIP', rpm: 5000, burst: 500 },
                ]).map((tier: any, i: number) => (
                  <tr key={tier.name || i} className={`border-b border-gray-100 ${i % 2 === 1 ? 'bg-gray-50' : ''}`}>
                    <td className="py-2 px-4 font-medium text-gray-900">{tier.name}</td>
                    <td className="py-2 px-4 text-right text-gray-700">{tier.rpm?.toLocaleString()}</td>
                    <td className="py-2 px-4 text-right text-gray-700">{tier.burst?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Backpressure & Load Shedding                                     */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-600" />
            Backpressure & Load Shedding
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <InfoItem label="Queue Threshold" value={backpressure.queue_threshold ?? '-'} />
            <InfoItem label="Reject Low Priority" value={backpressure.reject_low_priority != null ? String(backpressure.reject_low_priority) : '-'} />
            <InfoItem label="Adaptive Threshold" value={backpressure.adaptive_threshold != null ? String(backpressure.adaptive_threshold) : '-'} />
            <InfoItem label="Status">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                backpressure.active ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
                {backpressure.active ? 'Active' : 'Inactive'}
              </span>
            </InfoItem>
          </div>
          {backpressure.load_shedding && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-600 mb-2">Load Shedding Tiers</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-gray-600">Warning: Shed low-priority traffic</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-gray-600">Critical: Shed medium-priority traffic</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  <span className="text-gray-600">Emergency: Only high-priority allowed</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Database & Redis                                                 */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              Database
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem label="Host" value={database.host || '-'} />
              <InfoItem label="Port" value={database.port ?? '-'} />
              <InfoItem label="Database" value={database.database || database.name || '-'} />
              <InfoItem label="SSL Mode" value={database.ssl_mode || '-'} />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-red-600" />
              Redis
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem label="Host" value={redis.host || '-'} />
              <InfoItem label="Port" value={redis.port ?? '-'} />
              <InfoItem label="DB Index" value={redis.db ?? '-'} />
              <InfoItem label="Pool Size" value={redis.pool_size ?? '-'} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoItem({ label, value, children }: {
  label: string;
  value?: string | number;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      {children || <p className="text-sm font-semibold text-gray-900">{String(value ?? '-')}</p>}
    </div>
  );
}

function FeatureBadge({ label, enabled }: { label: string; enabled?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
    }`}>
      {enabled
        ? <CheckCircle className="w-3 h-3" />
        : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

function ProviderCard({ name, provider, providerKey, testing, testResult, onTest }: {
  name: string;
  provider: any;
  providerKey: string;
  testing: boolean;
  testResult: any;
  onTest: () => void;
}) {
  const configured = !!provider?.api_key;
  const models: string[] = provider?.models || provider?.supported_models || [];

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${configured ? 'bg-green-500' : 'bg-red-400'}`} />
          <h3 className="text-sm font-semibold text-gray-900">{name}</h3>
        </div>
        <span className={`text-xs font-medium ${configured ? 'text-green-600' : 'text-red-500'}`}>
          {configured ? 'Configured' : 'Not Configured'}
        </span>
      </div>

      <div className="mb-3">
        <p className="text-xs text-gray-500 mb-0.5">API Key</p>
        <p className="text-sm font-mono text-gray-700">{maskKey(provider?.api_key)}</p>
      </div>

      {models.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1.5">Supported Models</p>
          <div className="flex flex-wrap gap-1.5">
            {models.map((m: string) => (
              <span key={m} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md text-[11px] font-medium">
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onTest}
        disabled={testing || !configured}
        className="mt-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
      >
        {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
        {testing ? 'Testing...' : 'Test Connection'}
      </button>

      {testResult && (
        <div className={`mt-3 p-3 rounded-lg text-xs ${
          testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-1.5 mb-1">
            {testResult.success
              ? <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              : <XCircle className="w-3.5 h-3.5 text-red-600" />}
            <span className={`font-semibold ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
              {testResult.success ? 'Connection Successful' : 'Connection Failed'}
            </span>
          </div>
          {testResult.success ? (
            <div className="space-y-0.5 text-gray-600 mt-1">
              {testResult.model && <p>Model: <span className="font-medium text-gray-800">{testResult.model}</span></p>}
              {testResult.latency != null && <p>Latency: <span className="font-medium text-gray-800">{testResult.latency}ms</span></p>}
              {testResult.status && <p>Status: <span className="font-medium text-gray-800">{testResult.status}</span></p>}
              {testResult.tokens != null && <p>Tokens: <span className="font-medium text-gray-800">{testResult.tokens}</span></p>}
              {testResult.response && (
                <p className="mt-1 text-gray-500 italic truncate" title={testResult.response}>
                  &quot;{testResult.response}&quot;
                </p>
              )}
            </div>
          ) : (
            <p className="text-red-600 mt-1">{testResult.error || 'Unknown error'}</p>
          )}
        </div>
      )}
    </div>
  );
}
