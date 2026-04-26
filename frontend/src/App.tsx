import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AddSpending from './pages/AddSpending';
import SpendingList from './pages/SpendingList';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/add"      element={<ProtectedRoute><AddSpending /></ProtectedRoute>} />
          <Route path="/spending" element={<ProtectedRoute><SpendingList /></ProtectedRoute>} />
          <Route path="*"         element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
