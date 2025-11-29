# Auto Commit Script für MyProSole
# Wird bei jedem Speichern (Strg+S) ausgeführt

$ErrorActionPreference = "SilentlyContinue"

# Ermittle das Workspace-Verzeichnis (Repository-Root)
$workspaceRoot = Split-Path -Parent $PSScriptRoot
Set-Location $workspaceRoot

# Prüfe, ob es Änderungen gibt
$status = git status --porcelain 2>&1

if ($status -and $LASTEXITCODE -eq 0) {
    # Git Konfiguration sicherstellen
    $gitUser = git config user.name
    $gitEmail = git config user.email
    
    if (-not $gitUser) {
        git config user.name "MyProEye-UG"
    }
    if (-not $gitEmail) {
        git config user.email "info@myproeye.de"
    }
    
    # Alle Änderungen hinzufügen
    git add . 2>&1 | Out-Null
    
    # Zeitstempel für Commit-Nachricht
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMessage = "Auto-save: $timestamp"
    
    # Commit erstellen
    $commitOutput = git commit -m $commitMessage 2>&1
    
    # Nur pushen wenn Commit erfolgreich war
    if ($LASTEXITCODE -eq 0) {
        # Push zu GitHub (im Hintergrund, keine Ausgabe)
        git push origin main 2>&1 | Out-Null
        
        # Kurze Erfolgsmeldung in Log
        Write-Output "✅ Auto-committed und gepusht: $timestamp"
    }
}
