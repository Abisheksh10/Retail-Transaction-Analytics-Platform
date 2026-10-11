import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Globe,
  AlertTriangle,
  Search,
  Calendar,
  Download,
  RefreshCw,
} from 'lucide-react';
import api from '../api';

const PRESETS = [
  { label: 'All Time (2009-2011)', start: '', end: '' },
  { label: '2009-2010', start: '2009-12-01', end: '2010-12-09' },
  { label: '2010-2011', start: '2010-12-01', end: '2011-12-09' },
  { label: 'Q4 Peak', start: '2010-10-01', end: '2010-12-31' },
];

export default function AnalyticsView() {
  const [topSortBy, setTopSortBy] = useState('revenue');
  const [topProducts, setTopProducts] = useState([]);
  const [decliningProducts, setDecliningProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Regional Sales state & timeline filters (Strict Top 5)
  const [regionalSales, setRegionalSales] = useState([]);
  const [regionalLoading, setRegionalLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [countrySearch, setCountrySearch] = useState('');

  // Declining SKUs state & filters
  const [decliningSearch, setDecliningSearch] = useState('');
  const [minDeclineFilter, setMinDeclineFilter] = useState(40);

  const fetchRegionalSales = async (start = startDate, end = endDate) => {
    setRegionalLoading(true);
    try {
      const params = new URLSearchParams();
      if (start) params.append('start_date', start);
      if (end) params.append('end_date', end);
      params.append('limit', '5');

      const res = await api.get(`/analytics/regional-sales?${params.toString()}`);
      setRegionalSales(res.data);
    } catch (err) {
      console.error('Failed to load regional sales data', err);
    } finally {
      setRegionalLoading(false);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [topRes, decRes] = await Promise.all([
        api.get(`/analytics/top-products?limit=10&sort_by=${topSortBy}`),
        api.get('/analytics/declining-products'),
      ]);
      setTopProducts(topRes.data);
      setDecliningProducts(decRes.data);
    } catch (err) {
      console.error('Failed to load initial analytics data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [topSortBy]);

  useEffect(() => {
    fetchRegionalSales();
  }, []);

  const handlePresetSelect = (preset) => {
    setStartDate(preset.start);
    setEndDate(preset.end);
    fetchRegionalSales(preset.start, preset.end);
  };

  const handleApplyFilter = () => {
    fetchRegionalSales(startDate, endDate);
  };

  const top5Markets = regionalSales.slice(0, 5);

  const handleExportCSV = () => {
    if (!top5Markets || top5Markets.length === 0) return;
    const headers = ['Country Name', 'Revenue ($)', 'Units Sold', 'Total Orders'];
    const rows = top5Markets.map((r) => [
      `"${r.country_name.replace(/"/g, '""')}"`,
      r.revenue,
      r.units_sold,
      r.total_orders,
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `top_5_regional_sales_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTop5 = top5Markets.filter((c) =>
    c.country_name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredDeclining = decliningProducts.filter((p) => {
    const matchesSearch =
      p.stock_code.toLowerCase().includes(decliningSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(decliningSearch.toLowerCase());
    const matchesDecline = p.decline_pct >= minDeclineFilter;
    return matchesSearch && matchesDecline;
  });

  return (
    <div className="space-y-8">
      {/* View Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Deep-Dive Analytics</h2>
        <p className="text-xs text-slate-500 mt-1">
          Product commercial rankings, Top 5 geographic markets, and churn risk detection
        </p>
      </div>

      {/* Section 1: Top Products Leaderboard */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Product Performance Leaderboard</h3>
            <p className="text-xs text-slate-500">Top 10 catalog items ranked by commercial performance</p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setTopSortBy('revenue')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                topSortBy === 'revenue'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rank by Revenue ($)
            </button>
            <button
              onClick={() => setTopSortBy('quantity')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                topSortBy === 'quantity'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rank by Quantity (Units)
            </button>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="stock_code" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickFormatter={(val) =>
                  topSortBy === 'revenue' ? `$${(val / 1000).toFixed(0)}k` : `${(val / 1000).toFixed(0)}k`
                }
              />
              <Tooltip
                formatter={(val, name, props) => [
                  topSortBy === 'revenue' ? `$${Number(val).toLocaleString()}` : Number(val).toLocaleString(),
                  `${name} (${props.payload.description})`,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {topSortBy === 'revenue' ? (
                <Bar dataKey="revenue" name="Total Revenue ($)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              ) : (
                <Bar dataKey="units_sold" name="Units Sold" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section 2: Top 5 Geographic Markets */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Top 5 Geographic Markets
              </h3>
              <p className="text-xs text-slate-500">
                Strict Top 5 commercial markets by revenue with parameterized timeline filtering
              </p>
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={top5Markets.length === 0}
            className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50 self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>
        </div>

        {/* Date Filter Control Bar (Timeline Filters ONLY) */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
          {/* Quick Presets Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mr-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Presets:
            </span>
            {PRESETS.map((preset) => {
              const isActive = startDate === preset.start && endDate === preset.end;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Date Pickers & Apply Controls */}
          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-200/80">
            {/* Start Date */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">Start Date:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">End Date:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>

            {/* Apply Button */}
            <button
              type="button"
              onClick={handleApplyFilter}
              disabled={regionalLoading}
              className="ml-auto px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regionalLoading ? 'animate-spin' : ''}`} />
              Apply Filter
            </button>
          </div>
        </div>

        {/* Horizontal BarChart */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Top 5 Regional Markets by Revenue
            </h4>
            <span className="text-[11px] text-slate-500 font-medium">
              Strict Top 5 Markets
            </span>
          </div>

          <div className="w-full bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            {regionalLoading ? (
              <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-emerald-600" />
                Aggregating Top 5 regional metrics...
              </div>
            ) : top5Markets.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-xs text-slate-400">
                No transaction records found matching the specified date window.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={top5Markets}
                  layout="vertical"
                  margin={{ top: 8, right: 30, left: 10, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(val) => {
                      if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
                      if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
                      return `$${val}`;
                    }}
                  />
                  <YAxis
                    dataKey="country_name"
                    type="category"
                    width={110}
                    tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                            <p className="font-bold text-slate-100">{data.country_name}</p>
                            <p className="text-emerald-400 font-semibold">
                              Revenue: ${data.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-slate-300">
                              Total Orders: {data.total_orders.toLocaleString()}
                            </p>
                            <p className="text-slate-300">
                              Units Sold: {data.units_sold.toLocaleString()}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Revenue ($)"
                    fill="#10b981"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top 5 Markets Breakdown Table */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Top 5 Markets Breakdown
            </h4>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search market in Top 5..."
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Market / Country</th>
                  <th className="py-2.5 px-4 text-right">Total Orders</th>
                  <th className="py-2.5 px-4 text-right">Units Sold</th>
                  <th className="py-2.5 px-4 text-right">Revenue ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTop5.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{c.country_name}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600 font-mono">
                      {c.total_orders.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-600 font-mono">
                      {c.units_sold.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 font-mono">
                      ${c.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 3: Year-over-Year Declining SKUs */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Year-over-Year Declining SKUs (Churn Risk)</h3>
              <p className="text-xs text-slate-500">Products experiencing severe sales volume drop between 2009-10 and 2010-11</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Decline Threshold &gt;</span>
            <select
              value={minDeclineFilter}
              onChange={(e) => setMinDeclineFilter(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold outline-none text-slate-700 bg-white"
            >
              <option value={40}>40%</option>
              <option value={50}>50%</option>
              <option value={75}>75%</option>
              <option value={90}>90%</option>
            </select>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search declining SKU or description..."
            value={decliningSearch}
            onChange={(e) => setDecliningSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase sticky top-0 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">SKU & Description</th>
                <th className="py-2.5 px-4 text-right">Year 1 Units</th>
                <th className="py-2.5 px-4 text-right">Year 2 Units</th>
                <th className="py-2.5 px-4 text-right">Volume Drop</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDeclining.map((p) => (
                <tr key={p.stock_code} className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-4">
                    <div className="font-bold text-slate-800">{p.stock_code}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs" title={p.description}>
                      {p.description}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-600 font-mono">{p.y1_units.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right text-slate-600 font-mono">{p.y2_units.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-rose-600 font-mono">
                    -{p.decline_pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
