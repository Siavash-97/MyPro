# Verbindliche Repository-Regeln

Vor jeder Änderung muss
[`docs/DEVELOPMENT_STANDARDS.md`](docs/DEVELOPMENT_STANDARDS.md) vollständig
gelesen und befolgt werden. Die dort beschriebenen Sicherheits-, Datenschutz-,
Datenbank-, Architektur-, Test- und Definition-of-Done-Regeln gelten für
`project-planner` und `myprosole_app` sowie für jede Änderung durch Menschen,
Agenten, IDEs oder KI-Modelle.

Zusätzlich gilt:

- Jede verhaltensrelevante Codeänderung benötigt einen fokussierten Unit-Test.
- Jeder sichtbare User-Flow oder modulübergreifende Ablauf benötigt einen
  automatisierten Workflow-/Integrationstest.
- Vor einer Übergabe muss im Repository-Stamm
  `python scripts/run_tests.py --suite all` erfolgreich laufen.
- Tests dürfen nicht umgangen, gelöscht, übersprungen oder abgeschwächt werden,
  um eine Änderung durchzubringen.
- Wenn eine Anforderung einer verbindlichen Regel widerspricht oder Kontext für
  eine sichere Entscheidung fehlt, muss dies vor der Umsetzung benannt werden.
