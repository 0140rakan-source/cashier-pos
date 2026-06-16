# 🖥️ Windows Build Handoff — Cashier POS

## Current State (Verified on macOS)

| Item | Status | Notes |
|------|--------|-------|
| SQLite database | ✅ | `data/cashier.db` — no PostgreSQL needed |
| Backend starts on SQLite | ✅ | Tested, all APIs work |
| Frontend builds | ✅ | 0 errors, 471KB |
| Offline activation | ✅ | Request Code → Activation Code flow works |
| Fresh-install script | ✅ | Seeds roles, admin, store identity |
| Electron main.js | ✅ | Starts backend, loads frontend, health check |
| electron-builder config | ✅ | NSIS installer, x64 |
| Vendor activation tool | ✅ | `vendor-tools/activation-generator.html` |

---

## ❌ ONE THING STILL NEEDED: App Icon

The Windows installer requires `resources/icon.ico`.

**Current state:**
- `resources/icon.png` exists (placeholder, 256×256)
- `resources/icon.ico` **DOES NOT EXIST YET**

**What to do:**
1. Design your final logo (minimum 256×256, ideally 512×512)
2. Save as `resources/icon.png`
3. Convert to `resources/icon.ico` using:
   - https://convertio.co/png-ico/
   - https://icoconvert.com/
   - Include sizes: 16×16, 32×32, 48×48, 128×128, 256×256
4. Place both `icon.png` and `icon.ico` in `resources/`

Without `icon.ico`, electron-builder will either fail or use a default icon.

---

## 📁 Project Structure for Windows Build

```
cashier-pos/
├── backend/              # Node.js API server
│   ├── prisma/           # SQLite schema
│   ├── src/              # Backend source code
│   ├── .env              # DATABASE_URL="file:../../data/cashier.db"
│   └── .env.example      # Template for new installs
├── frontend/             # React + Vite
│   ├── src/              # Frontend source
│   └── dist/             # Built frontend (created by vite build)
├── electron/
│   └── main.js           # Electron entry — starts backend + loads frontend
├── data/
│   ├── cashier.db        # SQLite database file
│   └── .gitkeep
├── uploads/              # Store logo, receipts
├── resources/
│   ├── icon.png          # App icon (placeholder)
│   ├── icon.ico          # ⚠️ NEEDED — Windows icon
│   ├── installer.nsh     # NSIS customization
│   └── README.md         # Icon replacement guide
├── scripts/
│   ├── fresh-install.js  # New customer deployment
│   └── generate-activation.js  # CLI activation generator
├── vendor-tools/
│   └── activation-generator.html  # Vendor-only web tool
├── package.json          # Electron + electron-builder config
├── setup-windows.bat     # Customer machine setup
├── start-windows.bat     # Launch app
└── build-installer.bat   # Build Windows installer
```

---

## 🔨 Exact Windows Build Steps

Run these on a Windows machine with Node.js 20+ installed.

### Step 1: Install dependencies

```cmd
cd cashier-pos
npm install
cd backend
npm install --production
cd ..\frontend
npm install
cd ..
```

### Step 2: Setup environment

```cmd
:: .env should already exist. If not:
copy backend\.env.example backend\.env
```

Verify `backend\.env` contains:
```
DATABASE_URL="file:../../data/cashier.db"
JWT_SECRET="some-random-string"
PORT=3001
NODE_ENV=production
```

### Step 3: Generate Prisma client

```cmd
cd backend
npx prisma generate
npx prisma db push --accept-data-loss
cd ..
```

### Step 4: Initialize fresh database

```cmd
node scripts/fresh-install.js --store "اسم المتجر" --reset-db
```

### Step 5: Build frontend

```cmd
cd frontend
npx vite build
cd ..
```

### Step 6: Test locally before building installer

```cmd
npx electron .
```

The app should:
- Start backend automatically
- Show activation screen (if not activated)
- Work fully after activation

### Step 7: Build Windows installer

```cmd
npx electron-builder --win --x64
```

Or use the batch script:
```cmd
build-installer.bat
```

### Step 8: Find the installer

```
dist-electron/
├── Cashier POS Setup 1.0.0.exe    ← NSIS installer
└── win-unpacked/                   ← Portable version
```

---

## 🔐 Offline Activation Flow

### For each new customer:

