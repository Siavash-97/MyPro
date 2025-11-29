# Auto-Commit Konfiguration

## Funktionsweise

Bei jedem Speichern (Strg+S) werden automatisch:
1. Alle Änderungen zu Git hinzugefügt
2. Ein Commit mit Zeitstempel erstellt
3. Die Änderungen zu GitHub gepusht

## Setup

### Option 1: Mit "Run on Save" Extension (empfohlen)

1. Installieren Sie die Extension "Run on Save" in Cursor/VS Code
2. Die Konfiguration ist bereits in `.vscode/settings.json` vorhanden
3. Bei jedem Speichern wird automatisch committed und gepusht

### Option 2: Manuell testen

Sie können das Script auch manuell testen:
```powershell
powershell -ExecutionPolicy Bypass -File .vscode/auto-commit.ps1
```

## Konfiguration

- **Script**: `.vscode/auto-commit.ps1`
- **Settings**: `.vscode/settings.json`
- **Task**: `.vscode/tasks.json`
- **Extension**: `.vscode/extensions.json`

## Hinweis

Das Script prüft automatisch, ob Änderungen vorhanden sind. Wenn keine Änderungen vorliegen, wird nichts committed.
