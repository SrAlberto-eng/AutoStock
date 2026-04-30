$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidsFile  = Join-Path $ScriptDir ".server-pids"

function Info  { param($msg) Write-Host "[AutoStock] $msg" -ForegroundColor Green }
function Warn  { param($msg) Write-Host "[AutoStock] $msg" -ForegroundColor Yellow }
function Error { param($msg) Write-Host "[AutoStock] $msg" -ForegroundColor Red }

# ── Resolver Python (venv local tiene prioridad sobre PATH) ───────────────
$VenvPython = Join-Path $ScriptDir ".venv\Scripts\python.exe"
if (Test-Path $VenvPython) {
    $Python = $VenvPython
} else {
    $Python = "python"
    Warn "No se encontro .venv — usando python del sistema. Ejecuta: python -m venv .venv && .venv\Scripts\pip install -r backend\requirements.txt"
}

# ── Verificar puertos libres ───────────────────────────────────────────────
function Test-Port {
    param($port)
    $result = netstat -ano | Select-String ":$port\s.*LISTENING"
    return $null -ne $result
}

Info "Verificando puertos..."
if (Test-Port 8765) { Error "Puerto 8765 ya en uso. Ejecuta stop.ps1 primero."; exit 1 }
if (Test-Port 5500) { Error "Puerto 5500 ya en uso. Ejecuta stop.ps1 primero."; exit 1 }

# ── Arrancar backend ───────────────────────────────────────────────────────
Info "Arrancando backend (puerto 8765)..."
$backend = Start-Process $Python -ArgumentList "main.py" `
    -WorkingDirectory (Join-Path $ScriptDir "backend") `
    -PassThru -WindowStyle Minimized

# ── Arrancar frontend ──────────────────────────────────────────────────────
Info "Arrancando frontend (puerto 5500)..."
$frontend = Start-Process $Python -ArgumentList "-m", "http.server", "5500", "--bind", "127.0.0.1" `
    -WorkingDirectory (Join-Path $ScriptDir "frontend") `
    -PassThru -WindowStyle Minimized

# ── Guardar PIDs ───────────────────────────────────────────────────────────
"BACKEND_PID=$($backend.Id)`nFRONTEND_PID=$($frontend.Id)" | Set-Content $PidsFile

# ── Resumen ────────────────────────────────────────────────────────────────
Write-Host ""
Info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Info "  Backend  -> http://127.0.0.1:8765"
Info "  API docs -> http://127.0.0.1:8765/docs"
Info "  Frontend -> http://127.0.0.1:5500"
Info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Info "  PIDs: backend=$($backend.Id)  frontend=$($frontend.Id)"
Info "  Ejecuta stop.ps1 para detener ambos."
Write-Host ""
