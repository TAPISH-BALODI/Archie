import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { ProjectPage } from './pages/ProjectPage';
import { TeamPage } from './pages/TeamPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { LoadingOverlay } from './components/LoadingOverlay';
import { useAppState } from './store';
import { useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, onAuthChange } = useAuth();
  const { loading, initialLoad, methods } = useAppState();
  
  useEffect(() => {
    if (user && !initialLoad) {
      methods.reload();
    }
  }, [user, initialLoad, methods]);
  
  useEffect(() => {
    if (onAuthChange) {
      onAuthChange(() => {
        methods.reload();
      });
    }
  }, [onAuthChange, methods]);
  
  if (authLoading) {
    return <LoadingOverlay show={true} />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (!initialLoad) {
    return <LoadingOverlay show={true} />;
  }
  
  return <>{children}</>;
}

export function App() {
  const { loading } = useAppState();
  const { loading: authLoading } = useAuth();
  
  return (
    <div style={{ minHeight: '100%' }}>
      <LoadingOverlay show={loading || authLoading} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Header />
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects/:projectId" element={<ProjectPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

