'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userManagementAPI } from '@/lib/api';
import { Navbar } from '@/components/Navbar';
import {
  Users, Shield, Search, Trash2, Edit2, UserPlus,
  Activity, ChevronDown, ChevronUp, X, Check,
  AlertTriangle, Crown, Code, Eye, User as UserIcon
} from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  active: boolean;
  created_at: string;
}

interface ActivityLogEntry {
  id: string;
  user_id: string;
  username: string;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
}

interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  admins: number;
  developers: number;
  viewers: number;
  regular_users: number;
  logins_last_24h: number;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  admin: { label: 'Admin', color: 'text-red-700', icon: Crown, bg: 'bg-red-50 border-red-200' },
  developer: { label: 'Developer', color: 'text-blue-700', icon: Code, bg: 'bg-blue-50 border-blue-200' },
  viewer: { label: 'Viewer', color: 'text-gray-700', icon: Eye, bg: 'bg-gray-50 border-gray-200' },
  user: { label: 'User', color: 'text-green-700', icon: UserIcon, bg: 'bg-green-50 border-green-200' },
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'activity' | 'teams'>('users');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, statsRes, logsRes] = await Promise.all([
        userManagementAPI.listUsers().catch(() => null),
        userManagementAPI.getUserStats().catch(() => null),
        userManagementAPI.getActivityLogs({ limit: 50 }).catch(() => null),
      ].map(p => p instanceof Promise ? p : Promise.resolve(p)));

      if (usersRes?.data?.data?.users) {
        setUsers(usersRes.data.data.users);
      }
      if (statsRes?.data?.data) {
        setStats(statsRes.data.data);
      }
      if (logsRes?.data?.data?.logs) {
        setActivityLogs(logsRes.data.data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setError('');
      await userManagementAPI.updateRole(userId, newRole);
      setSuccess(`Role updated to ${newRole}`);
      setEditingRole(null);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setError('');
      await userManagementAPI.deleteUser(userId);
      setSuccess('User deleted successfully');
      setConfirmDelete(null);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      await userManagementAPI.updateUser({ user_id: userId, active: !currentActive });
      setSuccess(`User ${currentActive ? 'deactivated' : 'activated'}`);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchData();
      return;
    }
    try {
      const res = await userManagementAPI.searchUsers(searchQuery);
      if (res.data?.data?.users) {
        setUsers(res.data.data.users);
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const filteredUsers = users;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete')) return 'text-red-600 bg-red-50';
    if (action.includes('role')) return 'text-purple-600 bg-purple-50';
    if (action.includes('login')) return 'text-green-600 bg-green-50';
    if (action.includes('create')) return 'text-blue-600 bg-blue-50';
    return 'text-gray-600 bg-gray-50';
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-700">Access Denied</h2>
          <p className="text-gray-500 mt-2">You must be logged in as an admin to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              User Management
            </h1>
            <p className="text-gray-500 mt-1">Manage users, roles, and permissions</p>
          </div>
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

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border p-4">
              <div className="text-sm text-gray-500">Total Users</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total_users}</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="text-sm text-gray-500">Active Users</div>
              <div className="text-2xl font-bold text-green-600">{stats.active_users}</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="text-sm text-gray-500">Admins</div>
              <div className="text-2xl font-bold text-red-600">{stats.admins}</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="text-sm text-gray-500">Logins (24h)</div>
              <div className="text-2xl font-bold text-blue-600">{stats.logins_last_24h}</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {[
            { key: 'users', label: 'Users', icon: Users },
            { key: 'activity', label: 'Activity Log', icon: Activity },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-xl border shadow-sm">
            {/* Search Bar */}
            <div className="p-4 border-b flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by email, username, or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
              >
                Search
              </button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Joined</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        Loading users...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const roleConfig = ROLE_CONFIG[u.role] || ROLE_CONFIG.user;
                      const RoleIcon = roleConfig.icon;
                      const isCurrentUser = currentUser?.email === u.email;

                      return (
                        <tr key={u.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                                {(u.first_name?.[0] || u.username[0]).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {u.first_name} {u.last_name}
                                  {isCurrentUser && (
                                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">You</span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">@{u.username} &middot; {u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {editingRole === u.id ? (
                              <div className="flex items-center gap-2">
                                <select
                                  defaultValue={u.role}
                                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                  className="text-sm border rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="user">User</option>
                                  <option value="developer">Developer</option>
                                  <option value="viewer">Viewer</option>
                                  <option value="admin">Admin</option>
                                </select>
                                <button onClick={() => setEditingRole(null)} className="text-gray-400 hover:text-gray-600">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${roleConfig.bg} ${roleConfig.color} cursor-pointer hover:opacity-80`}
                                onClick={() => !isCurrentUser && setEditingRole(u.id)}
                                title={isCurrentUser ? "Can't change own role" : 'Click to change role'}
                              >
                                <RoleIcon className="w-3 h-3" />
                                {roleConfig.label}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => !isCurrentUser && handleToggleActive(u.id, u.active)}
                              disabled={isCurrentUser}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                u.active
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              } ${!isCurrentUser ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                              title={isCurrentUser ? "Can't deactivate yourself" : 'Click to toggle'}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-green-500' : 'bg-red-500'}`} />
                              {u.active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {formatDate(u.created_at)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!isCurrentUser && (
                                <>
                                  {confirmDelete === u.id ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-red-600 mr-1">Delete?</span>
                                      <button
                                        onClick={() => handleDeleteUser(u.id)}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => setConfirmDelete(null)}
                                        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmDelete(u.id)}
                                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                      title="Delete user"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Role Legend */}
            <div className="px-6 py-3 border-t bg-gray-50 flex items-center gap-4 text-xs text-gray-500">
              <span className="font-medium">Roles:</span>
              {Object.entries(ROLE_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <span key={key} className={`flex items-center gap-1 ${config.color}`}>
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Activity Log Tab */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b">
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
              <p className="text-sm text-gray-500">Audit trail of user actions across the platform</p>
            </div>
            <div className="divide-y divide-gray-50">
              {activityLogs.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No activity logs yet</p>
                  <p className="text-sm mt-1">Actions like role changes and user updates will appear here</p>
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="px-6 py-3 flex items-center gap-4 hover:bg-gray-50 transition">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                      {log.action.replace(/_/g, ' ')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">@{log.username}</span>
                      {log.details && (
                        <span className="text-sm text-gray-500 ml-2">{log.details}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
