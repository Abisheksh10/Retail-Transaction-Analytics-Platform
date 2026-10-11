import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  UserCheck,
  Users,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  UserX,
  Shield,
  Check,
  X,
  Power,
  RotateCcw,
} from 'lucide-react';
import api from '../api';

export default function UserApprovalsView({ currentUser }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [pendingRes, allRes] = await Promise.all([
        api.get('/admin/pending-users'),
        api.get('/admin/users'),
      ]);
      setPendingUsers(pendingRes.data);
      setAllUsers(allRes.data);
    } catch (err) {
      console.error('Failed to load users management data', err);
      setErrorMessage(err.response?.data?.detail || 'Failed to fetch user directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApproveDecline = async (userId, email, approve) => {
    const actionKey = `${approve ? 'approve' : 'decline'}-${userId}`;
    setActionLoading(actionKey);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const res = await api.post('/admin/approve-user', { user_id: userId, approve });
      setStatusMessage(res.data?.message || `Analyst account for ${email} has been ${approve ? 'approved' : 'declined'}.`);
      await fetchUsers();
    } catch (err) {
      console.error(`Failed to ${approve ? 'approve' : 'decline'} user`, err);
      setErrorMessage(err.response?.data?.detail || `Failed to ${approve ? 'approve' : 'decline'} user.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (userId, email, newActiveState) => {
    const actionKey = `toggle-${userId}`;
    setActionLoading(actionKey);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const res = await api.post('/admin/toggle-user-status', { user_id: userId, is_active: newActiveState });
      setStatusMessage(res.data?.message || `Account for ${email} has been ${newActiveState ? 'reactivated' : 'deactivated'}.`);
      await fetchUsers();
    } catch (err) {
      console.error(`Failed to toggle user status`, err);
      setErrorMessage(err.response?.data?.detail || `Failed to update user status.`);
    } finally {
      setActionLoading(null);
    }
  };

  const isSelf = (targetUser) => {
    if (!currentUser) return false;
    if (currentUser.id && targetUser.id === currentUser.id) return true;
    if (currentUser.email && targetUser.email.toLowerCase() === currentUser.email.toLowerCase()) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">User Approvals & Role Governance</h2>
        <p className="text-xs text-slate-500 mt-1">
          Review analyst access requests, configure authorization, and manage account lifecycles
        </p>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{statusMessage}</span>
          </div>
          <button
            onClick={() => setStatusMessage('')}
            className="text-emerald-600 hover:text-emerald-800 text-xs"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-rose-600 hover:text-rose-800 text-xs"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Section 1: Pending Approvals */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Pending Analyst Registrations ({pendingUsers.length})
            </h3>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-xs">Loading pending accounts...</div>
        ) : pendingUsers.length === 0 ? (
          <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">All registered analysts are authorized</p>
            <p className="text-[11px] text-slate-400 mt-0.5">No pending approval requests in the queue.</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingUsers.map((u) => {
                  const isApproving = actionLoading === `approve-${u.id}`;
                  const isDeclining = actionLoading === `decline-${u.id}`;
                  const isBusy = !!actionLoading;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-500">#{u.id}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200 text-[10px]">
                          Pending Analyst
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleApproveDecline(u.id, u.email, true)}
                            disabled={isBusy}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs transition disabled:opacity-50 inline-flex items-center gap-1 shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {isApproving ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleApproveDecline(u.id, u.email, false)}
                            disabled={isBusy}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium rounded-lg text-xs transition disabled:opacity-50 inline-flex items-center gap-1 shadow-sm"
                          >
                            <X className="w-3.5 h-3.5" />
                            {isDeclining ? 'Declining...' : 'Decline'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: User Directory & Management */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Platform Accounts Directory ({allUsers.length})</h3>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">User ID</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-center">Approval Status</th>
                <th className="py-3 px-4 text-center">Account State</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allUsers.map((u) => {
                const selfAccount = isSelf(u);
                const isToggling = actionLoading === `toggle-${u.id}`;
                const isBusy = !!actionLoading;

                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-500">#{u.id}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>{u.email}</span>
                        {selfAccount && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold uppercase tracking-wider">
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          u.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          u.is_approved
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {u.is_approved ? 'Approved' : 'Pending Approval'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold text-[10px] inline-flex items-center gap-1 ${
                          u.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {selfAccount ? (
                        <button
                          disabled
                          title="Administrators cannot deactivate their own account"
                          className="px-3 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 font-medium rounded-lg text-xs cursor-not-allowed inline-flex items-center gap-1 opacity-60"
                        >
                          <Power className="w-3.5 h-3.5" />
                          Deactivate
                        </button>
                      ) : u.is_active ? (
                        <button
                          onClick={() => handleToggleStatus(u.id, u.email, false)}
                          disabled={isBusy}
                          title="Deactivate this user account"
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium rounded-lg text-xs transition disabled:opacity-50 inline-flex items-center gap-1 shadow-sm"
                        >
                          <Power className="w-3.5 h-3.5" />
                          {isToggling ? 'Deactivating...' : 'Deactivate'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(u.id, u.email, true)}
                          disabled={isBusy}
                          title="Reactivate this user account"
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium rounded-lg text-xs transition disabled:opacity-50 inline-flex items-center gap-1 shadow-sm"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {isToggling ? 'Reactivating...' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
