# Startet den Auto-Commit Watcher
# Führen Sie dieses Script aus, um automatisches Committen bei jedem Speichern zu aktivieren

$watcherScript = Join-Path $PSScriptRoot ".vscode\auto-commit-watcher.ps1"

if (Test-Path $watcherScript) {
    Write-Host "🚀 Starte Auto-Commit Watcher..." -ForegroundColor Cyan
    Write-Host "⚠️  Lassen Sie dieses Fenster geöffnet für automatisches Committen" -ForegroundColor Yellow
    Write-Host ""
    
    & powershell -ExecutionPolicy Bypass -File $watcherScript
} else {
    Write-Host "❌ Watcher-Script nicht gefunden: $watcherScript" -ForegroundColor Red
    exit 1
}
