# Auto-Commit Konfiguration

## Funktionsweise

Bei jedem Speichern (Strg+S) werden automatisch:
1. Alle Änderungen zu Git hinzugefügt
2. Ein Commit mit Zeitstempel erstellt
3. Die Änderungen zu GitHub gepusht

## Setup - NATIVE LÖSUNG (OHNE EXTENSION) ✨

### Option 1: Auto-Commit Watcher starten (EMPFOHLEN)

**Methode A: Doppelklick**
- Doppelklicken Sie auf `start-auto-commit.bat` im Hauptverzeichnis
- Das Fenster bleibt offen und überwacht alle Dateiänderungen
- Bei jedem Speichern (Strg+S) wird automatisch committed und gepusht
- Zum Beenden: Strg+C im Fenster drücken

**Methode B: Über VS Code Tasks**
1. Drücken Sie `Ctrl+Shift+P`
2. Wählen Sie "Tasks: Run Task"
3. Wählen Sie "Start Auto-Commit Watcher"
4. Das Terminal zeigt, dass der Watcher aktiv ist

**Methode C: PowerShell direkt**
```powershell
.\start-auto-commit.ps1
```

### Option 2: Mit "Run on Save" Extension (optional)

Falls Sie die Extension bevorzugen:
1. Installieren Sie die Extension "Run on Save" in Cursor/VS Code
2. Die Konfiguration ist bereits in `.vscode/settings.json` vorhanden
3. Bei jedem Speichern wird automatisch committed und gepusht

### Option 3: Manuell testen

Sie können das Script auch manuell testen:
```powershell
powershell -ExecutionPolicy Bypass -File .vscode/auto-commit.ps1
```

## Dateien

- **Watcher**: `.vscode/auto-commit-watcher.ps1` - Überwacht Dateiänderungen
- **Commit Script**: `.vscode/auto-commit.ps1` - Führt Commit & Push aus
- **Starter**: `start-auto-commit.ps1` / `start-auto-commit.bat` - Startet den Watcher
- **Settings**: `.vscode/settings.json` - VS Code Konfiguration
- **Tasks**: `.vscode/tasks.json` - VS Code Tasks

## Hinweise

- Der Watcher prüft automatisch, ob Änderungen vorhanden sind
- Es wird 2 Sekunden nach der letzten Änderung gewartet (Batch-Commits)
- `.git` und `.vscode/auto-commit` werden ignoriert (Endlosschleifen-Schutz)
- Der Watcher läuft im Hintergrund und zeigt Status-Meldungen an
