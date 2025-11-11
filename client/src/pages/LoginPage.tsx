import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 400, margin: '100px auto' }}>
      <div className="card" style={{ display: 'grid', gap: 16 }}>
        <div className="title">Login</div>
        {error && <div style={{ color: '#ef4444', fontSize: 14 }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          <span className="muted">Don't have an account?</span>
          <Link to="/register" style={{ color: '#3b82f6', textDecoration: 'none' }}>
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}

