# -*- coding: utf-8 -*-
"""Vorher-Haken auf Edit/Write/NotebookEdit: nur Pfade im UMFANG.

Was er tut
----------
Liest die Werkzeug-Eingabe von stdin (JSON), holt `tool_input.file_path` und
prueft ihn gegen `.claude/umfang.txt` - eine Zeile je erlaubtem Pfad oder
Muster (fnmatch, relativ zur Repo-Wurzel oder absolut). Passt nichts,
antwortet er mit `permissionDecision: "deny"`; das Werkzeug wird dann nicht
ausgefuehrt.

Was er NICHT tut
----------------
- Gibt es keine `umfang.txt`, laesst er alles durch. Der Haken haelt nur,
  waehrend ein Auftrag laeuft - und ein Auftrag beginnt damit, dass die
  Leitung den UMFANG in diese Datei schreibt, und endet damit, dass sie
  sie loescht.
- Er sieht nur Edit, Write und NotebookEdit. Bash kann weiterhin schreiben.
  Das ist die bekannte Grenze vom 04.09. (Schreibschutz); wer sie schliessen
  will, braucht das Dateisystem, nicht diesen Haken.
- Er urteilt nicht ueber Inhalt, nur ueber den Pfad.

Gepruefte Behauptung, nicht Zusicherung
---------------------------------------
Ob dieser Haken auf diesem Rechner greift, ist am 07.09.2026 gemessen worden:
ein absichtlicher Schreibversuch ausserhalb des UMFANGs muss abbrechen,
woertlich belegt. Steht das nicht im Bericht daneben, gilt er als ungeprueft.
"""
import fnmatch
import json
import os
import sys

WURZEL = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UMFANG = os.path.join(WURZEL, '.claude', 'umfang.txt')


def norm(p):
    return os.path.normcase(os.path.normpath(os.path.abspath(p))).replace('\\', '/')


def erlaubt(pfad, muster):
    ziel = norm(pfad)
    for m in muster:
        m = m.strip()
        if not m or m.startswith('#'):
            continue
        kandidat = m if os.path.isabs(m) else os.path.join(WURZEL, m)
        kandidat = norm(kandidat)
        if ziel == kandidat or fnmatch.fnmatch(ziel, kandidat):
            return True
        # Ein Verzeichnis im UMFANG erlaubt alles darunter.
        if ziel.startswith(kandidat.rstrip('/') + '/'):
            return True
    return False


def main():
    if not os.path.exists(UMFANG):
        return 0
    try:
        eingabe = json.load(sys.stdin)
    except Exception:
        return 0
    pfad = (eingabe.get('tool_input') or {}).get('file_path') or (eingabe.get('tool_input') or {}).get('notebook_path')
    if not pfad:
        return 0
    with open(UMFANG, encoding='utf-8') as f:
        muster = f.read().splitlines()
    if erlaubt(pfad, muster):
        return 0
    antwort = {
        'hookSpecificOutput': {
            'hookEventName': 'PreToolUse',
            'permissionDecision': 'deny',
            'permissionDecisionReason': 'Ausserhalb des UMFANGs (.claude/umfang.txt): ' + norm(pfad),
        },
    }
    sys.stdout.write(json.dumps(antwort))
    return 0


if __name__ == '__main__':
    sys.exit(main())
