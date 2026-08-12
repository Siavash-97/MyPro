---
target: myprosole_app/design/mockups (whole app)
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-12T13-07-12Z
slug: myprosole-app-design-mockups-whole-app
---
Method: dual-agent (A: ae1ded47bfc120dd7 · B: afddee5c103fb5576)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live-tracking's heart-rate tile (142 bpm) renders unconditionally while the coach banner in the same view states only "Route, Zeit und Tempo werden aufgezeichnet" — the screen contradicts itself about what's connected |
| 2 | Match System / Real World | 4 | Real coaching vocabulary throughout; "Wie war's?" as Gut/Ging so/Schwer instead of a 1-10 scale, reasoned in code comments as reducing post-run decision friction |
| 3 | User Control and Freedom | 3 | Good escape hatches (Später eintragen, Heute nicht, Passt nicht?) but "Später eintragen" only exists when arriving fresh from a run — no skip path from the diary form itself otherwise |
| 4 | Consistency and Standards | 4 | Token/component system rigorously followed across every screen; even a fixed 72px app-bar height exists specifically to stop a height "jump" between screens |
| 5 | Error Prevention | 3 | Chips constrain pain-location input before falling back to (explicitly non-authoritative) free text — good. But no input-validation state exists anywhere, despite numeric fields like schmerz-km (0-300, step 0.5) |
| 6 | Recognition Rather Than Recall | 4 | Diary pre-fills distance/duration/pace from the just-completed run; Home states "Heute geplant: ..." inline on the CTA itself |
| 7 | Flexibility and Efficiency | 2 | Diary, Gym-Plan, and Laufplan sit behind a 36px unlabeled edge tab ("Mehr") with no faster path for frequent users |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained functional color, a type scale bumped up "für verschwitzte Augen" — thoughtful. But Home stacks six same-weight cards before the fold, diluting hierarchy |
| 9 | Error Recovery | 1 | No error state observed anywhere in the sample - not on numeric pain-km input, not on the (disabled) group search field |
| 10 | Help and Documentation | 2 | Good inline reassurance copy exactly where needed, but no discoverable help/FAQ surface; the chat FAB's label is run-specific on every screen including Profil |
| **Total** | | **29/40** | **Good** |

#### Design Specificity Verdict

**LLM assessment:** Specific in content and information architecture, generic in visual personality. The product's real differentiation — a documented, rule-driven coaching methodology (HTML comments cite literal rule IDs like D.2, F.1, E.5, E.11 from the Trainingskonzept doc) — is expressed almost entirely through copy and conditional-visibility logic, not through anything a user would visually recognize as "MyProSole" vs. any other Material 3 fitness app. The bottom nav, card-grid dashboard, chat FAB, and score-ring pattern (Garmin/Whoop/Strava all use this exact vocabulary) are visually interchangeable with the category. Running vocabulary (Kadenz, Bodenkontaktzeit, Aufsatzmuster) and the GPS/insole dual-mode architecture threaded consistently through `data-analysis-mode` attributes are the genuine product-specific strengths.

**Deterministic scan:** 0 findings across all 35 mockup screens, exit code 0 (verified as a genuine clean pass, not a broken pipeline — the detector was sanity-tested against synthetic anti-pattern HTML and correctly fired on all three injected violations before confirming the real scan). No AI-slop patterns (gradient text, bounce easing, glow shadows, marquees, pulsing dots, spacing monotony, etc.) detected anywhere in the design system. This scan only covers pattern-matchable CSS/HTML anti-patterns — it says nothing about IA, content quality, or Material 3 token fidelity, which is exactly where Assessment A's findings live.

**Visual overlays:** Not attempted for this run — no live-server/browser-injection pass was run (static evidence only, deterministic CLI + full-file reading). No overlay is available in a browser tab for this run.

#### Overall Impression

A prototype with real backend-logic discipline (the rule-engine citations, the GPS/insole dual-mode threading, zero detected AI-slop) wrapped in a visual shell that hasn't caught up to that discipline. The single biggest opportunity: the things that make MyProSole different from Strava or Nike Run Club (a documented, rule-driven coaching methodology) currently live almost entirely in code comments and conditional logic invisible to the user — surfacing even a fraction of that into the visible design would do more for differentiation than any amount of visual polish.

#### What's Working

1. **Progressive disclosure with graceful hardware degradation in `analyse-ergebnis.html`.** The score stays pinned while findings/values/biomechanics collapse into individually-openable sections, and gracefully renders a scoped upsell instead of an empty state when no insole is paired — one screen serves two hardware configurations without forking into two designs.
2. **The pain chip/free-text split in `trainingstagebuch.html` is honest about what the AI is doing.** Structured chips drive the rule engine; free text is explicitly labeled as non-driving ("Das liest dein Coach im Chat..."). This heads off a specific, common trust break: user writes detail, app ignores it, output feels random.
3. **The dual-mode architecture is threaded through data attributes, not duplicated screens** — `data-analysis-mode="gps|insole"` keeps Home, Zusammenfassung, and Analyse-Ergebnis from ever silently drifting out of sync about what a GPS-only user is allowed to see.

#### Priority Issues

