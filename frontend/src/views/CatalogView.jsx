import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import api from '../api';

export default function CatalogView({ user }) {
  const isAdmin = user?.role === 'admin';

  const [products, setProducts] = useState({ total: 0, page: 1, page_size: 10, items: [] });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    stock_code: '',
    description: '',
    unit_price: '',
    category: 'General',
  });
  const [formError, setFormError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  const fetchProducts = async (p = page, size = pageSize, query = search) => {
    setLoading(true);
    try {
      const params = { page: p, page_size: size };
      if (query.trim()) params.search = query.trim();
      const res = await api.get('/products', { params });
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to load products catalog', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(page, pageSize, search);
  }, [page, pageSize]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchProducts(1, pageSize, search);
  };

  const handleOpenCreate = () => {
    setForm({ stock_code: '', description: '', unit_price: '', category: 'General' });
    setIsEditing(false);
    setFormError('');
    setModalOpen(true);
  };

  const handleOpenEdit = (prod) => {
    setForm({
      stock_code: prod.stock_code,
      description: prod.description,
      unit_price: prod.unit_price,
      category: prod.category || 'General',
    });
    setIsEditing(true);
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessBanner('');
    try {
      if (isEditing) {
        await api.put(`/products/${form.stock_code}`, {
          description: form.description,
          unit_price: parseFloat(form.unit_price),
          category: form.category,
        });
        setSuccessBanner(`Product ${form.stock_code} successfully updated.`);
      } else {
        await api.post('/products', {
          stock_code: form.stock_code,
          description: form.description,
          unit_price: parseFloat(form.unit_price),
          category: form.category,
        });
        setSuccessBanner(`New product SKU ${form.stock_code} created.`);
      }
      setModalOpen(false);
      fetchProducts(page, pageSize, search);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to save product.';
      setFormError(detail);
    }
  };

  const handleDeleteProduct = async (stockCode) => {
    if (!window.confirm(`Are you sure you want to deactivate SKU ${stockCode}?`)) return;
    try {
      await api.delete(`/products/${stockCode}`);
      setSuccessBanner(`SKU ${stockCode} deactivated.`);
      fetchProducts(page, pageSize, search);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to deactivate product');
    }
  };

  const totalPages = Math.ceil(products.total / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Product Master Catalog</h2>
          <p className="text-xs text-slate-500 mt-1">Live merchandise index, pricing models, and catalog management</p>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Add New SKU
          </button>
        )}
      </div>

      {successBanner && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Control Bar: Search & Page Size */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by SKU or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
                fetchProducts(1, pageSize, '');
              }}
              className="px-2 py-2 text-xs text-slate-500 hover:text-slate-800"
            >
              Clear
            </button>
          )}
        </form>

        <div className="flex items-center gap-3 text-xs text-slate-600 self-end md:self-auto">
          <span className="font-semibold">Items per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              setPageSize(newSize);
              setPage(1);
            }}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none font-semibold"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
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
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="py-12 text-center text-slate-400">
                    Loading catalog records...
                  </td>
                </tr>
              ) : products.items.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="py-12 text-center text-slate-400">
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                products.items.map((prod) => (
                  <tr key={prod.stock_code} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">{prod.stock_code}</td>
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
                            onClick={() => handleOpenEdit(prod)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition"
                            title="Edit Product"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {prod.is_active && (
                            <button
                              onClick={() => handleDeleteProduct(prod.stock_code)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                              title="Soft Delete Product"
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

        {/* Server-Side Pagination Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing{' '}
            <span className="font-semibold text-slate-900">
              {products.total > 0 ? (page - 1) * pageSize + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-slate-900">
              {Math.min(page * pageSize, products.total)}
            </span>{' '}
            of <span className="font-semibold text-slate-900">{products.total.toLocaleString()}</span> items
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40 font-medium transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="px-2 font-bold text-slate-800">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-40 font-medium transition flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Product Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {isEditing ? `Edit SKU ${form.stock_code}` : 'Create New Product'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Code (SKU)</label>
                <input
                  type="text"
                  required
                  disabled={isEditing}
                  value={form.stock_code}
                  onChange={(e) => setForm({ ...form, stock_code: e.target.value })}
                  placeholder="e.g. 85123A"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. CERAMIC CAKE TIER"
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
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                    placeholder="12.99"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Bakeware"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
                >
                  {isEditing ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
