import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemeContext } from '../context/ThemeContext';
import { ConfigContext } from '../context/ConfigContext';

export default function Header({ onOpenSchedule }) {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { config } = useContext(ConfigContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const resolveLogoUrl = () => {
    if (!config?.settings) return null;
    const { logoUrlDark, logoUrlLight, logoUrl } = config.settings;
    let target = (theme === 'dark' ? logoUrlDark : logoUrlLight) || logoUrl;
    if (!target || typeof target !== 'string' || target.trim() === '' || target === 'null' || target === 'undefined') return null;
    target = target.trim();
    if (target.startsWith('http')) return target;
    return `https://api.dagacpc.live${target.startsWith('/') ? '' : '/'}${target}`;
  };

  const logoSrc = resolveLogoUrl();

  return (
    <>
      <header className="main-header" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '80px', background: 'var(--header-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--panel-border)', zIndex: 1000, display: 'flex', alignItems: 'center', padding: '0 2rem' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
            <Link to="/" style={{ textDecoration: 'none' }}>
              {logoSrc ? (
                <img src={logoSrc} alt="Logo" style={{ height: '40px', objectFit: 'contain' }} />
              ) : (
                <div style={{ fontSize: '1.75rem', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }} dangerouslySetInnerHTML={{ __html: config?.settings?.logoTitle === 'DAGACPC.LIVE' ? '<span style="color:var(--text-primary)">DAGA</span><span style="color:var(--accent-color)">CPC</span><span style="font-size:1rem;color:var(--live-color);margin-left:4px">.LIVE</span>' : config?.settings?.logoTitle || '<span style="color:var(--text-primary)">DAGA</span><span style="color:var(--accent-color)">CPC</span><span style="font-size:1rem;color:var(--live-color);margin-left:4px">.LIVE</span>' }}>
                </div>
              )}
            </Link>

            <nav className="desktop-nav-links" style={{ display: 'flex', gap: '1.5rem' }}>
              <Link to="/" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: '600' }}>Trang Chủ</Link>
              <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: '500' }}>Trực tiếp đá gà cpc</a>
              <a href="#" onClick={(e) => { e.preventDefault(); onOpenSchedule && onOpenSchedule(); }} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: '500' }}>Lịch đá gà sv388</a>
              <Link to="/tin-tuc" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: '500' }}>Kiến thức đá gà</Link>
            </nav>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <label className="theme-switch" title="Chuyển Giao Diện">
              <input
                type="checkbox"
                checked={theme === 'dark'}
                onChange={toggleTheme}
              />
              <span className="theme-slider"></span>
            </label>

            <button
              className="mobile-menu-toggle"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '1.5rem', cursor: 'pointer', display: 'none' }}
            >
              {isMobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Drawer */}
      <div className={`mobile-nav-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
        <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>Trang Chủ</Link>
        <a href="#" onClick={() => setIsMobileMenuOpen(false)}>Trực tiếp đá gà cpc</a>
        <a href="#" onClick={(e) => {
          e.preventDefault();
          setIsMobileMenuOpen(false);
          onOpenSchedule && onOpenSchedule();
        }}>Lịch đá gà sv388</a>
        <Link to="/tin-tuc" onClick={() => setIsMobileMenuOpen(false)}>Kiến thức đá gà</Link>
      </div>
    </>
  );
}
