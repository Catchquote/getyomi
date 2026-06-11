import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import AppLayout from './components/Layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Import from './pages/Import';
import Journal from './pages/Journal';
import Scorecard from './pages/Scorecard';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"  element={<Dashboard />} />
            <Route path="import"     element={<Import />} />
            <Route path="journal"    element={<Journal />} />
            <Route path="scorecard"  element={<Scorecard />} />
            <Route path="*"          element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
