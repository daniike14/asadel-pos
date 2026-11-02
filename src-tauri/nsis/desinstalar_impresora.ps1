$ErrorActionPreference = "SilentlyContinue"

$printerName = "Imprimir Asadel"
$portName = "C:\AsadelPOS\BuzonImpresiones\salida_virtual.pdf"

# Eliminar impresora
Remove-Printer -Name $printerName

# Eliminar puerto local
Remove-PrinterPort -Name $portName