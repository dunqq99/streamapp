import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
export default function ArticleList({ categorySlug }) {
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    const url = categorySlug ? `https://api.dagacpc.live/api/articles?category=${categorySlug}` : 'https://api.dagacpc.live/api/articles';
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setArticles(data.articles);
        }
      })
      .catch(console.error);
  }, [categorySlug]);

  return (
    <div style={{ marginTop: '0.5rem', marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ width: '4px', height: '1.5rem', background: 'var(--accent-color)', borderRadius: '4px', display: 'inline-block' }}></span>
        Tin Tức & Kinh Nghiệm
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {articles.map(article => {
          const targetLink = `/${article.category_slug || 'tin-tuc'}/${article.slug || article.id}`;
          return (
            <Link to={targetLink} key={article.id} style={{ textDecoration: 'none', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', borderRadius: '12px', overflow: 'hidden', transition: 'transform 0.2s, background 0.2s', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.background = 'var(--card-hover)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.background = 'var(--panel-bg)'; }}>
              {article.image_url && (
                <img src={`https://api.dagacpc.live${article.image_url}`} alt={article.title} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
              )}
              <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)', padding: '0.25rem 0.75rem', borderRadius: '4px', fontWeight: '600' }}>{article.tag || article.category_slug || 'Tin tức'}</span>
                  <span>{article.date}</span>
                </div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>{article.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{article.content}</p>
              </div>
            </Link>
          );
        })}
        {articles.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Chưa có bài viết nào.</p>}
      </div>
    </div>
  );
}
