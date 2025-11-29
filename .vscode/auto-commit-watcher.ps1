# Auto-Commit File Watcher für MyProSole
# Läuft im Hintergrund und überwacht Dateiänderungen

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$watcherPath = $workspaceRoot

Write-Host "🔍 Starte Auto-Commit Watcher für: $watcherPath" -ForegroundColor Cyan
Write-Host "Drücken Sie Strg+C zum Beenden" -ForegroundColor Yellow

# File System Watcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $watcherPath
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

# Verzögerung für Batch-Commits (wartet 2 Sekunden nach letzter Änderung)
$script:lastChange = Get-Date
$script:commitTimer = $null

# Commit-Script Pfad
$commitScript = Join-Path $PSScriptRoot "auto-commit.ps1"

# Funktion für Auto-Commit mit Verzögerung
function Invoke-DelayedCommit {
    param($changedFile)
    
    # Verzögern des Commits (wartet 2 Sekunden nach letzter Änderung)
    if ($script:commitTimer) {
        $script:commitTimer.Dispose()
    }
    
    $script:lastChange = Get-Date
    
    $script:commitTimer = New-Object System.Timers.Timer(2000) # 2 Sekunden
    $script:commitTimer.AutoReset = $false
    $script:commitTimer.Add_Elapsed({
        Write-Host "💾 Änderung erkannt, committe: $changedFile" -ForegroundColor Green
        & powershell -ExecutionPolicy Bypass -File $commitScript | Out-Null
        Write-Host "✅ Auto-Commit abgeschlossen" -ForegroundColor Green
        $script:commitTimer.Dispose()
    })
    $script:commitTimer.Start()
}

# Event Handler für Dateiänderungen
$action = {
    $path = $Event.SourceEventArgs.FullPath
    $changeType = $Event.SourceEventArgs.ChangeType
    $fileName = Split-Path $path -Leaf
    
    # Ignoriere .git und .vscode Verzeichnisse (um Endlosschleifen zu vermeiden)
    if ($path -match '\.git\\' -or $path -match '\.vscode\\auto-commit') {
        return
    }
    
    # Ignoriere temporäre Dateien
    if ($fileName -match '^~\$' -or $fileName -match '\.tmp$') {
        return
    }
    
    # Nur auf Changed/Changed Event reagieren (nicht auf Created/Deleted, da das bei Save passiert)
    if ($changeType -eq 'Changed') {
        Invoke-DelayedCommit -changedFile $fileName
    }
}

# Events registrieren
Register-ObjectEvent $watcher "Changed" -Action $action | Out-Null

Write-Host "✅ Watcher aktiv! Überwacht Dateiänderungen..." -ForegroundColor Green
Write-Host "📝 Speichern Sie eine Datei (Strg+S) und es wird automatisch committed & gepusht" -ForegroundColor Cyan

# Warte auf Benutzer-Unterbrechung
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    $watcher.EnableRaisingEvents = $false
    $watcher.Dispose()
    if ($script:commitTimer) {
        $script:commitTimer.Dispose()
    }
    Write-Host "`n👋 Watcher gestoppt" -ForegroundColor Yellow
}
