import { NavLink } from 'react-router-dom';

export function Header() {
  return (
    <header className="header">
      <div className="container space-between" style={{ paddingTop: 12, paddingBottom: 12 }}>
        <div className="row">
          <div style={{ fontWeight: 800, fontSize: 18 }}>VZNX Workspace</div>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Projects
          </NavLink>
          <NavLink to="/team" className={({ isActive }) => (isActive ? 'active' : '')}>
            Team
          </NavLink>
        </nav>
      </div>
    </header>
  );
}


