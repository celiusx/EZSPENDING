import { useState, useEffect, FormEvent, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import Navbar from '../components/Navbar';
import client from '../api/client';

interface Category { id: number; name: string; icon: string; color: string }

export default function AddSpending() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    amount: '',
    description: '',
    category_id: '',
    recorded_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    client.get('/categories').then((r) => setCategories(r.data));
  }, []);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setReceipt(file);
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('amount', form.amount);
      fd.append('description', form.description);
      fd.append('category_id', form.category_id);
      fd.append('recorded_at', form.recorded_at);
      if (receipt) fd.append('receipt', receipt);

      await client.post('/spending', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/dashboard" className="text-gray-400 hover:text-gray-600">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Add Expense</h1>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                <input
                  type="number" required min="0.01" step="0.01"
                  value={form.amount} onChange={set('amount')}
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2.5 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={form.description} onChange={set('description')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="What did you spend on?"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.category_id} onChange={set('category_id')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">— Select category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            {/* Date & Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local" required
                value={form.recorded_at} onChange={set('recorded_at')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Receipt Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Receipt <span className="text-gray-400 font-normal">(optional — image or PDF, max 10MB)</span>
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-indigo-400 rounded-lg p-4 cursor-pointer transition-colors text-center"
              >
                {preview ? (
                  <img src={preview} alt="Receipt preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                ) : receipt ? (
                  <div className="text-indigo-600 text-sm">📄 {receipt.name}</div>
                ) : (
                  <div className="text-gray-400 text-sm">
                    <div className="text-3xl mb-1">📷</div>
                    Click to attach a receipt image or PDF
                  </div>
                )}
              </div>
              <input
                ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile}
              />
              {receipt && (
                <button
                  type="button" onClick={() => { setReceipt(null); setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="mt-1 text-xs text-red-500 hover:underline"
                >
                  Remove attachment
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit" disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-60"
              >
                {loading ? 'Saving…' : 'Save Expense'}
              </button>
              <Link
                to="/dashboard"
                className="flex-1 text-center border border-gray-300 text-gray-700 hover:bg-gray-50 py-2.5 rounded-lg font-medium transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
