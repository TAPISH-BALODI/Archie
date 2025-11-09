import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { ProjectPage } from './pages/ProjectPage';
import { TeamPage } from './pages/TeamPage';
import { LoadingOverlay } from './components/LoadingOverlay';
import { useAppState } from './store';

export function App() {
  const { loading } = useAppState();
  return (
    <div style={{ minHeight: '100%' }}>
      <LoadingOverlay show={loading} />
      <Header />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}


