'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiKeyAPI } from '@/lib/api';
import {
  Key, Plus, Copy, Check, X, Trash2, RefreshCw,
  Shield, Clock, Activity, AlertTriangle, Eye, EyeOff, Ban
} from 'lucide-react';

interface APIKeyData {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string;
  rate_limit: number;
  active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  total_calls: number;
  total_tokens: number;
  created_at: string;
}

export default function APIKeysPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<APIKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: string; keyId: string } | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    name: '',
    scopes: 'read,write',
    rate_limit: 60,
    expires_in_days: 0,
  });
  const [creating, setCreating] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiKeyAPI.list();
      if (res.data?.data?.keys) {
        setKeys(res.data.data.keys);
      }
    } catch (err) {
      console.error('Failed to fetch keys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await apiKeyAPI.create({
        name: createForm.name,
        scopes: createForm.scopes,
        rate_limit: createForm.rate_limit,
        expires_in_days: createForm.expires_in_days,
      });
      const fullKey = res.data?.data?.api_key;
      if (fullKey) {
        setNewKeyRevealed(fullKey);
      }
      setShowCreateModal(false);
      setCreateForm({ name: '', scopes: 'read,write', rate_limit: 60, expires_in_days: 0 });
      setSuccess('API key created successfully');
      fetchKeys();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await apiKeyAPI.revoke(keyId);
      setSuccess('API key revoked');
      setConfirmAction(null);
      fetchKeys();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke key');
    }
  };

  const handleRotate = async (keyId: string) => {
    try {
      const res = await apiKeyAPI.rotate(keyId);
      const fullKey = res.data?.data?.api_key;
      if (fullKey) {
        setNewKeyRevealed(fullKey);
      }
      setConfirmAction(null);
      setSuccess('API key rotated — old key is now revoked');
      fetchKeys();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to rotate key');
    }
  };

  const handleDelete = async (keyId: string) => {
    try {
      await apiKeyAPI.delete(keyId);
      setSuccess('API key deleted');
      setConfirmAction(null);
      fetchKeys();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const activeKeys = keys.filter(k => k.active && !isExpired(k.expires_at));
  const inactiveKeys = keys.filter(k => !k.active || isExpired(k.expires_at));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Key className="w-8 h-8 text-blue-600" />
              API Keys
            </h1>
            <p className="text-gray-500 mt-1">Manage programmatic access to VelocityLLM</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Key
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* New Key Reveal Banner */}
        {newKeyRevealed && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-amber-800">Save your API key now</p>
                <p className="text-sm text-amber-700 mt-1">This key will only be shown once. Copy it and store it securely.</p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 bg-white border border-amber-300 px-4 py-2.5 rounded-lg font-mono text-sm text-gray-900 select-all">
                    {newKeyRevealed}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newKeyRevealed)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      copiedKey
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    }`}
                  >
                    {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button onClick={() => setNewKeyRevealed(null)} className="text-amber-500 hover:text-amber-700">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Usage hint */}
        <div className="mb-6 p-4 bg-gray-100 border rounded-xl">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-800">Usage:</span> Include your API key in the <code className="bg-white px-1.5 py-0.5 rounded text-xs border">Authorization</code> header:
          </p>
          <code className="block mt-2 bg-white border px-3 py-2 rounded-lg text-xs font-mono text-gray-700">
            curl -H &quot;Authorization: Bearer vlm_your_key_here&quot; http://localhost:8080/api/v1/completions
          </code>
        </div>

        {/* Active Keys */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Active Keys ({activeKeys.length})
          </h2>
          {loading ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Loading...</div>
          ) : activeKeys.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <Key className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No active API keys</p>
              <p className="text-sm text-gray-400 mt-1">Create a key to get started with programmatic access</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeKeys.map((k) => (
                <div key={k.id} className="bg-white rounded-xl border p-4 hover:shadow-sm transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Key className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{k.name}</div>
                        <div className="text-sm text-gray-500 font-mono">{k.key_prefix}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Rotate */}
                      {confirmAction?.type === 'rotate' && confirmAction.keyId === k.id ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-amber-600">Rotate?</span>
                          <button onClick={() => handleRotate(k.id)} className="p-1 text-amber-600 hover:bg-amber-50 rounded">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setConfirmAction(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmAction({ type: 'rotate', keyId: k.id })}
                          className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="Rotate key"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      {/* Revoke */}
                      {confirmAction?.type === 'revoke' && confirmAction.keyId === k.id ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-red-600">Revoke?</span>
                          <button onClick={() => handleRevoke(k.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setConfirmAction(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmAction({ type: 'revoke', keyId: k.id })}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Revoke key"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Key metadata */}
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Scopes: {k.scopes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {k.rate_limit} req/min
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {k.total_calls.toLocaleString()} calls
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last used: {formatDate(k.last_used_at)}
                    </span>
                    {k.expires_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires: {formatDate(k.expires_at)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revoked / Expired Keys */}
        {inactiveKeys.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Revoked / Expired ({inactiveKeys.length})
            </h2>
            <div className="space-y-3">
              {inactiveKeys.map((k) => (
                <div key={k.id} className="bg-white rounded-xl border border-gray-200 p-4 opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Key className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-500 line-through">{k.name}</div>
                        <div className="text-sm text-gray-400 font-mono">{k.key_prefix}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isExpired(k.expires_at) ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {isExpired(k.expires_at) ? 'Expired' : 'Revoked'}
                      </span>
                      {confirmAction?.type === 'delete' && confirmAction.keyId === k.id ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-red-600">Delete?</span>
                          <button onClick={() => handleDelete(k.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setConfirmAction(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmAction({ type: 'delete', keyId: k.id })}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-gray-400">
                    <span>{k.total_calls.toLocaleString()} total calls</span>
                    <span>Created {formatDate(k.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                Create API Key
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Key Name *</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Production Backend, CI/CD Pipeline"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scopes</label>
                <select
                  value={createForm.scopes}
                  onChange={(e) => setCreateForm({ ...createForm, scopes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="read">Read only</option>
                  <option value="read,write">Read & Write</option>
                  <option value="read,write,admin">Full Access (Admin)</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Controls what this key can do</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate Limit (req/min)</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={createForm.rate_limit}
                  onChange={(e) => setCreateForm({ ...createForm, rate_limit: parseInt(e.target.value) || 60 })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiration</label>
                <select
                  value={createForm.expires_in_days}
                  onChange={(e) => setCreateForm({ ...createForm, expires_in_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={0}>Never expires</option>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
