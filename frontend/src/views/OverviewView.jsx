import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  Filter,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import api from '../api';

export default function OverviewView() {
  const [kpis, setKpis] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState('all');
  const [loading, setLoading] = useState(false);
  const [monthlyTrends, setMonthlyTrends] = useState([]);

  const fetchKPIs = async (start = startDate, end = endDate) => {
    setLoading(true);
    try {
      const params = {};
      if (start) params.start_date = start;
      if (end) params.end_date = end;
      const res = await api.get('/analytics/kpis', { params });
      setKpis(res.data);
    } catch (err) {
      console.error('Failed to load KPIs', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrends = async () => {
    try {
      const res = await api.get('/analytics/monthly-trends');
      setMonthlyTrends(res.data);
    } catch (err) {
      console.error('Failed to load monthly trends', err);
    }
  };

  useEffect(() => {
    fetchKPIs();
    fetchTrends();
  }, []);

  const handleApplyCustomFilter = (e) => {
    e.preventDefault();
    setActivePreset('custom');
    fetchKPIs(startDate, endDate);
  };

  const applyPreset = (presetKey, start, end) => {
    setActivePreset(presetKey);
    setStartDate(start);
    setEndDate(end);
    fetchKPIs(start, end);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Overview & Executive KPIs</h2>
        <p className="text-xs text-slate-500 mt-1">High-level sales health and revenue trend monitor</p>
      </div>

      {/* Date Range & Preset Filter Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Timeline Presets</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => applyPreset('all', '', '')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activePreset === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => applyPreset('y1', '2009-12-01', '2010-12-09')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activePreset === 'y1'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Year 1 (2009-2010)
            </button>
            <button
              onClick={() => applyPreset('y2', '2010-12-01', '2011-12-09')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activePreset === 'y2'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Year 2 (2010-2011)
            </button>
            <button
              onClick={() => applyPreset('q4_2010', '2010-10-01', '2010-12-31')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activePreset === 'q4_2010'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Q4 Holiday Season
            </button>
          </div>
        </div>

        <form onSubmit={handleApplyCustomFilter} className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <span className="font-semibold text-slate-600 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" /> Custom Date Range:
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-1.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Calculating...' : 'Apply Window'}
          </button>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => applyPreset('all', '', '')}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-800 px-2 py-1.5 transition"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </form>
      </div>

      {/* 4 Primary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Revenue</span>
            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {kpis ? `$${kpis.total_revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...'}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium inline-flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> Net Delivered Sales
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Volume Sold</span>
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {kpis ? kpis.total_units_sold.toLocaleString('en-US') : '...'}
            </div>
            <span className="text-[11px] text-indigo-600 font-medium inline-flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> Dispatched Item Units
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Orders</span>
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {kpis ? kpis.total_orders.toLocaleString('en-US') : '...'}
            </div>
            <span className="text-[11px] text-blue-600 font-medium inline-flex items-center gap-1 mt-1">
              Distinct Valid Invoices
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Order Value</span>
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {kpis ? `$${kpis.average_order_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...'}
            </div>
            <span className="text-[11px] text-amber-700 font-medium inline-flex items-center gap-1 mt-1">
              Basket Size per Order
            </span>
          </div>
        </div>
      </div>

      {/* Dual Longitudinal Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Revenue Trajectory */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Monthly Revenue Trajectory</h3>
            <p className="text-xs text-slate-500">Longitudinal cash flow trend ($ USD)</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(val) => [`$${Number(val).toLocaleString()}`, 'Revenue']} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Monthly Revenue ($)"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Order Volume Trajectory */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Monthly Order Volume & Units</h3>
            <p className="text-xs text-slate-500">Order frequency and items dispatched</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(val, name) => [Number(val).toLocaleString(), name]} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="units_sold" name="Units Dispatched" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="order_count" name="Order Invoices" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
