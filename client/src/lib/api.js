const DEFAULT_API_BASE_URL = 'https://api.dagathomo.online';
const DEFAULT_SITE_BASE_URL = 'https://dagathomo.online';

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
}

export function apiUrl(path = '') {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${baseUrl}${normalizedPath}`;
}

export function assetUrl(path = '') {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return apiUrl(path);
}

export function getSiteBaseUrl() {
  return import.meta.env.VITE_SITE_URL || DEFAULT_SITE_BASE_URL;
}
