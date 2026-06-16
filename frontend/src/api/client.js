import axios from 'axios';

function getDeviceFingerprint() {
  try {
    const ua = navigator.userAgent;
    const scr = String(window.screen.width) + 'x' + String(window.screen.height);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return btoa([ua, scr, tz].join('|')).slice(0, 64);
  } catch { return 'unknown'; }
}

// In production (Electron file:// protocol), use absolute localhost URL
// In dev (served via Vite proxy), use relative /api
const BASE_URL = (typeof window !== 'undefined' && window.location.protocol === 'file:')
  ? 'http://localhost:3001/api'
  : '/api';

const api = axios.create({
  baseURL: BASE_URL,
});

// Add token and device fingerprint to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['x-device-fingerprint'] = getDeviceFingerprint();
  return config;
});

export default api;
