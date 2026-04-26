import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const nav = (href: string) =>
    `px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
      pathname === href ? 'bg-white/20 text-white' : 'text-indigo-100 hover:bg-white/10'
    }`;

  return (
    <nav className="bg-indigo-700 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="text-white text-xl font-bold tracking-tight">
          💸 EZSPENDING
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className={nav('/dashboard')}>Dashboard</Link>
          <Link to="/spending"  className={nav('/spending')}>Records</Link>
          <Link
            to="/add"
            className="ml-2 bg-white text-indigo-700 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-colors"
          >
            + Add Expense
          </Link>
          <span className="text-indigo-200 text-sm ml-3 hidden sm:block">
            {user?.first_name} {user?.last_name}
          </span>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="text-indigo-200 hover:text-white text-sm ml-1"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
