!macro customInstall
  DetailPrint "Configurando impresora virtual Imprimir Asadel..."
  
  ; Extraer temporalmente el script de instalación
  SetOutPath "$TEMP"
  File "${NSISDIR}\..\nsis\instalar_impresora.ps1"
  
  ; Ejecutar PowerShell oculto con permisos de Administrador
  nsExec::Exec 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$TEMP\instalar_impresora.ps1"'
  
  ; Borrar script temporal
  Delete "$TEMP\instalar_impresora.ps1"
!macroend

!macro customUnInstall
  DetailPrint "Eliminando impresora virtual Imprimir Asadel..."
  
  SetOutPath "$TEMP"
  File "${NSISDIR}\..\nsis\desinstalar_impresora.ps1"
  
  nsExec::Exec 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$TEMP\desinstalar_impresora.ps1"'
  
  Delete "$TEMP\desinstalar_impresora.ps1"
!macroend