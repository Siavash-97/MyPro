#!/usr/bin/env python3
"""
Automatisches Git-Commit Script
Wird bei jedem Speichern (Strg+S) ausgeführt
"""
import subprocess
import sys
import os
from datetime import datetime

def auto_commit():
    """Führt automatisch git add und git commit aus"""
    try:
        # Prüfe ob wir in einem Git-Repository sind
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            # Kein Git-Repository - das ist ok
            return True

        # Prüfe ob es Änderungen gibt
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True
        )
        
        if not result.stdout.strip():
            # Keine Änderungen - das ist ok
            return True

        # Stage alle Änderungen
        subprocess.run(
            ["git", "add", "-A"],
            check=True,
            capture_output=True
        )

        # Commit mit Timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        commit_message = f"Auto-commit: {timestamp}"
        
        result = subprocess.run(
            ["git", "commit", "-m", commit_message],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print(f"✓ Auto-commit: {commit_message}")
        else:
            # Möglicherweise keine Änderungen - das ist ok
            pass
        
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"Fehler beim Auto-Commit: {e}")
        return False
    except Exception as e:
        print(f"Unerwarteter Fehler: {e}")
        return False

if __name__ == "__main__":
    success = auto_commit()
    sys.exit(0 if success else 1)

