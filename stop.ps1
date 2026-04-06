$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidsFile  = Join-Path $ScriptDir ".server-pids"

function Info  { param($msg) Write-Host "[AutoStock] $msg" -ForegroundColor Green }
function Warn  { param($msg) Write-Host "[AutoStock] $msg" -ForegroundColor Yellow }

function Stop-ProcessTree {
    param([int]$ParentId, [string]$Name)
    # Kill child processes first
    Get-CimInstance Win32_Process -Filter "ParentProcessId = $ParentId" -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-ProcessTree -ParentId $_.ProcessId -Name $Name }
    try {
        Stop-Process -Id $ParentId -Force -ErrorAction Stop
    } catch { }
}

function Stop-PortProcess {
    param([int]$Port, [string]$Name)
    $listening = netstat -ano | Select-String ":$Port\s.*LISTENING"
    if ($listening) {
        $portPids = $listening | ForEach-Object {
            if ($_ -match "\s(\d+)\s*$") { [int]$Matches[1] }
        } | Sort-Object -Unique
        foreach ($p in $portPids) {
            try {
                Stop-Process -Id $p -Force -ErrorAction Stop
                Info "$Name (PID $p en puerto $Port) detenido."
            } catch {
                Warn "$Name (PID $p en puerto $Port) ya no estaba corriendo."
            }
        }
        return $true
    }
    return $false
}

$stopped = @{ Backend = $false; Frontend = $false }

# ── Intentar con PIDs guardados ───────────────────────────────────────────
if (Test-Path $PidsFile) {
    Get-Content $PidsFile | ForEach-Object {
        if ($_ -match "^(\w+)=(\d+)$") {
            $key = $Matches[1]
            $procId = [int]$Matches[2]
            $name = if ($key -eq "BACKEND_PID") { "Backend" } else { "Frontend" }
            if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
                Stop-ProcessTree -ParentId $procId -Name $name
                Info "$name (PID $procId) detenido."
                $stopped[$name] = $true
            }
        }
    }
    Remove-Item $PidsFile -Force
}

# ── Fallback: matar por puerto si aún escuchan ───────────────────────────
if (-not $stopped["Backend"])  { $null = Stop-PortProcess -Port 8765 -Name "Backend" }
if (-not $stopped["Frontend"]) { $null = Stop-PortProcess -Port 5500 -Name "Frontend" }

Info "Listo."
