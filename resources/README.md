# App Icon / Logo — Branding

Replace these files to customize the app appearance:

## Files

| File | Format | Used For |
|------|--------|----------|
| `icon.png` | PNG 256×256+ | macOS, Linux, Electron window |
| `icon.ico` | ICO 256×256 | Windows installer, taskbar, shortcut |
| `icon.icns` | ICNS | macOS .app bundle |

## How to Replace

1. Design your logo (minimum 256×256, recommended 512×512)
2. Save as `icon.png` (PNG with transparency)
3. Convert to `icon.ico` for Windows:
   - Use https://convertio.co/png-ico/ or https://icoconvert.com/
   - Include sizes: 16, 32, 48, 128, 256
4. Convert to `icon.icns` for macOS (optional):
   - Use `iconutil` on macOS or online converters
5. Place all files in this `resources/` directory
6. Rebuild: `npm run build:electron`

## Current State

- `icon.png` — placeholder (blue gradient with white center)
- `icon.ico` — **NOT YET CREATED** — must be created from your final logo
- `icon.icns` — **NOT YET CREATED** — optional, for macOS builds

## Where Icons Appear

- **Windows installer** — uses `icon.ico`
- **Windows taskbar/shortcut** — uses `icon.ico`
- **Electron window title** — uses `icon.png`
- **macOS dock** — uses `icon.icns`