1. **Customer** installs the app and sees the activation screen
2. **Customer** sends you their **Request Code** (shown on screen, e.g. `TUZV-AMLY-DFLB-TWFU`)
3. **You (vendor)** open `vendor-tools/activation-generator.html` in your browser
4. **You** paste the Request Code → get **Activation Code**
5. **You** send the Activation Code to the customer
6. **Customer** enters the Activation Code → app activates

### Vendor tools (keep these private, never give to customer):
- `vendor-tools/activation-generator.html` — open in any browser, works offline
- `node scripts/generate-activation.js TUZV-AMLY-DFLB-TWFU` — CLI alternative

### What binds activation to a device:
- Request Code is derived from device fingerprint (hardware, screen, OS)
- Activation Code is HMAC of Request Code with a secret
- The secret is embedded in the backend, NOT in the frontend
- Different device = different Request Code = different Activation Code

---

## 🏪 Deploying to a New Customer

### Before delivery:

```cmd
node scripts/fresh-install.js --store "اسم المتجر الجديد" --vat "300999888777001" --phone "05xxxxxxxx" --reset-db
```

This:
- Wipes all data (sales, products, shifts, everything)
- Creates fresh admin account (admin / admin123)
- Sets new store identity
- Clears old activation (customer must re-activate)
- Resets channels to default

### After delivery:
- Customer runs the app
- Customer sees activation screen → sends you Request Code
- You generate Activation Code → customer activates
- Customer changes admin password
- Customer starts adding products and selling

---

## 💾 Backup & Restore

### Backup:
```cmd
:: Stop the app first, then:
copy data\cashier.db data\cashier_backup_%date%.db
```

### Restore:
```cmd
:: Stop the app first, then:
copy data\cashier_backup_XXXX.db data\cashier.db
```

The entire database is one file (~250KB empty, grows with usage).

---

## ✅ Post-Build Test Checklist

Run these tests on Windows after installing from the built .exe:

### Installation
- [ ] Installer runs without errors
- [ ] App shortcut appears on Desktop
- [ ] App shortcut appears in Start Menu
- [ ] App icon is visible (not default Electron icon)

### First Launch
- [ ] App opens without crash
- [ ] Activation screen appears
- [ ] Request Code is displayed
- [ ] Request Code can be copied

### Activation
- [ ] Generate Activation Code using vendor tool
- [ ] Enter Activation Code in app
- [ ] App shows "تم التفعيل بنجاح"
- [ ] App reloads to login screen

### Login
- [ ] Login with admin / admin123
- [ ] Dashboard/home loads

### Core POS Flow
- [ ] Open shift (starting cash: 100)
- [ ] Create a category
- [ ] Create a product (with barcode, price, stock)
- [ ] Add product to cart in POS
- [ ] Complete a cash sale
- [ ] Receipt displays correctly
- [ ] Return to POS works after sale

### Settings
- [ ] Store name/info editable
- [ ] Logo upload works
- [ ] Order channels manageable
- [ ] Typing in inputs does NOT lose focus

### Reports
- [ ] Day-close report shows correct totals
- [ ] Cash + Card = Grand Total
- [ ] By-cashier report works
- [ ] By-channel report works

### Data Integrity
- [ ] Close shift — expected cash matches
- [ ] Re-open app — data persists (SQLite)
- [ ] Backup: copy data\cashier.db → works
- [ ] Restore: replace data\cashier.db → data returns

### Edge Cases
- [ ] Wrong activation code → rejected with Arabic message
- [ ] Delete user with history → deactivated, not crashed
- [ ] Product archive vs hard delete both work
- [ ] App works fully offline (no internet needed)

---

## 📋 Summary

| What | Done by you (Claw) | Done by Rakan on Windows |
|------|-------|---------|
| SQLite schema | ✅ | — |
| Backend code | ✅ | — |
| Frontend code | ✅ | — |
| Electron main.js | ✅ | — |
| electron-builder config | ✅ | — |
| NSIS installer config | ✅ | — |
| Activation flow | ✅ | — |
| Vendor activation tool | ✅ | — |
| Fresh-install script | ✅ | — |
| .env configuration | ✅ | — |
| Windows build scripts | ✅ | — |
| **App icon (icon.ico)** | ❌ placeholder only | **Create from your logo** |
| **npm install on Windows** | — | **Run on Windows** |
| **electron-builder --win** | — | **Run on Windows** |
| **Test on real Windows** | — | **Test with checklist above** |
