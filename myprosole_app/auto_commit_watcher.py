#!/usr/bin/env python3
"""
File Watcher für automatisches Git-Commit
Überwacht Dateiänderungen und committet automatisch
"""
import subprocess
import sys
import os
import time
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class AutoCommitHandler(FileSystemEventHandler):
    """Handler für Dateiänderungen"""
    
    def __init__(self):
        self.last_commit_time = 0
        self.commit_delay = 2  # 2 Sekunden Verzögerung nach letzter Änderung
        
    def on_modified(self, event):
        """Wird aufgerufen wenn eine Datei geändert wird"""
        if event.is_directory:
            return
            
        # Ignoriere Git-Dateien und temporäre Dateien
        if any(ignore in event.src_path for ignore in ['.git', '__pycache__', '.pyc', '.vscode']):
            return
            
        # Nur Python-Dateien und wichtige Dateien
        if not event.src_path.endswith(('.py', '.json', '.md', '.txt', '.yml', '.yaml')):
            return
            
        current_time = time.time()
        
        # Warte kurz, um mehrere schnelle Änderungen zu bündeln
        if current_time - self.last_commit_time < self.commit_delay:
            return
            
        self.last_commit_time = current_time
        self.auto_commit(event.src_path)
    
    def auto_commit(self, file_path):
        """Führt automatisch git add und git commit aus"""
        try:
            # Prüfe ob wir in einem Git-Repository sind
            result = subprocess.run(
                ["git", "rev-parse", "--git-dir"],
                capture_output=True,
                text=True
            )
            if result.returncode != 0:
                return

            # Prüfe ob es Änderungen gibt
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                capture_output=True,
                text=True
            )
            
            if not result.stdout.strip():
                return

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
                print(f"✓ Auto-commit: {os.path.basename(file_path)} - {timestamp}")
            else:
                # Möglicherweise keine Änderungen oder andere Fehler
                pass
                
        except Exception as e:
            # Fehler stillschweigend ignorieren
            pass

def main():
    """Startet den File Watcher"""
    if len(sys.argv) > 1:
        watch_path = sys.argv[1]
    else:
        watch_path = os.getcwd()
    
    event_handler = AutoCommitHandler()
    observer = Observer()
    observer.schedule(event_handler, watch_path, recursive=True)
    observer.start()
    
    try:
        print(f"Auto-Commit Watcher gestartet für: {watch_path}")
        print("Drücken Sie Ctrl+C zum Beenden")
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\nAuto-Commit Watcher beendet")
    
    observer.join()

if __name__ == "__main__":
    main()


