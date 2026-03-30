import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import './Login.css';

const Login = () => {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null); // { text: '', type: 'error' | 'success' }
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/app');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) navigate('/app');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setMsg({ text: 'Please enter your email and password.', type: 'error' }); return; }
    if (password.length < 6) { setMsg({ text: 'Password must be at least 6 characters.', type: 'error' }); return; }

    setLoading(true);
    setMsg(null);

    if (tab === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ text: error.message, type: 'error' });
        setLoading(false);
        return;
      }
      setMsg({ text: 'Login successful — redirecting…', type: 'success' });
      setTimeout(() => navigate('/app'), 600);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMsg({ text: error.message, type: 'error' });
        setLoading(false);
        return;
      }
      setMsg({ text: 'Account created! Check your email to confirm, then log in.', type: 'success' });
      setLoading(false);
      setTimeout(() => setTab('login'), 2000);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/app' }
    });
    if (error) setMsg({ text: 'Google sign-in failed: ' + error.message, type: 'error' });
  };

  return (
    <div className="login-page">
      <Link to="/" className="login-logo">Civic<span>Lens</span></Link>

      <div className="login-card">
        <h1 className="login-card-title">Welcome</h1>
        <p className="login-card-sub">Sign in or create an account to continue.</p>

        <div className="tab-row">
          <button className={`tab-btn ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setMsg(null); }}>Log In</button>
          <button className={`tab-btn ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setMsg(null); }}>Sign Up</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="email">Email address</label>
            <input type="email" id="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input type="password" id="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? (tab === 'login' ? 'Logging in…' : 'Creating account…') : (tab === 'login' ? 'Log In' : 'Create Account')}
          </button>
        </form>

        <div className="or-divider">or</div>

        <button className="btn-google" onClick={handleGoogle} type="button">
          <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>

        {msg && <div className={`login-msg ${msg.type}`}>{msg.text}</div>}
      </div>

      <Link to="/" className="back-link">← Back to home</Link>
    </div>
  );
};

export default Login;
