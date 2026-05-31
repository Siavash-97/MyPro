# MyProSole launcher
# Starts the Streamlit app (if not already running) and opens it in the
# default browser exactly once. Idempotent: if the app is already running
# on port 8501 it simply opens the browser.

$ErrorActionPreference = 'Stop'

$AppDir  = 'C:\MyProSole\MyProSole\myprosole_app'
$Port    = 8501
$Url     = "http://localhost:$Port"
$TimeoutSeconds = 30

function Test-PortListening {
    param([int]$PortNumber)
    try {
        $conn = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction SilentlyContinue
        return [bool]$conn
    } catch {
        return $false
    }
}

function Test-AppResponding {
    param([string]$Address)
    try {
        $resp = Invoke-WebRequest -Uri $Address -UseBasicParsing -TimeoutSec 3
        return ($resp.StatusCode -eq 200)
    } catch {
        return $false
    }
}

try {
    Set-Location -Path $AppDir

    $alreadyRunning = Test-PortListening -PortNumber $Port

    if ($alreadyRunning) {
        Write-Host "Streamlit is already running on port $Port. Opening browser..." -ForegroundColor Green
    } else {
        Write-Host "Starting MyProSole (Streamlit) on port $Port..." -ForegroundColor Cyan

        $streamlitArgs = @(
            '-m', 'streamlit', 'run', 'app.py',
            '--server.port', "$Port",
            '--server.address', 'localhost',
            '--server.headless', 'true'
        )

        # Launch streamlit in its own window so it keeps running independently
        # of this launcher script and remains visible for logs.
        Start-Process -FilePath 'python' -ArgumentList $streamlitArgs -WorkingDirectory $AppDir | Out-Null

        Write-Host "Waiting for the app to become available (up to $TimeoutSeconds s)..." -ForegroundColor Cyan

        $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
        $ready = $false
        while ((Get-Date) -lt $deadline) {
            if (Test-AppResponding -Address $Url) {
                $ready = $true
                break
            }
            Start-Sleep -Milliseconds 750
        }

        if (-not $ready) {
            Write-Host "Warning: the app did not respond within $TimeoutSeconds seconds." -ForegroundColor Yellow
            Write-Host "Opening the browser anyway; it may take another moment to load." -ForegroundColor Yellow
        } else {
            Write-Host "App is up and responding." -ForegroundColor Green
        }
    }

    # Open the default browser exactly once.
    Start-Process $Url
    Write-Host "Browser opened to $Url" -ForegroundColor Green
}
catch {
    Write-Host "ERROR: Failed to start MyProSole." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}
