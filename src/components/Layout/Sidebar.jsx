import { NavLink } from 'react-router-dom';

const NAV = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: '/import',
    label: 'Import',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    to: '/journal',
    label: 'Journal',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <line x1="9" y1="7" x2="15" y2="7" />
        <line x1="9" y1="11" x2="13" y2="11" />
      </svg>
    ),
  },
  {
    to: '/scorecard',
    label: 'Scorecard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 21h8M12 17v4M17 3H7l-2 7h14l-2-7z" />
        <path d="M7 10c0 2.76 2.24 5 5 5s5-2.24 5-5" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  return (
    <aside style={{ width: 'var(--sidebar-w, 220px)', background: 'var(--surface)', borderRight: '1px solid var(--bdr)', flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
      {/* Logo */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', borderBottom: '1px solid var(--bdr)', flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 14, letterSpacing: '-0.5px' }}>Y</span>
        </div>
        <span className="sidebar-label" style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)', letterSpacing: '-0.3px' }}>Yomi</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 7,
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: 13,
              color: isActive ? 'var(--accent)' : 'var(--t2)',
              background: isActive ? 'var(--accent-muted)' : 'transparent',
              transition: 'background 0.15s, color 0.15s',
            })}
            onMouseEnter={(e) => {
              if (!e.currentTarget.style.background.includes('accent-muted')) {
                e.currentTarget.style.background = 'var(--hov)';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.style.background.includes('accent-muted')) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {icon}
            <span className="sidebar-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <style>{`
        @media (max-width: 1023px) {
          .sidebar-label { display: none; }
          aside { --sidebar-w: 60px !important; }
        }
      `}</style>
    </aside>
  );
}
