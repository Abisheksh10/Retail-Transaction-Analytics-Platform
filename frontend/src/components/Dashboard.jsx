import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Filter,
  Plus,
  Search,
  Edit,
  Trash2,
  Shield,
  LogOut,
  Globe,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  UserCheck,
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
import AdminPortal from './AdminPortal';

export default function Dashboard({ user, onLogout }) {
  const [kpis, setKpis] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [kpiLoading, setKpiLoading] = useState(false);

  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [regionalSales, setRegionalSales] = useState([]);
  const [decliningProducts, setDecliningProducts] = useState([]);

  // Product Catalog State
  const [products, setProducts] = useState({ total: 0, page: 1, page_size: 10, items: [] });
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productLoading, setProductLoading] = useState(false);

  // Modals
  const [adminOpen, setAdminOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    stock_code: '',
    description: '',
    unit_price: '',
    category: 'General',
  });
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState('');

  const isAdmin = user?.role === 'admin';

  // 1. Fetch KPIs with Date Filters
  const fetchKPIs = async () => {
    setKpiLoading(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const res = await api.get('/analytics/kpis', { params });
      setKpis(res.data);
    } catch (err) {
      console.error('Failed to load KPIs', err);
    } finally {
      setKpiLoading(false);
    }
  };

  // 2. Fetch Visual Analytics Data
  const fetchVisuals = async () => {
    try {
      const [trendsRes, topRes, regRes, decRes] = await Promise.all([
        api.get('/analytics/monthly-trends'),
        api.get('/analytics/top-products?limit=10&sort_by=revenue'),
        api.get('/analytics/regional-sales'),
        api.get('/analytics/declining-products'),
      ]);
      setMonthlyTrends(trendsRes.data);
      setTopProducts(topRes.data);
      setRegionalSales(regRes.data.slice(0, 10)); // Top 10 countries
      setDecliningProducts(decRes.data.slice(0, 8)); // Top 8 declining
    } catch (err) {
      console.error('Failed to load charts and analytical metrics', err);
    }
  };

  // 3. Fetch Products List
  const fetchProducts = async (page = 1, search = '') => {
    setProductLoading(true);
    try {
      const params = { page, page_size: 8 };
      if (search) params.search = search;
      const res = await api.get('/products', { params });
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to load products', err);
    } finally {
      setProductLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIs();
    fetchVisuals();
    fetchProducts(1, '');
  }, []);

  const handleApplyDateFilter = (e) => {
    e.preventDefault();
    fetchKPIs();
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setTimeout(fetchKPIs, 50);
  };

  // Product CRUD Handlers
  const handleOpenCreateProduct = () => {
    setProductForm({ stock_code: '', description: '', unit_price: '', category: 'General' });
    setIsEditingProduct(false);
    setProductFormError('');
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod) => {
    setProductForm({
      stock_code: prod.stock_code,
      description: prod.description,
      unit_price: prod.unit_price,
      category: prod.category || 'General',
    });
    setIsEditingProduct(true);
    setProductFormError('');
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setProductFormError('');
    try {
      if (isEditingProduct) {
        await api.put(`/products/${productForm.stock_code}`, {
          description: productForm.description,
          unit_price: parseFloat(productForm.unit_price),
          category: productForm.category,
        });
      } else {
        await api.post('/products', {
          stock_code: productForm.stock_code,
          description: productForm.description,
          unit_price: parseFloat(productForm.unit_price),
          category: productForm.category,
        });
      }
      setProductModalOpen(false);
      fetchProducts(productPage, productSearch);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to save product';
      setProductFormError(detail);
    }
  };

  const handleDeleteProduct = async (stockCode) => {
    if (!window.confirm(`Are you sure you want to deactivate SKU ${stockCode}?`)) return;
    try {
      await api.delete(`/products/${stockCode}`);
      fetchProducts(productPage, productSearch);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to deactivate product');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg text-white shadow-md">
              R
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Retail Transaction Analytics</h1>
              <p className="text-[11px] text-slate-400">1.01M+ Verified Enterprise Transactions</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* User Badge */}
            <div className="flex items-center gap-2.5 bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700/60 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium text-slate-300">{user?.email}</span>
              <span
                className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] ${
                  isAdmin ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50' : 'bg-blue-900/60 text-blue-300 border border-blue-700/50'
                }`}
              >
                {user?.role}
              </span>
            </div>

            {/* Admin Approvals Button */}
            {isAdmin && (
              <button
                onClick={() => setAdminOpen(true)}
                className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl font-medium transition shadow-sm"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Approvals</span>
              </button>
            )}

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-rose-950/70 hover:text-rose-300 text-slate-300 px-3 py-1.5 rounded-xl transition border border-slate-700/60"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* KPI & Filter Controls Header */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Executive Summary</h2>
            <p className="text-xs text-slate-500 mt-0.5">Key Performance Indicators & Volume Analysis</p>
          </div>

          <form onSubmit={handleApplyDateFilter} className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-semibold text-slate-600 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" /> Filter Range:
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
              disabled={kpiLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3.5 py-1.5 rounded-lg transition"
            >
              {kpiLoading ? 'Loading...' : 'Apply'}
            </button>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition"
              >
                Reset
              </button>
            )}
          </form>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Revenue */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
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

          {/* Card 2: Total Units Sold */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
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
                <TrendingUp className="w-3 h-3" /> Item Units Dispatched
              </span>
            </div>
          </div>

          {/* Card 3: Total Orders */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Orders</span>
              <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {kpis ? kpis.total_orders.toLocaleString('en-US') : '...'}
              </div>
              <span className="text-[11px] text-blue-600 font-medium inline-flex items-center gap-1 mt-1">
                Distinct Order Invoices
              </span>
            </div>
          </div>

          {/* Card 4: Average Order Value */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
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
                Per-Transaction Basket Size
              </span>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Monthly Trends (LineChart) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Monthly Revenue Performance</h3>
                <p className="text-xs text-slate-500">24-month revenue trajectory (2009 - 2011)</p>
              </div>
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
                  <Tooltip
                    formatter={(val) => [`$${Number(val).toLocaleString()}`, 'Revenue']}
                    labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue ($)"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Top 10 Revenue Products (BarChart) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Top 10 Products by Revenue</h3>
                <p className="text-xs text-slate-500">Ranked by aggregate monetary sales</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="stock_code" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val, name, props) => [
                      `$${Number(val).toLocaleString()} (${props.payload.description})`,
                      'Revenue',
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="revenue" name="Total Revenue ($)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Section: Geographic Markets & Declining Products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Countries Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Top 10 Geographic Markets</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Country</th>
                    <th className="py-2.5 px-3 text-right">Orders</th>
                    <th className="py-2.5 px-3 text-right">Units</th>
                    <th className="py-2.5 px-3 text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {regionalSales.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-800 flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                        {c.country_name}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{c.total_orders.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{c.units_sold.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        ${c.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Declining Products Alert Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">Year-over-Year Declining SKUs</h3>
              </div>
              <span className="text-[11px] text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                &gt;40% Drop in Year 2
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">SKU / Description</th>
                    <th className="py-2.5 px-3 text-right">Y1 Units</th>
                    <th className="py-2.5 px-3 text-right">Y2 Units</th>
                    <th className="py-2.5 px-3 text-right">Decline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {decliningProducts.map((p) => (
                    <tr key={p.stock_code} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{p.stock_code}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{p.description}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600 font-mono">{p.y1_units.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600 font-mono">{p.y2_units.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                        -{p.decline_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Product Master Catalog (with Search, Pagination & Admin CRUD) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Product Master Catalog</h3>
              <p className="text-xs text-slate-500">Live inventory and merchandise registry</p>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search SKU or name..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductPage(1);
                    fetchProducts(1, e.target.value);
                  }}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 w-52"
                />
              </div>

              {isAdmin && (
                <button
                  onClick={handleOpenCreateProduct}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Product
                </button>
              )}
            </div>
          </div>

          {/* Product Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Stock Code</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productLoading ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-slate-400">
                      Loading product catalog...
                    </td>
                  </tr>
                ) : products.items.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="py-8 text-center text-slate-400">
                      No matching products found.
                    </td>
                  </tr>
                ) : (
                  products.items.map((prod) => (
                    <tr key={prod.stock_code} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-indigo-700">{prod.stock_code}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{prod.description}</td>
                      <td className="py-3 px-4 text-slate-500">{prod.category}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        ${prod.unit_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            prod.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {prod.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditProduct(prod)}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition"
                              title="Edit product"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {prod.is_active && (
                              <button
                                onClick={() => handleDeleteProduct(prod.stock_code)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition"
                                title="Soft delete product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
            <span>
              Showing {Math.min((productPage - 1) * products.page_size + 1, products.total)} to{' '}
              {Math.min(productPage * products.page_size, products.total)} of {products.total} products
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={productPage <= 1}
                onClick={() => {
                  const p = productPage - 1;
                  setProductPage(p);
                  fetchProducts(p, productSearch);
                }}
                className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-semibold text-slate-700 px-2">Page {productPage}</span>
              <button
                disabled={productPage * products.page_size >= products.total}
                onClick={() => {
                  const p = productPage + 1;
                  setProductPage(p);
                  fetchProducts(p, productSearch);
                }}
                className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Admin Portal Modal */}
      {adminOpen && <AdminPortal onClose={() => setAdminOpen(false)} />}

      {/* Product Create/Edit Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {isEditingProduct ? `Edit SKU ${productForm.stock_code}` : 'Create New Product'}
              </h3>
              <button onClick={() => setProductModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              {productFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                  {productFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Code (SKU)</label>
                <input
                  type="text"
                  required
                  disabled={isEditingProduct}
                  value={productForm.stock_code}
                  onChange={(e) => setProductForm({ ...productForm, stock_code: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={productForm.unit_price}
                    onChange={(e) => setProductForm({ ...productForm, unit_price: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
                >
                  {isEditingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
