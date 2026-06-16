import React, { useState } from 'react';
import api from '../api/client';

function getDeviceFingerprint() {
  const ua = navigator.userAgent;
  const scr = String(window.screen.width) + 'x' + String(window.screen.height) + 'x' + String(window.screen.colorDepth);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const lang = navigator.language || '';
  const cores = navigator.hardwareConcurrency || 0;
  return btoa([ua, scr, tz, lang, cores].join('|')).slice(0, 64);
}

function generateRequestCode(fingerprint) {
  // Generate a shorter human-friendly request code from fingerprint
  const hash = fingerprint.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16);
  return hash.match(/.{1,4}/g).join('-');
}

function formatActivationCode(val) {
  const clean = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const parts = clean.match(/.{1,4}/g) || [];
  return parts.join('-').slice(0, 19);
}

function formatLicenseKey(val) {
  const clean = val.replace(/[^A-Z0-9]/g, '').toUpperCase();
  const parts = clean.match(/.{1,4}/g) || [];
  return parts.join('-').slice(0, 19);
}

const STYLES = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    padding: '24px',
    fontFamily: "'Segoe UI', 'Noto Sans Arabic', Arial, sans-serif",
    direction: 'rtl',
  },
  card: {
    background: '#ffffff',
    borderRadius: '24px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '480px',
  },
  iconWrap: {
    width: '80px',
    height: '80px',
    background: '#eff6ff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    fontSize: '36px',
  },
  h1: { fontSize: '26px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px', textAlign: 'center' },
  subtitle: { fontSize: '14px', color: '#64748b', margin: '0 0 28px', textAlign: 'center' },
  label: { display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px 16px',
    fontSize: '16px',
    fontFamily: 'monospace',
    letterSpacing: '2px',
    textAlign: 'center',
    background: '#f8fafc',
    color: '#0f172a',
    outline: 'none',
    direction: 'ltr',
    marginBottom: '16px',
  },
  requestCodeBox: {
    background: '#f0f9ff',
    border: '2px solid #bae6fd',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '20px',
    textAlign: 'center',
  },
  requestCodeLabel: { fontSize: '13px', color: '#0369a1', fontWeight: '600', marginBottom: '8px', display: 'block' },
  requestCodeValue: {
    fontSize: '20px', fontFamily: 'monospace', fontWeight: '700', letterSpacing: '3px',
    color: '#0c4a6e', direction: 'ltr', userSelect: 'all', cursor: 'text',
  },
  copyBtn: {
    marginTop: '10px', padding: '6px 16px', background: '#0284c7', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  errorBox: {
    background: '#fef2f2',
    border: '1.5px solid #fecaca',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '16px',
  },
  errorText: { fontSize: '14px', color: '#dc2626', fontWeight: '500', margin: 0 },
  primaryBtn: {
    width: '100%',
    padding: '16px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '17px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  disabledBtn: { background: '#93c5fd', cursor: 'not-allowed' },
  successBox: {
    background: '#f0fdf4',
    border: '2px solid #22c55e',
    borderRadius: '16px',
    padding: '24px',
    textAlign: 'center',
  },
  tabs: {
    display: 'flex', gap: '8px', marginBottom: '24px',
  },
  tab: {
    flex: 1, padding: '10px', border: '2px solid #e2e8f0', borderRadius: '10px',
    background: '#f8fafc', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    textAlign: 'center', fontFamily: 'inherit', color: '#475569',
  },
  tabActive: {
    flex: 1, padding: '10px', border: '2px solid #2563eb', borderRadius: '10px',
    background: '#eff6ff', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    textAlign: 'center', fontFamily: 'inherit', color: '#2563eb',
  },
  spinner: {
    width: '18px', height: '18px',
    border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
    marginLeft: '8px',
  },
};

export default function ActivationScreen() {
  const [mode, setMode] = useState('offline'); // 'offline' | 'license'
  const [activationCode, setActivationCode] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deviceMismatch, setDeviceMismatch] = useState(false);

  const fingerprint = getDeviceFingerprint();
  const requestCode = generateRequestCode(fingerprint);

  const copyRequestCode = () => {
    navigator.clipboard?.writeText(requestCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Offline activation
  const handleOfflineActivate = async (e) => {
    e.preventDefault();
    const code = activationCode.trim();
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/offline-activate', {
        requestCode,
        activationCode: code,
        deviceFingerprint: fingerprint,
      });
      localStorage.setItem('license_activated', 'true');
      localStorage.setItem('activation_mode', 'offline');
      setSuccess(true);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('تعذر الاتصال بالخادم. تأكد من تشغيل التطبيق / Server not reachable');
      } else {
        setError('فشل التفعيل — حاول مرة أخرى');
      }
    } finally {
      setLoading(false);
    }
  };

  // License key activation (legacy)
  const handleLicenseActivate = async (e) => {
    e.preventDefault();
    const key = licenseKey.trim().toUpperCase();
    if (!key) return;
    setLoading(true);
    setError('');
    setDeviceMismatch(false);
    try {
      await api.post('/auth/activate', { licenseKey: key, deviceFingerprint: fingerprint });
      localStorage.setItem('license_activated', 'true');
      localStorage.setItem('activation_mode', 'license');
      setSuccess(true);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      const code = err.response?.data?.code || '';
      const msg = err.response?.data?.message || 'فشل التفعيل';
      if (code === 'DEVICE_ALREADY_BOUND') {
        setDeviceMismatch(true);
        setError('هذا المفتاح مفعل على جهاز آخر.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceActivate = async () => {
    setLoading(true);
    try {
      await api.post('/auth/force-activate', { licenseKey: licenseKey.trim().toUpperCase(), deviceFingerprint: fingerprint });
      localStorage.setItem('license_activated', 'true');
      setSuccess(true);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'فشل النقل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={STYLES.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={STYLES.card}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={STYLES.iconWrap}>🔐</div>
          <h1 style={STYLES.h1}>تفعيل Accountant</h1>
          <p style={STYLES.subtitle}>Accountant Activation</p>
        </div>

        {/* Success */}
        {success ? (
          <div style={STYLES.successBox}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <p style={{ fontSize: '18px', fontWeight: '700', color: '#15803d', margin: '0 0 4px' }}>
              تم التفعيل بنجاح!
            </p>
            <p style={{ fontSize: '13px', color: '#16a34a', margin: 0 }}>جاري تحميل النظام...</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div style={STYLES.tabs}>
              <button
                type="button"
                style={mode === 'offline' ? STYLES.tabActive : STYLES.tab}
                onClick={() => { setMode('offline'); setError(''); }}
              >
                📴 تفعيل بدون إنترنت
              </button>
              <button
                type="button"
                style={mode === 'license' ? STYLES.tabActive : STYLES.tab}
                onClick={() => { setMode('license'); setError(''); }}
              >
                🔑 مفتاح ترخيص
              </button>
            </div>

            {mode === 'offline' ? (
              /* ─── Offline Activation ─── */
              <form onSubmit={handleOfflineActivate}>
                {/* Step 1: Request Code */}
                <div style={STYLES.requestCodeBox}>
                  <span style={STYLES.requestCodeLabel}>١. رمز الطلب — أرسل هذا الرمز للبائع</span>
                  <div style={STYLES.requestCodeValue}>{requestCode}</div>
                  <button type="button" style={STYLES.copyBtn} onClick={copyRequestCode}>
                    {copied ? '✓ تم النسخ' : '📋 نسخ الرمز'}
                  </button>
                </div>

                {/* Step 2: Enter Activation Code */}
                <label style={STYLES.label}>٢. أدخل رمز التفعيل المستلم من البائع</label>
                <input
                  type="text"
                  value={activationCode}
                  onChange={e => setActivationCode(formatActivationCode(e.target.value))}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  style={{ ...STYLES.input, ...(error ? { border: '2px solid #ef4444' } : {}) }}
                />

                {/* Error */}
                {error && (
                  <div style={STYLES.errorBox}>
                    <p style={STYLES.errorText}>⚠️ {error}</p>
                  </div>
                )}

                {/* Activate Button */}
                <button
                  type="submit"
                  disabled={loading || !activationCode.trim()}
                  style={{
                    ...STYLES.primaryBtn,
                    ...((loading || !activationCode.trim()) ? STYLES.disabledBtn : {}),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  {loading && <span style={STYLES.spinner} />}
                  {loading ? 'جاري التفعيل...' : 'تفعيل النظام'}
                </button>
              </form>
            ) : (
              /* ─── License Key Activation ─── */
              <form onSubmit={handleLicenseActivate}>
                <label style={STYLES.label}>مفتاح الترخيص / License Key</label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={e => setLicenseKey(formatLicenseKey(e.target.value))}
                  placeholder="CLAW-YYYY-XXXX-XXXX"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  style={{ ...STYLES.input, ...(error && !deviceMismatch ? { border: '2px solid #ef4444' } : {}) }}
                />

                {error && (
                  <div style={STYLES.errorBox}>
                    <p style={STYLES.errorText}>⚠️ {error}</p>
                    {deviceMismatch && (
                      <button
                        type="button"
                        onClick={handleForceActivate}
                        disabled={loading}
                        style={{ marginTop: '10px', width: '100%', padding: '10px', background: '#ea580c', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {loading ? 'جاري النقل...' : 'نقل الرخصة لهذا الجهاز'}
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !licenseKey.trim()}
                  style={{
                    ...STYLES.primaryBtn,
                    ...((loading || !licenseKey.trim()) ? STYLES.disabledBtn : {}),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  {loading && !deviceMismatch && <span style={STYLES.spinner} />}
                  {loading && !deviceMismatch ? 'جاري التفعيل...' : 'تفعيل بمفتاح الترخيص'}
                </button>
              </form>
            )}

            {/* Device Info */}
            <div style={{ marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', direction: 'ltr' }}>
                Device: {fingerprint.slice(0, 24)}...
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
