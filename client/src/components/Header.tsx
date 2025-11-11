import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Header() {
  const { user, logout } = useAuth();
  
  return (
    <header className="header">
      <div className="container space-between" style={{ paddingTop: 12, paddingBottom: 12 }}>
        <div className="row">
          <div style={{ fontWeight: 800, fontSize: 18 }}>VZNX Workspace</div>
        </div>
        <div className="row" style={{ gap: 16, alignItems: 'center' }}>
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
              Projects
            </NavLink>
            <NavLink to="/team" className={({ isActive }) => (isActive ? 'active' : '')}>
              Team
            </NavLink>
            <NavLink to="/analytics" className={({ isActive }) => (isActive ? 'active' : '')}>
              Analytics
            </NavLink>
          </nav>
          {user && (
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 14 }}>{user.name}</span>
              <button className="btn" onClick={logout} style={{ fontSize: 12 }}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

