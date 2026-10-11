import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import api from '../api';

export default function AuthModal({ onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isPendingApproval, setIsPendingApproval] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsPendingApproval(false);

    if (mode === 'register' && password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const response = await api.post('/auth/login', { email, password });
        const { access_token, role, user_id } = response.data;
        localStorage.setItem('token', access_token);
        const userData = { id: user_id, email, role };
        localStorage.setItem('user', JSON.stringify(userData));
        onAuthSuccess(userData);
      } else {
        await api.post('/auth/register', { email, password });
        setSuccessMsg('Registration successful! Your analyst account is pending administrator approval before you can log in.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      if (err.response) {
        const status = err.response.status;
        const detail = err.response.data?.detail || '';

        if (status === 403 && detail.toLowerCase().includes('pending')) {
          setIsPendingApproval(true);
          setErrorMsg('Your analyst account is pending administrator approval.');
        } else {
          setErrorMsg(detail || 'Authentication failed. Please check your credentials.');
        }
      } else {
        setErrorMsg('Unable to connect to analytics server. Ensure the backend is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white text-center">
          <div className="inline-flex p-3 bg-indigo-500/20 rounded-xl mb-3 border border-indigo-400/30">
            <Lock className="w-6 h-6 text-indigo-300" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Retail Transaction Analytics</h2>
          <p className="text-xs text-slate-300 mt-1">Enterprise Analytics & Data Platform</p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              mode === 'login'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/40'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => {
              setMode('login');
              setErrorMsg('');
              setIsPendingApproval(false);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              mode === 'register'
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/40'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => {
              setMode('register');
              setErrorMsg('');
              setIsPendingApproval(false);
            }}
          >
            Register as Analyst
          </button>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {/* Explicit Pending Approval Banner */}
          {isPendingApproval && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">Access Restricted</h4>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  Your analyst account is pending administrator approval. Please contact your system administrator to approve access.
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {!isPendingApproval && errorMsg && (
            <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-6 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="analyst@retail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-lg text-sm transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Processing...' : mode === 'login' ? 'Sign In to Dashboard' : 'Create Analyst Account'}
            </button>
          </form>

          
        </div>
      </div>
    </div>
  );
}
