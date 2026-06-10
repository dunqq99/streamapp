import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { ConfigContext } from '../context/ConfigContext';

export default function Sidebar() {
  const { config } = useContext(ConfigContext);

  return (
    <div className="sidebar-left">
      <div className="sidebar-widget" style={{ background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--panel-border)', overflow: 'hidden' }}>
        <h2 style={{ padding: '1.25rem', borderBottom: '1px solid var(--panel-border)', fontSize: '1.1rem', background: 'rgba(59, 130, 246, 0.1)', margin: 0, fontWeight: 700 }}>Sân Chơi Đá Gà</h2>
        <ul style={{ listStyle: 'none', padding: '0.5rem 0' }}>
          {['CPC1', 'CPC2', 'CPC3', 'CPC4', 'CPC5', 'CPC6'].map((cat, idx) => (
            <li key={idx}>
              <Link to={`/truc-tiep-da-ga-${cat.toLowerCase()}`} style={{ display: 'block', padding: '0.75rem 1.25rem', color: 'var(--text-primary)', textDecoration: 'none', transition: 'background 0.2s', fontWeight: '500' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--card-hover)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                Đá Gà {cat}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-widget" style={{ background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--panel-border)', padding: '1.25rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent-color)', fontWeight: 700, margin: 0 }}>{config?.settings?.sidebarTitle || 'Trực Tiếp Mới Nhất'}</h2>
        {config?.settings?.sidebarHtml ? (
           <div className="sidebar-textlink-content" dangerouslySetInnerHTML={{ __html: config.settings.sidebarHtml.replace(/\[LIVE\]/g, '<span class="live-badge" style="padding: 0.15rem 0.4rem; font-size: 0.65rem;">LIVE</span>').replace(/\[&gt;\]|\[>\]/g, '►') }} />
        ) : (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <li>
              <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-color)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
                <span className="live-badge" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}>LIVE</span> CPC1 Trận 12 Hôm Nay
              </a>
            </li>
            <li>
              <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem' }} onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-color)'} onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}>
                ► Xem Lại: Gà tre hạng nặng CPC3
              </a>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
