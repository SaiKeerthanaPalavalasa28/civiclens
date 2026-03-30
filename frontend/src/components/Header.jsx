import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import './Header.css';

const Header = () => {
  const [session, setSession] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isAppPage = location.pathname.startsWith('/app');

  if (isAppPage) {
    return (
      <header className="topbar">
        <Link to="/" className="nav-logo">Civic<span>Lens</span></Link>
        <div className="topbar-right">
          {session?.user?.email && <span className="user-email">{session.user.email}</span>}
          <button className="btn-logout" onClick={handleLogout}>Log out</button>
        </div>
      </header>
    );
  }

  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">Civic<span>Lens</span></Link>
      <ul className="nav-links">
        <li><a href="/#home">Home</a></li>
        <li><a href="/#about">About</a></li>
        <li><a href="/#how">How It Works</a></li>
        <li><a href="/#team">Team</a></li>
        {!session ? (
          <li><Link to="/login" className="nav-cta">Login</Link></li>
        ) : (
          <li><Link to="/app" className="nav-cta">Dashboard</Link></li>
        )}
      </ul>
    </nav>
  );
};

export default Header;
