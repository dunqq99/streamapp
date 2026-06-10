import { useEffect } from 'react';

const SITE_NAME = 'DagaCPC.Live';
const BASE_URL = 'https://dagacpc.live';
const DEFAULT_OG_IMAGE = 'https://api.dagacpc.live/og-default.jpg';

/**
 * Custom hook quản lý toàn bộ SEO meta tags cho một trang.
 * Tự động cleanup khi component unmount (canonical, JSON-LD).
 *
 * @param {object} params
 * @param {string} params.title           - <title> tag
 * @param {string} params.description     - meta description
 * @param {string} [params.canonical]     - URL canonical đầy đủ
 * @param {string} [params.ogImage]       - URL ảnh OG (tuyệt đối)
 * @param {string} [params.ogType]        - "website" | "article" | "video.other"
 * @param {object|null} [params.jsonLd]   - Structured Data object (JSON-LD)
 */
export default function useSeoMeta({
  title,
  description,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  jsonLd = null,
}) {
  useEffect(() => {
    // ── Title ──────────────────────────────────────────────────────────────
    const prevTitle = document.title;
    document.title = title;

    // ── Meta helpers ───────────────────────────────────────────────────────
    const setMeta = (selector, attr, value) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        const [attrKey, attrVal] = attr.split('=');
        el.setAttribute(attrKey, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
      return el;
    };

    // ── Meta Description ───────────────────────────────────────────────────
    setMeta('meta[name="description"]', 'name=description', description);

    // ── Open Graph ─────────────────────────────────────────────────────────
    setMeta('meta[property="og:title"]',       'property=og:title',       title);
    setMeta('meta[property="og:description"]', 'property=og:description', description);
    setMeta('meta[property="og:type"]',        'property=og:type',        ogType);
    setMeta('meta[property="og:image"]',       'property=og:image',       ogImage);
    setMeta('meta[property="og:site_name"]',   'property=og:site_name',   SITE_NAME);
    if (canonical) {
      setMeta('meta[property="og:url"]', 'property=og:url', canonical);
    }

    // ── Twitter Card ───────────────────────────────────────────────────────
    setMeta('meta[name="twitter:card"]',        'name=twitter:card',        'summary_large_image');
    setMeta('meta[name="twitter:title"]',       'name=twitter:title',       title);
    setMeta('meta[name="twitter:description"]', 'name=twitter:description', description);
    setMeta('meta[name="twitter:image"]',       'name=twitter:image',       ogImage);

    // ── Canonical ──────────────────────────────────────────────────────────
    let canonicalEl = null;
    if (canonical) {
      canonicalEl = document.querySelector('link[rel="canonical"]');
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.rel = 'canonical';
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.href = canonical;
    }

    // ── JSON-LD Structured Data ────────────────────────────────────────────
    let jsonLdEl = null;
    if (jsonLd) {
      jsonLdEl = document.createElement('script');
      jsonLdEl.type = 'application/ld+json';
      jsonLdEl.id = 'seo-json-ld';
      // Remove stale tag if exists
      document.getElementById('seo-json-ld')?.remove();
      jsonLdEl.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(jsonLdEl);
    }

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      document.title = prevTitle;
      jsonLdEl?.remove();
    };
  }, [title, description, canonical, ogImage, ogType, jsonLd]);
}

export { BASE_URL, DEFAULT_OG_IMAGE, SITE_NAME };