- **[P1] Three whole features hidden behind an unlabeled-feeling edge tab, in tension with the project's own click-depth standard**
  **Why it matters:** Trainingstagebuch, Gym-Plan, and Laufplan are only reachable (outside the fresh-run flow) through a 36px, icon-less drawer-tab on `uebungen.html` — a fully custom affordance a user has to learn from scratch, while Community was explicitly promoted to the bottom nav "for lower click depth" per the project's own stated standard.
  **Fix:** Either give the drawer a standard, instantly-recognizable overflow affordance, or promote Trainingstagebuch specifically into the bottom nav or a Home shortcut.
  **Suggested command:** `/impeccable layout uebungen.html` (or `/impeccable clarify` for the affordance labeling)

- **[P1] No visible error/validation states anywhere in the sample**
  **Why it matters:** Numeric health-adjacent fields (`schmerz-km`, 0-300 step 0.5) have no defined error-state component and none appears in any of the 10 screens read. Since pain-location + kilometer data feeds directly into exercise-selection logic, a silently-accepted bad value is a correctness risk in an injury-prevention flow.
  **Fix:** Define one canonical error-state token/class pair (border + inline message) in the design system and apply it before this leaves prototype stage.
  **Suggested command:** `/impeccable harden trainingstagebuch.html`

- **[P1] Injury-relevant findings and trivial findings share identical visual weight**
  **Why it matters:** `.md-finding` renders "Verhaltener Start" (benign pacing note) exactly the same as "Belastung rechts erhöht" (a load-asymmetry signal — the actual injury-prevention payload of the sensor insole). No severity tiering exists, risking desensitization to the signal the product exists to catch.
  **Fix:** Add a second severity tier to `.md-finding` (distinct border weight or icon) reserved for findings mapped to the injury-prevention rule set.
  **Suggested command:** `/impeccable layout analyse-ergebnis.html`

- **[P2] Home screen has no clear "do this next" beyond the CTA**
  **Why it matters:** Six same-weight `.md-card` blocks stack before the fold (greeting, status chip, CTA, week progress, last run, community promo, profile reminder) — for a quick glance this reads as an undifferentiated list, not a prioritized one.
  **Fix:** Visually demote the community-promo and profile-reminder cards relative to the weekly-progress/CTA cluster (lighter surface, no border).
  **Suggested command:** `/impeccable layout home.html`

- **[P2] Live-tracking's heart-rate tile contradicts the mode banner directly below it**
  **Why it matters:** Shows a hardcoded 142 bpm unconditionally while the banner in the same viewport states only route/time/pace are being recorded — a factual inconsistency on a screen shown mid-run.
  **Fix:** Apply the same `data-analysis-mode`/conditional-visibility pattern already used elsewhere in the codebase to this tile (already flagged and intentionally deferred earlier this session — this independently confirms it's worth revisiting once real device-connection state exists).
  **Suggested command:** `/impeccable adapt live-tracking.html`

#### Persona Red Flags

**Sam (accessibility-dependent):** `.md-app-bar__icon-btn` (back/share/notification) is 40×40px, under Android's 48dp minimum touch target — on exactly the controls someone taps one-handed while still breathing hard. Pain-location chips likely render under 48dp tall too — the exact controls someone might need to tap right after an injury-adjacent event. Credit: `.md-calendar` day states use shape+border redundancy alongside color, a color-blind-safe pattern that should be the house standard, not an exception.

**Casey (distracted mobile user):** The micro-routine offer — arguably the single most important injury-prevention action after a run — sits below the hero, metric grid, map, and plan-match card on `lauf-zusammenfassung.html`, with no more visual urgency than the splits card above it; likely to be scrolled past. The "Mehr" drawer-tab (see P1) is exactly the kind of subtle affordance this persona won't notice exists.

**Alex (power user):** Logging a diary entry not tied to a fresh run takes three taps (Training tab → Mehr drawer → Trainingstagebuch) with no faster path despite frequent use being the expected pattern. "Anfrage" buttons on `community-zusammenlauf.html` show no sent/pending state — a user firing off several has no way to tell which they already tapped.

#### Minor Observations

- `tokens.css` ships four simultaneous brand-color palettes with live runtime toggles exposed directly in `profil.html`'s settings — an intentional A/B decision aid, but as coded it's indistinguishable from a real user-facing feature sitting next to Dark Mode and Language.
- The chat FAB's label ("Mit MyProSole-Agent über deinen Lauf sprechen") is identical and run-specific on every screen, including Profil and Community where "über deinen Lauf" doesn't fit.
- Every mockup file duplicates the full icon sprite inline rather than pulling from the documented shared source (`design-system/icons.html`) — fine for a no-build prototype, but any icon edit today means repeating it across ~35 files by hand.
- `community.html`'s post-composer entry reads as an inert info row, styled identically to a passive card link, unlike the visually-distinct composer bars in comparable social feeds.
- `.md-app-bar`'s hard-pinned 72px height is a good fix for the cross-screen height "jump," but the fact a magic-number fix was needed suggests the header layout isn't structurally resilient to content changes by default.

#### Questions to Consider

- The pain-check sits before the celebratory summary to catch injury data while memory is freshest — defensible methodologically. What would flipping that order (win first, pain question as a closing coda) do to both data quality and emotional payoff? Has the current order been tested against the alternative, or did the data-freshness argument settle a UX question by default?
- Four competing brand palettes exist as a live, user-facing toggle in Profil today. What's the plan for the day three of them disappear — does removing three-quarters of a visible "feature" read as regression to early testers who got used to switching?
- Nearly all of the product's differentiated content (biomechanics, load asymmetry, the coaching-rule engine) sits behind the optional insole-hardware gate. For the long stretch where most users are GPS-only, should more of the documented coaching methodology be surfaced as a hardware-independent hook, rather than living only in code comments?
