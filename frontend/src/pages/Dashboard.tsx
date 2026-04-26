import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { format, parseISO, eachDayOfInterval, subDays } from 'date-fns';
import Navbar from '../components/Navbar';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface PeriodStat { total: number; count: number }
interface ChartPoint { date?: string; hour?: string; month?: string; total: number }
interface Category { name: string; color: string; icon: string; total: number; count: number }
interface Record {
  id: number; amount: number; description: string;
  category_name: string; category_color: string; category_icon: string;
  recorded_at: string; receipt_path?: string;
}
interface SummaryData {
  summary: { daily: PeriodStat; weekly: PeriodStat; monthly: PeriodStat; yearly: PeriodStat };
  dailyChart: ChartPoint[];
  weeklyChart: ChartPoint[];
  monthlyChart: ChartPoint[];
  yearlyChart: ChartPoint[];
  categories: { daily: Category[]; weekly: Category[]; monthly: Category[]; yearly: Category[] };
  recent: Record[];
}

const fmt = (v: number) => `$${v.toFixed(2)}`;

function SummaryCard({
  label, total, count, active, onClick,
}: { label: string; total: number; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-5 rounded-xl shadow-sm border-2 transition-all w-full ${
        active ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200 shadow-md'
                : 'bg-white text-gray-800 border-gray-100 hover:border-indigo-300'
      }`}
    >
      <div className={`text-xs font-medium uppercase tracking-wide mb-1 ${active ? 'text-indigo-200' : 'text-gray-500'}`}>
        {label}
      </div>
      <div className="text-2xl font-bold">{fmt(total)}</div>
      <div className={`text-xs mt-1 ${active ? 'text-indigo-200' : 'text-gray-400'}`}>
        {count} transaction{count !== 1 ? 's' : ''}
      </div>
    </button>
  );
}

function fillWeeklyGaps(data: ChartPoint[]): ChartPoint[] {
  const map = new Map(data.map((d) => [d.date!, d.total]));
  const days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
  return days.map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    return { date: key, total: map.get(key) ?? 0 };
  });
}

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('monthly');
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/spending/summary');
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const chartData = (() => {
    if (!data) return [];
    if (period === 'daily') return data.dailyChart;
    if (period === 'weekly') return fillWeeklyGaps(data.weeklyChart);
    if (period === 'monthly') return data.monthlyChart;
    return data.yearlyChart;
  })();

  const xKey = period === 'daily' ? 'hour' : period === 'yearly' ? 'month' : 'date';

  const formatX = (v: string) => {
    try {
      if (period === 'daily') return v;
      if (period === 'weekly') return format(parseISO(v), 'EEE');
      if (period === 'monthly') return format(parseISO(v), 'd');
      return format(parseISO(v + '-01'), 'MMM');
    } catch { return v; }
  };

  const cats = data?.categories[period] ?? [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-indigo-500 animate-pulse text-lg font-medium">Loading dashboard…</div>
        </div>
      </div>
    );
  }

  const s = data!.summary;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Welcome back, {user?.first_name}!
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Here's your spending overview</p>
          </div>
          <Link
            to="/add"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            + Add Expense
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="Today"      total={s.daily.total}   count={s.daily.count}   active={period==='daily'}   onClick={() => setPeriod('daily')} />
          <SummaryCard label="This Week"  total={s.weekly.total}  count={s.weekly.count}  active={period==='weekly'}  onClick={() => setPeriod('weekly')} />
          <SummaryCard label="This Month" total={s.monthly.total} count={s.monthly.count} active={period==='monthly'} onClick={() => setPeriod('monthly')} />
          <SummaryCard label="This Year"  total={s.yearly.total}  count={s.yearly.count}  active={period==='yearly'}  onClick={() => setPeriod('yearly')} />
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Trend Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-5">
              Spending Trend —{' '}
              <span className="text-indigo-600">
                {period === 'daily' ? 'Today by Hour' :
                 period === 'weekly' ? 'Last 7 Days' :
                 period === 'monthly' ? 'This Month by Day' : 'This Year by Month'}
              </span>
            </h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey={xKey} tickFormatter={formatX} fontSize={11} tick={{ fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `$${v}`} fontSize={11} tick={{ fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip
                    formatter={(v: number) => [fmt(v), 'Spending']}
                    labelFormatter={(l) => {
                      try {
                        if (period === 'daily') return l;
                        if (period === 'yearly') return format(parseISO(l + '-01'), 'MMMM yyyy');
                        return format(parseISO(l), 'EEEE, MMM d');
                      } catch { return l; }
                    }}
                    contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                  />
                  <Bar dataKey="total" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">
                No spending recorded for this period
              </div>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-5">Category Breakdown</h2>
            {cats.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={cats} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={75} strokeWidth={2}>
                      {cats.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-3">
                  {cats.slice(0, 6).map((c, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600 truncate">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <span>{c.icon} {c.name}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-800 ml-2">{fmt(c.total)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                No data for this period
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-gray-700">Recent Transactions</h2>
            <Link to="/spending" className="text-indigo-600 text-sm hover:underline">View all</Link>
          </div>
          {data!.recent.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {data!.recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
                      style={{ backgroundColor: r.category_color ? r.category_color + '20' : '#F3F4F6' }}
                    >
                      {r.category_icon || '📦'}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-800">
                        {r.description || r.category_name || 'Expense'}
                      </div>
                      <div className="text-xs text-gray-400">
                        {r.category_name} · {format(new Date(r.recorded_at), 'MMM d, yyyy h:mm a')}
                        {r.receipt_path && <span className="ml-1 text-indigo-400">📎</span>}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{fmt(r.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-10 text-sm">
              No transactions yet.{' '}
              <Link to="/add" className="text-indigo-600 hover:underline">Add your first expense</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
