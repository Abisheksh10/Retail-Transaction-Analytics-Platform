import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserCheck, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../api';

export default function AdminPortal({ onClose }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const fetchPending = async () => {
    setLoading(true);
    setStatusMessage('');
    try {
      const res = await api.get('/admin/pending-users');
      setPendingUsers(res.data);
    } catch (err) {
      console.error('Failed to load pending users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (userId, email) => {
    setActionLoading(userId);
    setStatusMessage('');
    try {
      await api.post('/admin/approve-user', { user_id: userId, approve: true });
      setStatusMessage(`Analyst ${email} successfully approved.`);
      await fetchPending();
    } catch (err) {
      console.error('Failed to approve user', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-400/30">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-base">Administrator Approval Portal</h3>
              <p className="text-xs text-slate-300">Authorize pending analyst registrations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {statusMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Pending Analysts ({pendingUsers.length})
            </span>
            <button
              onClick={fetchPending}
              disabled={loading}
              className="text-xs flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Loading pending analysts...</div>
          ) : pendingUsers.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
              <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">No analysts pending approval</p>
              <p className="text-xs text-slate-400 mt-1">All registered analysts have been authorized.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase">
                  <tr>
                    <th className="py-3 px-4">User ID</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono text-slate-500">#{u.id}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{u.email}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200 text-[10px]">
                          Pending Analyst
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleApprove(u.id, u.email)}
                          disabled={actionLoading === u.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition disabled:opacity-50 text-xs inline-flex items-center gap-1.5"
                        >
                          {actionLoading === u.id ? 'Approving...' : 'Approve Access'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            Close Portal
          </button>
        </div>
      </div>
    </div>
  );
}
