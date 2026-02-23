'use client';

import React, { useState, useEffect } from 'react';
import { webhookAPI } from '@/lib/api';

interface WebhookEndpoint {
  id: number;
  name: string;
  url: string;
  secret?: string;
  events: string;
  active: boolean;
  description: string;
  created_at: string;
}

interface WebhookDelivery {
  id: number;
  endpoint_id: number;
  event_type: string;
  status_code: number;
  success: boolean;
  latency_ms: number;
  attempt: number;
  error?: string;
  delivered_at: string;
}

interface EventDef {
  type: string;
  description: string;
}

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [availableEvents, setAvailableEvents] = useState<EventDef[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: '',
    url: '',
    secret: '',
    events: [] as string[],
    description: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [epRes, evtRes, statRes] = await Promise.all([
        webhookAPI.list(),
        webhookAPI.availableEvents(),
        webhookAPI.stats(),
      ]);
      if (epRes.data) setEndpoints(epRes.data.endpoints || []);
      if (evtRes.data) setAvailableEvents(evtRes.data.events || []);
      if (statRes.data) setStats(statRes.data);
    } catch (e) {
      console.error('Failed to fetch webhook data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await webhookAPI.create(form);
      setShowCreate(false);
      setForm({ name: '', url: '', secret: '', events: [], description: '' });
      fetchData();
    } catch (e) {
      alert('Failed to create webhook');
    }
  };

  const handleToggle = async (id: number, active: boolean) => {
    try {
      await webhookAPI.toggle(id, !active);
      fetchData();
    } catch (e) {
      alert('Failed to toggle webhook');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
      await webhookAPI.delete(id);
      fetchData();
    } catch (e) {
      alert('Failed to delete webhook');
    }
  };

  const viewDeliveries = async (endpointId: number) => {
    setSelectedEndpoint(endpointId);
    try {
      const res = await webhookAPI.deliveries(endpointId, 50);
      if (res.data) setDeliveries(res.data.deliveries || []);
    } catch (e) {
      console.error('Failed to fetch deliveries:', e);
    }
  };

  const toggleEvent = (eventType: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(eventType)
        ? prev.events.filter((e) => e !== eventType)
        : [...prev.events, eventType],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading webhooks...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🔗 Webhooks & Events</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
          >
            + Create Webhook
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Endpoints</p>
              <p className="text-2xl font-bold">{stats.total_endpoints || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.active_endpoints || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Deliveries</p>
              <p className="text-2xl font-bold">{stats.total_deliveries || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed_deliveries || 0}</p>
            </div>
          </div>
        )}

        {/* Endpoints List */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Webhook Endpoints</h2>
          </div>

          {endpoints.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No webhook endpoints configured. Create one to start receiving events!
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {endpoints.map((ep) => (
                <div key={ep.id} className="p-6 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{ep.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          ep.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {ep.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 font-mono">{ep.url}</p>
                    <div className="flex gap-2 mt-2">
                      {ep.events.split(',').map((evt) => (
                        <span
                          key={evt}
                          className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md"
                        >
                          {evt.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => viewDeliveries(ep.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Deliveries
                    </button>
                    <button
                      onClick={() => handleToggle(ep.id, ep.active)}
                      className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                    >
                      {ep.active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDelete(ep.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deliveries Panel */}
        {selectedEndpoint && (
          <div className="bg-white rounded-lg shadow-md mb-6">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Deliveries (Endpoint #{selectedEndpoint})
              </h2>
              <button
                onClick={() => setSelectedEndpoint(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            {deliveries.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No deliveries yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Latency</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attempt</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {deliveries.map((d) => (
                      <tr key={d.id}>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(d.delivered_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{d.event_type}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full font-medium ${
                              d.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {d.success ? `${d.status_code} OK` : `${d.status_code || 'ERR'} Failed`}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{d.latency_ms}ms</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{d.attempt}/3</td>
                        <td className="px-6 py-4 text-sm text-red-600 truncate max-w-[200px]">
                          {d.error || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Webhook Endpoint</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="My Webhook"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                  <input
                    type="url"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                    placeholder="https://example.com/webhook"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secret (optional, for HMAC-SHA256 signing)
                  </label>
                  <input
                    type="text"
                    value={form.secret}
                    onChange={(e) => setForm({ ...form, secret: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                    placeholder="whsec_..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Events ({form.events.length} selected)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-md p-3">
                    {availableEvents.map((evt) => (
                      <label
                        key={evt.type}
                        className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.events.includes(evt.type)}
                          onChange={() => toggleEvent(evt.type)}
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{evt.type}</p>
                          <p className="text-xs text-gray-500">{evt.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={2}
                    placeholder="What this webhook is for..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.name || !form.url || form.events.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Create Webhook
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
