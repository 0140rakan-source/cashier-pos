const { app, BrowserWindow, dialog, shell } = require('electron');
const { pathToFileURL } = require('url');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

// ─── Single Instance Lock ─────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) { app.quit(); process.exit(0); }

let mainWindow;
let backendProcess;

// ─── Paths ────────────────────────────────────────────────────────────────────
const IS_PACKAGED = app.isPackaged;
const EXE_DIR = path.dirname(app.getPath('exe'));
const APP_ROOT = IS_PACKAGED
  ? path.join(EXE_DIR, 'resources', 'app')
  : path.join(__dirname, '..');
const BACKEND_DIR = path.join(APP_ROOT, 'backend');
const BACKEND_NODE_MODULES = IS_PACKAGED
  ? path.join(EXE_DIR, 'resources', 'backend-modules')
  : path.join(BACKEND_DIR, 'node_modules');
const FRONTEND_DIST = path.join(APP_ROOT, 'frontend', 'dist');
const USER_DATA = app.getPath('userData');
const DATA_DIR = path.join(USER_DATA, 'data');
const UPLOADS_DIR = path.join(USER_DATA, 'uploads');
const BACKEND_ENV = path.join(APP_ROOT, 'backend', '.env');
const LOG_FILE = path.join(USER_DATA, 'app.log');

// ─── Ensure folders ───────────────────────────────────────────────────────────
[USER_DATA, DATA_DIR, UPLOADS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ─── Logging ──────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch(e) {}
  try { process.stdout.write(line); } catch(e) {}
}

process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

log('=== App starting ===');
log(`APP_ROOT: ${APP_ROOT}`);
log(`BACKEND_DIR: ${BACKEND_DIR}`);
log(`DATA_DIR: ${DATA_DIR}`);
log(`IS_PACKAGED: ${IS_PACKAGED}`);

// ─── Initialize Database from seed ───────────────────────────────────────────
function initDatabase() {
  const dbPath = path.join(DATA_DIR, 'accountant.db');
  if (fs.existsSync(dbPath)) {
    log('Database exists, skipping init');
    return true;
  }
  const seedPath = path.join(BACKEND_DIR, 'seed', 'seed.db');
  log(`Looking for seed: ${seedPath}`);
  if (!fs.existsSync(seedPath)) {
    log(`ERROR: Seed not found at ${seedPath}`);
    return false;
  }
  try {
    fs.copyFileSync(seedPath, dbPath);
    log(`Database created at: ${dbPath}`);
    return true;
  } catch (e) {
    log(`ERROR copying seed: ${e.message}`);
    return false;
  }
}

// ─── Setup node_modules junction ─────────────────────────────────────────────
function setupBackendModules() {
  if (!IS_PACKAGED) return;
  const target = path.join(BACKEND_DIR, 'node_modules');
  if (fs.existsSync(target)) { log('node_modules junction exists'); return; }
  if (!fs.existsSync(BACKEND_NODE_MODULES)) { log(`ERROR: source modules missing: ${BACKEND_NODE_MODULES}`); return; }
  try {
    fs.symlinkSync(BACKEND_NODE_MODULES, target, 'junction');
    log(`Junction created: ${target} -> ${BACKEND_NODE_MODULES}`);
  } catch (e) {
    log(`Junction failed (${e.message}), trying copy...`);
    try { fs.cpSync(BACKEND_NODE_MODULES, target, { recursive: true }); log('Copied node_modules'); }
    catch (e2) { log(`Copy also failed: ${e2.message}`); }
  }
}

// ─── Backend health check ─────────────────────────────────────────────────────
function waitForBackend(retries = 60, delay = 500) {
  return new Promise((resolve, reject) => {
    const check = (n) => {
      if (n <= 0) return reject(new Error('Backend did not start in time'));
      const req = http.get('http://localhost:3001/api/auth/license-status', (res) => {
        log(`Backend health: ${res.statusCode}`);
        resolve();
      });
      req.on('error', () => setTimeout(() => check(n - 1), delay));
      req.end();
    };
    check(retries);
  });
}

// ─── Start backend ───────────────────────────────────────────────────────────
function startBackend() {
  const nodeExe = process.execPath;
  const serverScript = path.join(BACKEND_DIR, 'src', 'server.js');
  log(`Starting backend: ${serverScript}`);

  if (!fs.existsSync(serverScript)) {
    log(`ERROR: Backend not found: ${serverScript}`);
    dialog.showErrorBox('Missing Backend', `Backend not found at:\n${serverScript}`);
    app.quit();
    return;
  }

  // Read .env values
  const envVars = {};
  if (fs.existsSync(BACKEND_ENV)) {
    const lines = fs.readFileSync(BACKEND_ENV, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) envVars[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    log(`Loaded .env from: ${BACKEND_ENV}`);
  }

  const dbPath = path.join(DATA_DIR, 'accountant.db');
  const env = {
    ...process.env,
    ...envVars,
    NODE_ENV: 'production',
    PORT: '3001',
    UPLOADS_DIR,
    DATABASE_URL: `file:${dbPath}`,
    NODE_PATH: BACKEND_NODE_MODULES,
    ELECTRON_RUN_AS_NODE: '1',
  };

  log(`DATABASE_URL: ${env.DATABASE_URL}`);
  log(`ACTIVATION_SECRET set: ${env.ACTIVATION_SECRET ? 'YES' : 'NO (using fallback)'}`);

  backendProcess = spawn(nodeExe, [serverScript], {
    cwd: BACKEND_DIR, env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout?.on('data', d => { try { log('[backend] ' + d.toString().trim()); } catch(e) {} });
  backendProcess.stderr?.on('data', d => { try { log('[backend ERR] ' + d.toString().trim()); } catch(e) {} });
  backendProcess.on('error', err => log('Backend process error: ' + err.message));
  backendProcess.on('exit', code => {
    log(`Backend exited: code ${code}`);
    if (code !== 0 && code !== null) {
      log(`Log file: ${LOG_FILE}`);
    }
  });
}

// ─── Create Window ───────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 1024, minHeight: 600,
    title: 'Accountant',
    icon: path.join(APP_ROOT, 'resources', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  const indexHtml = path.join(FRONTEND_DIST, 'index.html');
  log(`Loading frontend: ${indexHtml}`);

  if (!fs.existsSync(indexHtml)) {
    log(`ERROR: Frontend not found: ${indexHtml}`);
    dialog.showErrorBox('Missing Frontend', `Frontend not found:\n${indexHtml}`);
    app.quit();
    return;
  }

  const indexUrl = pathToFileURL(indexHtml).toString();
  log(`Loading URL: ${indexUrl}`);
  mainWindow.loadURL(indexUrl);

  // Capture renderer errors
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    log(`RENDERER did-fail-load: ${code} ${desc} url=${url}`);
  });
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) log(`RENDERER console[${level}]: ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    log(`RENDERER process-gone: ${JSON.stringify(details)}`);
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try { setupBackendModules(); } catch (e) { log('setupModules error: ' + e.message); }
  try { initDatabase(); } catch (e) { log('initDatabase error: ' + e.message); }

  startBackend();

  try {
    await waitForBackend(60, 500);
    log('Backend ready — launching window');
  } catch (e) {
    log('Backend timeout: ' + e.message + ' — launching window anyway');
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (backendProcess) backendProcess.kill();
});
