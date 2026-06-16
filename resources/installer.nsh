; Cashier POS — NSIS Installer Customization
; This file is included by electron-builder during Windows installer creation

!macro customHeader
  !system "echo Custom NSIS header loaded"
!macroend

!macro preInit
  ; Set default install directory
  SetRegView 64
  WriteRegStr HKLM "Software\CashierPOS" "InstallPath" "$INSTDIR"
!macroend

!macro customInstall
  ; Create data directory for database
  CreateDirectory "$INSTDIR\data"
  CreateDirectory "$INSTDIR\uploads"

  ; Copy .env template if not exists
  IfFileExists "$INSTDIR\backend\.env" +2 0
    CopyFiles "$INSTDIR\backend\.env.example" "$INSTDIR\backend\.env"
!macroend

!macro customUnInstall
  ; Clean up registry
  DeleteRegKey HKLM "Software\CashierPOS"
!macroend
