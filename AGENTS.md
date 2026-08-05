# Repository quality rules

- Every behavioral code change must include or update a focused unit test.
- Every user-facing workflow or cross-module change must include or update an automated workflow/integration test.
- Before handing off code, run `python scripts/run_tests.py --suite all` from the repository root.
- Do not bypass, delete, skip, or weaken failing tests to make a change pass. Fix the implementation or correct an objectively wrong assertion.
- These rules apply to both `project-planner` and `myprosole_app`.
