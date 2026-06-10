import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import LiveStreamPage from './LiveStreamPage';
import ArticleList from '../components/ArticleList';

export default function DynamicRoutePage() {
  const { slug } = useParams();
  const [isCategory, setIsCategory] = useState(null);

  useEffect(() => {
    fetch('https://api.dagacpc.live/api/categories')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const isCat = data.categories.some(c => c.slug === slug);
          setIsCategory(isCat);
        } else {
          setIsCategory(false);
        }
      })
      .catch(() => setIsCategory(false));
  }, [slug]);

  if (isCategory === null) {
    return <div style={{ padding: '2rem', color: 'var(--text-primary)' }}>Loading...</div>;
  }

  if (isCategory) {
    return (
      <div style={{ padding: '1rem', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px solid var(--panel-border)', minHeight: '60vh' }}>
        <ArticleList categorySlug={slug} />
      </div>
    );
  }

  // Fallback to LiveStreamPage
  return (
    <>
      <LiveStreamPage />
      <ArticleList />
    </>
  );
}
