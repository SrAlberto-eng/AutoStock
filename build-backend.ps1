<#
.SYNOPSIS
    Compila el backend de AutoStock con PyInstaller y copia el resultado
    al directorio de binarios de Tauri con el nombre de triple correcto.

.DESCRIPTION
    Tauri v2 busca el sidecar como:
      src-tauri/binaries/autostock-backend-<target-triple>.exe

    El resto del directorio onedir (DLLs, _internal/, etc.) se coloca
    junto al exe para que Tauri lo incluya en el bundle.

.PARAMETER Clean
    Eliminar dist/ anterior antes de compilar.

.PARAMETER NoCopy
    Solo compilar, no copiar a src-tauri/binaries/.

.EXAMPLE
    .\build-backend.ps1 -Clean
    .\build-backend.ps1 -NoCopy
#>

param(
    [switch]$Clean,
    [switch]$NoCopy
)

$ErrorActionPreference = "Stop"

$Root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$DistDir    = Join-Path $BackendDir "dist" "autostock-backend"
$BinDir     = Join-Path $Root "src-tauri" "binaries"

# ── Resolver Python del venv ──────────────────────────────────────────────────
$VenvPython  = Join-Path $Root ".venv" "Scripts" "python.exe"
$VenvPip     = Join-Path $Root ".venv" "Scripts" "pip.exe"
$PyInstaller = Join-Path $Root ".venv" "Scripts" "pyinstaller.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Error "No se encontró .venv\Scripts\python.exe. Crea el entorno: python -m venv .venv"
}

# ── Instalar PyInstaller si no está disponible ────────────────────────────────
if (-not (Test-Path $PyInstaller)) {
    Write-Host "[build] Instalando PyInstaller en el venv..." -ForegroundColor Cyan
    & $VenvPip install pyinstaller --quiet
    if ($LASTEXITCODE -ne 0) { Write-Error "No se pudo instalar PyInstaller." }
}

# ── Limpiar dist anterior ─────────────────────────────────────────────────────
if ($Clean) {
    $BuildDir = Join-Path $BackendDir "build"
    if (Test-Path $DistDir)  { Remove-Item -Recurse -Force $DistDir;  Write-Host "[build] Limpiado: dist/"  -ForegroundColor Yellow }
    if (Test-Path $BuildDir) { Remove-Item -Recurse -Force $BuildDir; Write-Host "[build] Limpiado: build/ (fuerza recompilación del PYZ)" -ForegroundColor Yellow }
}

# ── Compilar ──────────────────────────────────────────────────────────────────
Write-Host "[build] Compilando con PyInstaller..." -ForegroundColor Cyan
Push-Location $BackendDir
try {
    & $PyInstaller backend.spec --noconfirm
    if ($LASTEXITCODE -ne 0) { Write-Error "PyInstaller falló con código $LASTEXITCODE" }
} finally {
    Pop-Location
}

Write-Host "[build] Compilación exitosa: $DistDir" -ForegroundColor Green

if ($NoCopy) {
    Write-Host "[build] -NoCopy: omitiendo copia a src-tauri/binaries/" -ForegroundColor Yellow
    exit 0
}

# ── Detectar target triple de Rust ────────────────────────────────────────────
$RustcAvailable = $null
try { $RustcAvailable = Get-Command rustc -ErrorAction Stop } catch {}

if ($RustcAvailable) {
    $RustcOutput  = rustc -vV 2>&1
    $TargetLine   = ($RustcOutput | Select-String "host:").ToString()
    $TargetTriple = ($TargetLine -split "host:\s*")[1].Trim()
} else {
    Write-Warning "rustc no encontrado. Usando triple por defecto."
    $TargetTriple = "x86_64-pc-windows-msvc"
}

Write-Host "[build] Target triple: $TargetTriple" -ForegroundColor Cyan

# ── Copiar onedir a src-tauri/binaries/ ──────────────────────────────────────
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
    Write-Host "[build] Creado directorio: src-tauri/binaries/" -ForegroundColor Cyan
}

Write-Host "[build] Copiando archivos a src-tauri/binaries/..." -ForegroundColor Cyan
Get-ChildItem -Path $DistDir | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination (Join-Path $BinDir $_.Name) -Recurse -Force
}

# ── Renombrar exe con target triple ──────────────────────────────────────────
$ExeOrig = Join-Path $BinDir "autostock-backend.exe"
$ExeDest = Join-Path $BinDir "autostock-backend-$TargetTriple.exe"

if (-not (Test-Path $ExeOrig)) {
    Write-Error "No se encontró $ExeOrig. Verifica la compilación de PyInstaller."
}

if (Test-Path $ExeDest) { Remove-Item -Force $ExeDest }
Rename-Item -Path $ExeOrig -NewName "autostock-backend-$TargetTriple.exe"

Write-Host ""
Write-Host "[build] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "[build]  Backend compilado y copiado exitosamente"         -ForegroundColor Green
Write-Host "[build]  Binario: src-tauri/binaries/autostock-backend-$TargetTriple.exe" -ForegroundColor Green
Write-Host "[build] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
Write-Host "[build] Para probar el sidecar de forma aislada:" -ForegroundColor DarkCyan
Write-Host "        src-tauri\binaries\autostock-backend-$TargetTriple.exe" -ForegroundColor DarkCyan
Write-Host "        GET http://127.0.0.1:8765/health" -ForegroundColor DarkCyan
