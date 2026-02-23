'use client';

import React, { useState, useEffect } from 'react';
import { loadTestAPI } from '@/lib/api';

interface LoadTestConfig {
  id: number;
  name: string;
  pattern: string;
  target_rps: number;
  duration: number;
  concurrency: number;
  model: string;
  created_at: string;
}

interface LoadTestRun {
  id: number;
  config_id: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  actual_rps: number;
  config?: LoadTestConfig;
}

interface TestMetric {
  timestamp: string;
  elapsed_seconds: number;
  current_rps: number;
  completed_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  error_rate: number;
}

export default function LoadTestPage() {
  const [activeTab, setActiveTab] = useState<'quick' | 'configs' | 'runs'>('quick');
  const [configs, setConfigs] = useState<LoadTestConfig[]>([]);
  const [runs, setRuns] = useState<LoadTestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<LoadTestRun | null>(null);
  const [metrics, setMetrics] = useState<TestMetric[]>([]);
  const [loading, setLoading] = useState(false);

  // Quick benchmark form
  const [quickRPS, setQuickRPS] = useState(100);
  const [quickModel, setQuickModel] = useState('gpt-4');

  // Create config form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newConfig, setNewConfig] = useState({
    name: '',
    pattern: 'constant',
    target_rps: 100,
    duration: 60,
    concurrency: 50,
    model: 'gpt-4',
    prompt: 'Hello, this is a load test. Please respond briefly.',
    max_tokens: 50,
    enable_cache: true,
  });

  useEffect(() => {
    fetchConfigs();
    fetchRuns();
  }, []);

  useEffect(() => {
    if (selectedRun && selectedRun.status === 'running') {
      const interval = setInterval(() => {
        fetchRunDetails(selectedRun.id);
        fetchMetrics(selectedRun.id);
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [selectedRun]);

  const fetchConfigs = async () => {
    try {
      const response = await loadTestAPI.listConfigs(50);
      if (response.data) {
        setConfigs(response.data.configs || []);
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    }
  };

  const fetchRuns = async () => {
    try {
      const response = await loadTestAPI.listRuns(20);
      if (response.data) {
        setRuns(response.data.runs || []);
      }
    } catch (error) {
      console.error('Failed to fetch runs:', error);
    }
  };

  const fetchRunDetails = async (runId: number) => {
    try {
      const response = await loadTestAPI.getRun(runId);
      if (response.data) {
        setSelectedRun(response.data.run);
      }
    } catch (error) {
      console.error('Failed to fetch run details:', error);
    }
  };

  const fetchMetrics = async (runId: number) => {
    try {
      const response = await loadTestAPI.getMetrics(runId);
      if (response.data) {
        setMetrics(response.data.metrics || []);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const handleQuickBenchmark = async () => {
    try {
      setLoading(true);
      const response = await loadTestAPI.quickBenchmark(quickRPS, quickModel);
      if (response.data) {
        alert('Quick benchmark started!');
        setSelectedRun(response.data.run);
        setActiveTab('runs');
        fetchRuns();
      }
    } catch (error) {
      console.error('Failed to start quick benchmark:', error);
      alert('Failed to start benchmark');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConfig = async () => {
    try {
      setLoading(true);
      await loadTestAPI.createConfig(newConfig);
      alert('Load test configuration created!');
      setShowCreateModal(false);
      fetchConfigs();
      setNewConfig({
        name: '',
        pattern: 'constant',
        target_rps: 100,
        duration: 60,
        concurrency: 50,
        model: 'gpt-4',
        prompt: 'Hello, this is a load test. Please respond briefly.',
        max_tokens: 50,
        enable_cache: true,
      });
    } catch (error) {
      console.error('Failed to create config:', error);
      alert('Failed to create configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = async (configId: number) => {
    try {
      setLoading(true);
      const response = await loadTestAPI.startTest(configId);
      if (response.data) {
        alert('Load test started!');
        setSelectedRun(response.data.run);
        setActiveTab('runs');
        fetchRuns();
      }
    } catch (error) {
      console.error('Failed to start test:', error);
      alert('Failed to start load test');
    } finally {
      setLoading(false);
    }
  };

  const handleStopTest = async (runId: number) => {
    try {
      await loadTestAPI.stopTest(runId);
      alert('Load test stopped!');
      fetchRuns();
    } catch (error) {
      console.error('Failed to stop test:', error);
      alert('Failed to stop load test');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      queued: 'bg-gray-100 text-gray-800',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">⚡ Load Testing & Benchmarks</h1>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('quick')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'quick'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🚀 Quick Benchmark
          </button>
          <button
            onClick={() => setActiveTab('configs')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'configs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚙️ Configurations ({configs.length})
          </button>
          <button
            onClick={() => setActiveTab('runs')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'runs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Test Runs ({runs.length})
          </button>
        </div>

        {/* Quick Benchmark Tab */}
        {activeTab === 'quick' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick 30-Second Benchmark</h2>
            <p className="text-gray-600 mb-6">
              Run a fast benchmark to test your system's performance under constant load.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target RPS (Requests Per Second)
                </label>
                <input
                  type="number"
                  value={quickRPS}
                  onChange={(e) => setQuickRPS(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  min="1"
                  max="10000"
                />
                <p className="text-xs text-gray-500 mt-1">Recommended: 100-500 for initial tests</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                <select
                  value={quickModel}
                  onChange={(e) => setQuickModel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                >
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="claude-3-opus">Claude 3 Opus</option>
                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleQuickBenchmark}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Starting...' : '🚀 Start Quick Benchmark'}
            </button>

            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">📝 What gets tested:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Duration: 30 seconds</li>
                <li>• Pattern: Constant load</li>
                <li>• Concurrency: 50 workers</li>
                <li>• Metrics: Latency (P50/P95/P99), RPS, Error Rate</li>
              </ul>
            </div>
          </div>
        )}

        {/* Configurations Tab */}
        {activeTab === 'configs' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Load Test Configurations</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
              >
                + Create Configuration
              </button>
            </div>

            {configs.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-500">No configurations yet. Create one to get started!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {configs.map((config) => (
                  <div key={config.id} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
                        <p className="text-sm text-gray-500">
                          Created {new Date(config.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full capitalize">
                        {config.pattern}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-500">Target RPS</p>
                        <p className="font-semibold text-gray-900">{config.target_rps}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Duration</p>
                        <p className="font-semibold text-gray-900">{config.duration}s</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Concurrency</p>
                        <p className="font-semibold text-gray-900">{config.concurrency}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Model</p>
                        <p className="font-semibold text-gray-900 truncate">{config.model}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartTest(config.id)}
                      disabled={loading}
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
                    >
                      ▶ Start Test
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Test Runs Tab */}
        {activeTab === 'runs' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Test Runs</h2>

            {runs.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <p className="text-gray-500">No test runs yet. Start a benchmark to see results!</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Config</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Latency</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">P95</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">RPS</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {runs.map((run) => (
                      <tr key={run.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{run.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {run.config?.name || `Config #${run.config_id}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusBadge(run.status)}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {run.total_requests.toLocaleString()}
                          <span className="text-gray-500 ml-1">
                            ({run.failed_requests > 0 ? `${run.failed_requests} failed` : 'all ok'})
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {run.avg_latency_ms?.toFixed(2) || 'N/A'} ms
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {run.p95_latency_ms?.toFixed(2) || 'N/A'} ms
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {run.actual_rps?.toFixed(2) || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {run.status === 'running' ? (
                            <button
                              onClick={() => handleStopTest(run.id)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Stop
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedRun(run);
                                fetchMetrics(run.id);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View Details
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Selected Run Details */}
            {selectedRun && (
              <div className="bg-white rounded-lg shadow-md p-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Test Run #{selectedRun.id} Details
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-blue-600 text-sm font-medium mb-1">Total Requests</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {selectedRun.total_requests.toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-green-600 text-sm font-medium mb-1">Success Rate</p>
                    <p className="text-2xl font-bold text-green-900">
                      {((selectedRun.successful_requests / selectedRun.total_requests) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-purple-600 text-sm font-medium mb-1">Avg Latency</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {selectedRun.avg_latency_ms?.toFixed(2)} ms
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-orange-600 text-sm font-medium mb-1">Actual RPS</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {selectedRun.actual_rps?.toFixed(2)}
                    </p>
                  </div>
                </div>

                {metrics.length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium text-gray-900 mb-4">Real-Time Metrics</h4>
                    <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      {metrics.map((metric, index) => (
                        <div key={index} className="border-b border-gray-200 py-2 last:border-0">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              T+{metric.elapsed_seconds}s
                            </span>
                            <span className="font-medium">
                              RPS: {metric.current_rps.toFixed(2)} | Latency: {metric.avg_latency_ms.toFixed(2)}ms |
                              Errors: {metric.error_rate.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Create Config Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Load Test Configuration</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newConfig.name}
                    onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="My Load Test"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pattern</label>
                    <select
                      value={newConfig.pattern}
                      onChange={(e) => setNewConfig({ ...newConfig, pattern: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="constant">Constant</option>
                      <option value="rampup">Ramp Up</option>
                      <option value="spike">Spike</option>
                      <option value="wave">Wave</option>
                      <option value="burst">Burst</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                    <select
                      value={newConfig.model}
                      onChange={(e) => setNewConfig({ ...newConfig, model: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="claude-3-opus">Claude 3 Opus</option>
                      <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target RPS</label>
                    <input
                      type="number"
                      value={newConfig.target_rps}
                      onChange={(e) => setNewConfig({ ...newConfig, target_rps: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration (s)</label>
                    <input
                      type="number"
                      value={newConfig.duration}
                      onChange={(e) => setNewConfig({ ...newConfig, duration: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Concurrency</label>
                    <input
                      type="number"
                      value={newConfig.concurrency}
                      onChange={(e) => setNewConfig({ ...newConfig, concurrency: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Test Prompt</label>
                  <textarea
                    value={newConfig.prompt}
                    onChange={(e) => setNewConfig({ ...newConfig, prompt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={3}
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newConfig.enable_cache}
                    onChange={(e) => setNewConfig({ ...newConfig, enable_cache: e.target.checked })}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">Enable caching</label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateConfig}
                  disabled={loading || !newConfig.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Configuration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
