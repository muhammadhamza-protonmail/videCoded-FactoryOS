const API_URL_STORAGE_KEY = 'factoryos_api_base_url';
const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:5000/api';

function normalizeApiBaseUrl(value) {
    const trimmed = String(value || '').trim().replace(/\/+$/, '');
    if (!trimmed) return DEFAULT_API_BASE_URL;
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

function getRuntimeApiBaseUrl() {
    if (typeof window === 'undefined') return DEFAULT_API_BASE_URL;

    const stored = window.localStorage.getItem(API_URL_STORAGE_KEY);
    return normalizeApiBaseUrl(stored || DEFAULT_API_BASE_URL);
}

function setRuntimeApiBaseUrl(value) {
    const normalized = normalizeApiBaseUrl(value);
    window.localStorage.setItem(API_URL_STORAGE_KEY, normalized);
    return normalized;
}

const API_BASE_URL = getRuntimeApiBaseUrl();
const API_ORIGIN = API_BASE_URL.endsWith('/api')
    ? API_BASE_URL.slice(0, -4)
    : API_BASE_URL;

export {
    API_BASE_URL,
    API_ORIGIN,
    DEFAULT_API_BASE_URL,
    getRuntimeApiBaseUrl,
    setRuntimeApiBaseUrl,
};
