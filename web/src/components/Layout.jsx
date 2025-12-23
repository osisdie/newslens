import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import './Layout.css';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="layout">
      <nav className="navbar">
        <Link to="/" className="logo">AI News</Link>
        <div className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            News
          </Link>
          <Link to="/sources" className={location.pathname === '/sources' ? 'active' : ''}>
            Sources
          </Link>
          {/* Temporarily hidden */}
          {/* <Link to="/billing" className={location.pathname === '/billing' ? 'active' : ''}>
            Billing
          </Link> */}
          <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>
            Profile
          </Link>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

