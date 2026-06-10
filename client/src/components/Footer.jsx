import React, { useContext } from 'react';
import { ConfigContext } from '../context/ConfigContext';
import { ThemeContext } from '../context/ThemeContext';

export default function Footer() {
  const { config } = useContext(ConfigContext);
  const { theme } = useContext(ThemeContext);

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
    <footer style={{ marginTop: 'auto', borderTop: '1px solid var(--panel-border)', background: 'var(--panel-bg)', padding: '3rem 2rem 1.5rem 2rem' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--panel-border)' }}>
        <div>
          {logoSrc ? (
            <img src={logoSrc} alt="Logo" style={{ height: '40px', objectFit: 'contain', marginBottom: '1rem' }} />
          ) : (
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem' }} dangerouslySetInnerHTML={{ __html: config?.settings?.logoTitle === 'DAGACPC.LIVE' ? '<span style="color:var(--text-primary)">DAGA</span><span style="color:var(--accent-color)">CPC</span><span style="font-size:1rem;color:var(--live-color);margin-left:4px">.LIVE</span>' : config?.settings?.logoTitle || '<span style="color:var(--text-primary)">DAGA</span><span style="color:var(--accent-color)">CPC</span><span style="font-size:1rem;color:var(--live-color);margin-left:4px">.LIVE</span>' }}></h2>
          )}
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>{config?.settings?.footerDescription || 'Hệ thống phát sóng trực tiếp đá gà Thomo chất lượng cao hàng đầu với đường truyền mượt mà, độ trễ cực thấp.'}</p>
        </div>
        <div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: '600', fontSize: '1rem' }}>{config?.settings?.footerCol1Title || 'Liên Kết Hữu Ích'}</h3>
          {config?.settings?.footerCol1HTML ? (
            <div className="footer-links-content" dangerouslySetInnerHTML={{ __html: config.settings.footerCol1HTML }} />
          ) : (
            <ul className="footer-links-content" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Đá Gà CPC1</a></li>
              <li><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Đá Gà CPC2</a></li>
              <li><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Luật Chơi Đá Gà</a></li>
            </ul>
          )}
        </div>
        <div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: '600', fontSize: '1rem' }}>{config?.settings?.footerCol2Title || 'Hỗ Trợ'}</h3>
          {config?.settings?.footerCol2HTML ? (
            <div className="footer-links-content" dangerouslySetInnerHTML={{ __html: config.settings.footerCol2HTML }} />
          ) : (
            <ul className="footer-links-content" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Điều khoản & Điều kiện</a></li>
              <li><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Chính sách bảo mật</a></li>
              <li><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Liên hệ ngay</a></li>
            </ul>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'center', paddingTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div>{config?.settings?.footerText || `© ${new Date().getFullYear()} dagacpc.live. All rights reserved.` }</div>
        {config?.settings?.dmcaHTML && (
          <div dangerouslySetInnerHTML={{ __html: config.settings.dmcaHTML }} />
        )}
      </div>
    </footer>
  );
}
