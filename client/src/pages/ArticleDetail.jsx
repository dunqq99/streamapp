import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiUrl, assetUrl, getSiteBaseUrl } from '../lib/api';

export default function ArticleDetail() {
  const { categorySlug, articleSlug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl(`/api/articles/${categorySlug}/${articleSlug}`))
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setArticle(data.article);
          
          // Dynamic SEO Meta Update
          const titleText = `${data.article.title} - Kiến Thức Đá Gà | DagaCPC.Live`;
          document.title = titleText;
          
          const plainContent = data.article.content ? data.article.content.replace(/<[^>]*>/g, '').trim() : '';
          const shortDesc = plainContent.substring(0, 155) + '...';
          
          let metaDesc = document.querySelector('meta[name="description"]');
          if (metaDesc) {
            metaDesc.setAttribute('content', shortDesc);
          } else {
            metaDesc = document.createElement('meta');
            metaDesc.name = "description";
            metaDesc.content = shortDesc;
            document.head.appendChild(metaDesc);
          }

          // Dynamic JSON-LD Article Schema
          let schemaScript = document.getElementById('seo-article-schema');
          if (!schemaScript) {
            schemaScript = document.createElement('script');
            schemaScript.id = 'seo-article-schema';
            schemaScript.type = 'application/ld+json';
            document.head.appendChild(schemaScript);
          }
          const articleSchema = {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            "headline": data.article.title,
            "description": shortDesc,
            "image": [
              data.article.image_url ? assetUrl(data.article.image_url) : assetUrl('/favicon.svg')
            ],
            "datePublished": data.article.created_at || new Date().toISOString(),
            "dateModified": data.article.created_at || new Date().toISOString(),
            "author": [{
              "@type": "Person",
              "name": "BTV DagaCPC",
              "url": getSiteBaseUrl()
            }],
            "publisher": {
              "@type": "Organization",
              "name": "DagaCPC.Live",
              "logo": {
                "@type": "ImageObject",
                "url": assetUrl('/favicon.svg')
              }
            },
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": window.location.href
            }
          };
          schemaScript.textContent = JSON.stringify(articleSchema);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });

    // Cleanup Schema on unmount
    return () => {
      const schemaScript = document.getElementById('seo-article-schema');
      if (schemaScript) {
        schemaScript.remove();
      }
    };
  }, [categorySlug, articleSlug]);

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-primary)' }}>Đang tải bài viết...</div>;
  if (!article) return <div style={{ padding: '2rem', color: 'var(--text-primary)' }}>Bài viết không tồn tại.</div>;

  return (
    <div style={{ background: 'var(--panel-bg)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--panel-border)' }}>
      {article.image_url && (
        <img src={assetUrl(article.image_url)} alt={article.title} style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }} />
      )}
      <div style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
          <Link to={`/${categorySlug}`} style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-color)', padding: '0.25rem 0.75rem', borderRadius: '4px', fontWeight: '600', textDecoration: 'none' }}>
            {article.tag || article.category_slug || 'Danh Mục'}
          </Link>
          <span style={{ color: 'var(--text-secondary)' }}>{article.date}</span>
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>{article.title}</h1>
        <div 
          style={{ color: 'var(--text-secondary)', lineHeight: '1.8', fontSize: '1.1rem', overflow: 'hidden' }} 
          dangerouslySetInnerHTML={{ __html: article.content }} 
          className="quill-content-inject"
        />
      </div>
    </div>
  );
}
