# Cashier POS — Installation Guide / دليل التثبيت

## Windows Installation (Customer)

### Prerequisites
1. Windows 10/11 (64-bit)
2. PostgreSQL 15+ installed and running
3. Node.js 20+ (included in installer if using Electron build)

### Option A: Electron Installer (Recommended)
1. Run the `.exe` installer from the delivery USB or download link
2. Follow the installation wizard
3. Launch "Cashier POS" from desktop shortcut
4. The app will start the backend automatically

### Option B: Manual Installation
1. Extract the cashier-pos folder to `C:\CashierPOS\`
2. Open Command Prompt as Administrator
3. Run:
   ```
   cd C:\CashierPOS
   setup-windows.bat
   ```
4. To start the app:
   ```
   start-windows.bat
   ```

### Database Setup
```sql
CREATE DATABASE cashier_db;
```
Edit `.env` file:
```
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/cashier_db"
```

Then run migrations:
```
cd backend
npx prisma migrate deploy
node prisma/seed.js
```

### Activation
1. Open the app — you'll see the activation screen
2. Choose "تفعيل بدون إنترنت" (Offline Activation)
3. Copy the **Request Code** and send it to the vendor
4. Enter the **Activation Code** you receive from the vendor
5. The app activates and binds to your device

### Default Login
- **Admin:** username `admin`, password `admin123`
- **Cashier:** username `cashier`, password `1234`

⚠️ Change these passwords immediately after first login!

---

## Development Setup (macOS)

```bash
# Install dependencies
cd cashier-pos
npm install
cd backend && npm install
cd ../frontend && npm install
cd ..

# Setup database
cd backend
cp .env.example .env  # Edit DATABASE_URL
npx prisma migrate deploy
node prisma/seed.js

# Run dev servers
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3001

## Building for Windows

```bash
# Build frontend
npm run build:frontend

# Build Electron app for Windows
npm run build:electron
```

The installer will be in `dist-electron/`.

## Offline Activation — Vendor Tool

To generate activation codes for customers:

```bash
node scripts/generate-activation.js <CUSTOMER_REQUEST_CODE>
```

Keep this tool and the `ACTIVATION_SECRET` private.
