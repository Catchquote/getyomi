import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/UI/Toast';
import { ErrorBoundary } from './components/UI/ErrorBoundary';
import { LoadingSpinner } from './components/UI/LoadingSpinner';
import AppLayout from './components/Layout/AppLayout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Import    = lazy(() => import('./pages/Import'));
const Journal   = lazy(() => import('./pages/Journal'));
const Scorecard = lazy(() => import('./pages/Scorecard'));
const Login     = lazy(() => import('./pages/Login'));
const Register  = lazy(() => import('./pages/Register'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5 * 60 * 1000 } },
});

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingSpinner label="Checking session…" />;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={<ProtectedRoute><AppLayout /></ProtectedRoute>}
        >
          <Route index            element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="import"    element={<Import />} />
          <Route path="journal"   element={<Journal />} />
          <Route path="scorecard" element={<Scorecard />} />
          <Route path="*"         element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
