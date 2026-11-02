$ErrorActionPreference = "SilentlyContinue"

$printerName = "Imprimir Asadel"
$folderPath = "C:\AsadelPOS\BuzonImpresiones"
$portName = "$folderPath\salida_virtual.pdf"
$driverName = "Microsoft Print to PDF"

# 1. Crear carpeta destino si no existe
if (-not (Test-Path -Path $folderPath)) {
    New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
}

# 2. Registrar el puerto local si no existe
$puertoExiste = Get-PrinterPort -Name $portName
if (-not $puertoExiste) {
    Add-PrinterPort -Name $portName
}

# 3. Registrar la impresora si no existe
$impresoraExiste = Get-Printer -Name $printerName
if (-not $impresoraExiste) {
    Add-Printer -Name $printerName -DriverName $driverName -PortName $portName
}

# 4. Asegurar procesador de impresión rápido (winprint)
Set-Printer -Name $printerName -PrintProcessor "winprint"