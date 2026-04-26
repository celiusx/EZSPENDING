import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import Navbar from '../components/Navbar';
import client from '../api/client';

interface Category { id: number; name: string; icon: string; color: string }
interface SpendingRecord {
  id: number; amount: number; description: string;
  category_name: string; category_color: string; category_icon: string;
  recorded_at: string; created_at: string; receipt_path?: string;
}

type Period = '' | 'daily' | 'weekly' | 'monthly' | 'yearly';

const fmt = (v: number) => `$${v.toFixed(2)}`;

export default function SpendingList() {
  const [records, setRecords]     = useState<SpendingRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [period, setPeriod]       = useState<Period>('monthly');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [receiptModal, setReceiptModal] = useState<string | null>(null);

  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: LIMIT };
      if (period) params.period = period;
      if (categoryId) params.category_id = categoryId;
      const res = await client.get('/spending', { params });
      setRecords(res.data.records);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }, [page, period, categoryId]);

  useEffect(() => { client.get('/categories').then((r) => setCategories(r.data)); }, []);
  useEffect(() => { setPage(1); }, [period, categoryId]);
  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    try {
      await client.delete(`/spending/${id}`);
      setDeleteId(null);
      load();
    } catch {
      alert('Failed to delete record');
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Spending Records</h1>
          <Link
            to="/add"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            + Add Expense
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Period</label>
            <select
              value={period} onChange={(e) => setPeriod(e.target.value as Period)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">All time</option>
              <option value="daily">Today</option>
              <option value="weekly">This week</option>
              <option value="monthly">This month</option>
              <option value="yearly">This year</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Category</label>
            <select
              value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
          {total > 0 && (
            <div className="ml-auto text-sm text-gray-500">
              {total} record{total !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-20 text-indigo-500 animate-pulse">Loading…</div>
          ) : records.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-4xl mb-3">🗂️</div>
              <div>No records found</div>
              <Link to="/add" className="text-indigo-600 text-sm mt-1 hover:underline block">Add your first expense</Link>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Date & Time</th>
                    <th className="text-left px-4 py-3 font-medium">Description</th>
                    <th className="text-left px-4 py-3 font-medium">Category</th>
                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                    <th className="text-center px-4 py-3 font-medium">Receipt</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {format(new Date(r.recorded_at), 'MMM d, yyyy')}<br />
                        <span className="text-xs text-gray-400">{format(new Date(r.recorded_at), 'h:mm a')}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-800 max-w-xs truncate">
                        {r.description || <span className="text-gray-400 italic">No description</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.category_name ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: r.category_color + '20',
                              color: r.category_color,
                            }}
                          >
                            {r.category_icon} {r.category_name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {fmt(r.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.receipt_path ? (
                          <button
                            onClick={() => setReceiptModal(`/uploads/${r.receipt_path}`)}
                            className="text-indigo-500 hover:text-indigo-700 text-lg"
                            title="View receipt"
                          >
                            📎
                          </button>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDeleteId(r.id)}
                          className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(page - 1)} disabled={page === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setPage(page + 1)} disabled={page === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Record?</h3>
            <p className="text-gray-500 text-sm mb-5">This action cannot be undone. The receipt file will also be deleted.</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setReceiptModal(null)}
        >
          <div className="max-w-2xl w-full max-h-screen bg-white rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-medium text-gray-800">Receipt</span>
              <button onClick={() => setReceiptModal(null)} className="text-gray-500 hover:text-gray-800 text-xl">✕</button>
            </div>
            {receiptModal.match(/\.pdf$/i) ? (
              <iframe src={receiptModal} className="w-full h-96" title="Receipt PDF" />
            ) : (
              <img src={receiptModal} alt="Receipt" className="w-full max-h-[70vh] object-contain p-4" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
