# Auto-Commit Setup

## Übersicht
Diese Konfiguration ermöglicht automatisches Git-Commit bei jedem Speichern (Strg+S) in VS Code.

## Installation

### 1. VS Code Extension installieren (Optional, aber empfohlen)
Installieren Sie die Extension "Run on Save" von emeraldwalk:
- Öffnen Sie VS Code
- Gehen Sie zu Extensions (Strg+Shift+X)
- Suchen Sie nach "Run on Save"
- Installieren Sie die Extension

### 2. Automatische Konfiguration
Die folgenden Dateien wurden bereits erstellt:
- `auto_commit.py` - Script für automatisches Committen
- `.vscode/settings.json` - VS Code Einstellungen
- `.vscode/tasks.json` - Task-Definition
- `.vscode/keybindings.json` - Keyboard Shortcut Konfiguration

## Funktionsweise

### Option 1: Mit Keyboard Shortcut (Standard)
Wenn Sie **Strg+S** drücken:
1. Die Datei wird gespeichert
2. Automatisch wird `auto_commit.py` ausgeführt
3. Alle Änderungen werden gestaged und committed

### Option 2: Mit "Run on Save" Extension
Wenn Sie die Extension installiert haben, wird das Script automatisch bei jedem Speichern ausgeführt.

## Manuelle Ausführung
Sie können das Script auch manuell ausführen:
```bash
python auto_commit.py
```

## Commit-Nachrichten
Die Commit-Nachrichten werden automatisch mit einem Timestamp erstellt:
```
Auto-commit: 2024-01-15 14:30:45
```

## Hinweise
- Das Script committet nur, wenn es Änderungen gibt
- Fehler werden stillschweigend ignoriert
- Alle geänderten Dateien werden automatisch gestaged (`git add -A`)

## Deaktivieren
Um Auto-Commit zu deaktivieren, entfernen Sie einfach die Datei `.vscode/keybindings.json` oder kommentieren Sie den Eintrag aus.


