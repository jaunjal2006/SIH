import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  BarChart3, Bell, FilePlus2, History, LayoutDashboard,
  LockKeyhole, Menu, MoreHorizontal, Settings2, ShieldCheck, X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { cx, titleCase } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/',          label: 'Overview',          icon: LayoutDashboard },
  { href: '/history',   label: 'Screening History',  icon: History },
  { href: '/analytics', label: 'Analytics',          icon: BarChart3 },
  { href: '/settings',  label: 'Settings',           icon: Settings2 },
];

function Sidebar({ onClose }: { onClose: () => void }) {
  const [location] = useLocation();

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        {/* Brand */}
        <div className="brand-lockup">
          <div className="brand-icon">
            <ShieldCheck size={17} />
          </div>
          <div className="brand-text">
            <strong>Screening</strong>
            <small>CONSOLE · LAB</small>
          </div>
        </div>

        {/* Nav */}
        <div className="nav-group-label">Workspace</div>
        <nav className="side-nav">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx('nav-link', location === href && 'active')}
              onClick={onClose}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <hr className="sidebar-divider" />

        {/* New screening CTA */}
        <Link
          href="/screening/new"
          className="new-screening-btn"
          onClick={onClose}
        >
          <FilePlus2 size={15} />
          <span>New Screening</span>
          <kbd>N</kbd>
        </Link>

        {/* Bottom */}
        <div className="sidebar-bottom">
          <div className="secure-badge">
            <div className="secure-badge-dot" />
            <div className="secure-badge-text">
              <strong>Authorized Workspace</strong>
              <span>Synthetic data only</span>
            </div>
          </div>
          <div className="operator-row">
            <div className="avatar">AR</div>
            <div className="operator-info">
              <strong>A. Reviewer</strong>
              <small>Research operator</small>
            </div>
            <MoreHorizontal size={15} style={{ marginLeft: 'auto', opacity: .4 }} />
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  const [location] = useLocation();

  const crumb =
    location === '/'
      ? 'Overview'
      : location.startsWith('/screening/new')
      ? 'New Screening'
      : location.startsWith('/screening/')
      ? 'Report'
      : titleCase(location.split('/')[1]);

  return (
    <header className="topbar">
      <button
        className="btn btn-ghost mobile-menu-btn"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      <div className="breadcrumb">
        <span>Screening Console</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <strong>{crumb}</strong>
      </div>

      <div className="topbar-right">
        <div className="system-status">
          <div className="status-dot" />
          System nominal
        </div>
        <button className="icon-btn" aria-label="Notifications">
          <Bell size={16} />
        </button>
        <div className="topbar-avatar">AR</div>
      </div>
    </header>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'hsl(220 16% 4% / .6)',
            zIndex: 29, backdropFilter: 'blur(2px)',
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className={cx('sidebar', mobileOpen && 'open')}>
        <Sidebar onClose={() => setMobileOpen(false)} />
      </div>

      <div className="main-column">
        <Topbar onMenuClick={() => setMobileOpen(v => !v)} />

        <main className="page-wrap">
          <ErrorBoundary resetKey={location}>
            {children}
          </ErrorBoundary>
        </main>

        <footer className="console-footer">
          <span>SCREENING CONSOLE <strong>v1.0 · ACADEMIC PROTOTYPE</strong></span>
          <div className="footer-status">
            <div className="footer-dot" />
            <span>API connected · synthetic data only</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
