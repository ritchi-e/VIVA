# Mokhik UI/UX Redesign Plan

**Depends on:** [`docs/ui-ux-audit.md`](ui-ux-audit.md)  
**Status:** Implementation complete (2026-09-19) — phases 1–11 applied incrementally to the existing React app. See also `docs/ui-ux-audit.md`.

---

## 1. Current-state summary

Mokhik already supports the full academic loop: publish assignment → student submit → process → book → viva → AI assessment → instructor finalize. Recent work improved the Review hub (tabs) and soft visual language.

The redesign goal is **not** a greenfield UI. It is to make the **next action obvious**, reduce cognitive load, and bring student viva + instructor decision workflows up to a trustworthy university SaaS bar—without breaking auth, tenancy, WebSockets, RAG, or evidence APIs.

---

## 2. Student journey problems (to fix)

| ID | Problem | Priority |
|----|---------|----------|
| S1 | Dashboard is KPI-first, not action-first | P1 |
| S2 | No dedicated pre-viva preparation screen | P0 |
| S3 | Camera/fullscreen/leave rules revealed too late; hidden on mobile | P0 |
| S4 | Raw status enums and “Analysis” vs “Results” inconsistency | P1 |
| S5 | Viva listening/processing states weak for accessibility | P0 |
| S6 | Dashboard starts viva with `mode: 'text'` while UI is voice | P1 |
| S7 | No clear estimated duration / question expectations before begin | P1 |
| S8 | Reconnect / recoverable error story incomplete | P1 |
| S9 | File upload lacks proper labels; slot grid a11y weak | P2 |

---

## 3. Instructor journey problems (to fix)

| ID | Problem | Priority |
|----|---------|----------|
| I1 | Dashboard pending reviews not actionable | P0 |
| I2 | Review list lacks needs-review / status / search filters | P0 |
| I3 | Create → publish path fragmented; next step unclear | P1 |
| I4 | Dashboard / Reports / Viva sessions overlap | P1 |
| I5 | Assessment vs Evidence vs dialogue decision path still heavy | P1 |
| I6 | Empty states missing primary CTAs | P1 |
| I7 | Jargon: question budget, integrity stop, provenance-first | P1 |
| I8 | No assessment preview before launch | P2 |
| I9 | No stepped creation wizard (giant form risk on Settings) | P2 |
| I10 | Destructive actions lack confirmations (e.g. deactivate member) | P2 |

---

## 4. Navigation / IA problems

- Instructor: too many parallel hubs for the same work.
- Label mismatch: nav “Review” vs `/submissions`.
- Student: nav is fine; **content hierarchy** on Dashboard/Assignment detail is wrong.
- Deep links exist but aren’t used as the primary “needs attention” mechanism.

**Target IA (incremental, not a rewrite):**

### Student nav (keep)
Dashboard · Assignments · Results

### Instructor nav (simplify emphasis, keep routes)
Dashboard · Courses · Assignments · **Review** · Students · Settings  
Demote or merge: Reports → section of Dashboard; Viva sessions → filter/entry from Review or assignment; Admin stays org-admin only.

---

## 5. Information architecture problems

- Critical instructor info (pending review, flags) is not on the first screen of the workday.
- Technical info (provenance, tokens) can appear at the same visual weight as decisions.
- Student critical info (what to do, duration, mic/camera) is split across pages and the begin gate.

**Classification rule going forward:**

| Layer | Examples | Placement |
|-------|----------|-----------|
| Critical | Start viva, Finalize, Needs review, Listening state | Primary chrome |
| Useful | Score breakdown, coverage, similarity summary | Secondary panels / tabs |
| Technical | Model/provider/prompt version, token costs | Progressive disclosure / Admin |

---

## 6. Visual consistency problems

- Mix of `slate-*` utilities and CSS variables in older components.
- Ad-hoc tab controls vs no shared `Tabs`.
- Badge tones used for raw enums without a mapping layer.
- Empty/error/loading patterns inconsistently applied.

**Keep:** current soft teal/grey modernism, Outfit/Sora/Manrope direction already in product, Card/Button primitives.

---

## 7. Accessibility problems

- Viva: missing `aria-live` for phase, transcript, countdown, errors.
- Voice picker not exposed as a radiogroup.
- Progress bar not a semantic progressbar.
- Monitoring callout `hidden sm:block` while rules still apply.
- Student forms: unlabeled file input.
- Confirm dialogs / destructive actions missing.

---

## 8. Responsive problems

- Viva on small screens is high-risk (rules hidden, immersive chrome).
- Instructor tables/admin not mobile-optimized (acceptable if desktop-first).
- Review tabs wrap; Assessment two-column collapses—verify laptop 1280–1440.

---

## 9. Error / loading / empty problems

- Prefer contextual ProgressPanel titles (already good) + add skeletons for lists.
- Standardize on `EmptyState` **with** `action`.
- Standardize recoverable viva errors: what happened / data safe? / primary action.
- Add success toasts or confirmation banners for publish, finalize, book, flag.

---

## 10. Evidence / review UX problems

- Decision-first layout needed: summary + flags + AI vs instructor → then evidence on demand.
- Flag copy should answer: what happened, why it matters, what to do.
- Keep QuestionDrillDown; default-collapse provenance details.
- Do not force instructors through full viva transcript before scoring.

---

## 11. Recommended changes (by phase)

### Phase 1 — Design system consistency (P1/P2)
**Modify / create:**
- `StatusBadge` — map submission/viva/assessment/booking enums → human labels + tones
- `Tabs` — reuse on SubmissionDetail (and later creation wizard)
- `Alert` / `ConfirmDialog`
- Align leftover `slate-*` on instructor/student pages to CSS variables
- Ensure `EmptyState` usage includes actions

**Unchanged:** token palette, Card/Button/Input core API

### Phase 2 — Navigation & IA (P1)
- Dashboard “Needs attention” card → `/submissions?review=pending` (or client filter)
- Soft-merge Reports into Dashboard sections (keep `/reports` route as alias or slim page)
- Viva sessions: keep route; add entry points from Review/assignment; reduce duplicate “recent sessions” blocks
- Copy pass: nav/page titles consistent (“Review”)

### Phase 3 — Student experience (P0/P1)
- Redesign `StudentDashboardPage` around **Your assessments** action cards (due, status, primary CTA)
- Add `VivaPrepPage` or prep step before immersive UI:
  - purpose, estimated time, ~N questions, follow-ups may occur
  - submission being assessed
  - mic + camera checklist
  - leave-window / reconnect policy in plain language
  - Start only when checks pass (or explicitly acknowledged)
- Fix start mode to `voice` (or offer real text mode later—**don’t fake it**)
- Humanize badges via `StatusBadge`
- Results naming consistency (drop “Analysis” where it means results)

### Phase 4 — Instructor dashboard (P0/P1)
- Replace vanity-only metrics with **Needs attention** + deep links
- Clickable metric → filtered lists
- Remove redundant quick-link clutter that duplicates sidebar

### Phase 5 — Assessment creation (P1/P2)
- Progressive disclosure on assignment setup (not necessarily a full 7-step wizard in v1):
  1. Basics
  2. Submission types
  3. Viva (budget as “About N questions”, time as minutes)
  4. Rubric
  5. Preview + Publish
- Add **Publish checklist** on assignment detail (missing rubric? draft?)
- Course detail: **Create assignment** CTA
- Optional later: full stepper + student preview mock

### Phase 6 — Viva experience (P0/P1)
- Keep `VivaInterface` state machine; improve chrome only
- Persistent, always-visible integrity rules (including mobile)
- Strong Listening / Processing indicators (text + icon + `aria-live`)
- Clearer silence-to-end affordance (“Pause when finished”)
- Error panel: reconnect / try again / end safely
- Do **not** show model/retrieval internals during conducting
- Defer full text-mode conducting unless product prioritizes it (API exists)

### Phase 7 — Assessment / evidence review (P1)
- Assessment tab: decision strip (AI score / your decision / flags count / Finalize)
- Inline “View evidence” per claim/question (opens drill-down drawer or switches tab with question selected)
- Soften flag labels + add instructor guidance line
- Keep Work / Similarity tabs as-is structurally
- Review list: search + filters (status, needs review, similarity, mismatch)

### Phase 8 — Error / loading / empty (P1/P2)
- Sweep pages to EmptyState+CTA, ErrorState, success banners
- Skeleton rows for Review/Students lists

### Phase 9 — Accessibility (P0/P1)
- Viva live regions, focus management on phase change, labeled controls
- Form labels on upload
- ConfirmDialog for deactivate / end viva / cancel booking where needed
- Keyboard path through prep → begin → answer controls

### Phase 10 — Responsive (P1)
- Viva prep + conducting usable on tablet/mobile without hiding rules
- Review tabs scrollable; Assessment stacks cleanly
- Instructor admin tables: horizontal scroll OK

### Phase 11 — Visual polish (P3)
- Microcopy pass
- Motion restraint (already mostly calm)
- Onboarding checklist for first-time instructors (dismissible)

---

## 12. Priority order for implementation

1. Phase 1 (shared primitives needed everywhere)  
2. Phase 4 + Review filters (I1/I2) — instructor decision speed  
3. Phase 3 prep + dashboard actions (S1–S3)  
4. Phase 6 viva a11y/state clarity (S5)  
5. Phase 7 review decision strip + evidence on demand  
6. Phase 2 IA cleanup  
7. Phase 5 creation flow improvements  
8. Phases 8–11

---

## 13. Components to create

| Component | Purpose |
|-----------|---------|
| `StatusBadge` | Enum → human label/tone |
| `Tabs` | Shared tablist pattern |
| `Alert` | Inline success/warning/info/error |
| `ConfirmDialog` | Destructive / irreversible actions |
| `NeedsAttentionPanel` | Instructor dashboard |
| `StudentAssessmentCard` | Dashboard next-action card |
| `VivaPrepScreen` | Pre-begin checklist & expectations |
| `ReviewFilters` | Search/filter bar for Review list |
| `DecisionStrip` | AI vs instructor summary on review |

---

## 14. Components to modify

| Component | Change |
|-----------|--------|
| `StudentDashboardPage` | Action-first layout |
| `StudentAssignmentDetailPage` | Clearer pipeline + labels |
| `StudentVivaPage` / `VivaInterface` | Prep handoff, a11y, rules visibility, error recovery |
| `PreparingVivaOverlay` | Align copy with prep screen |
| `DashboardPage` | Needs attention |
| `SubmissionsPage` | Filters + status badges + row review state |
| `SubmissionDetailPage` | Decision-first Assessment; optional query `question=` for evidence |
| `AssessmentReview` | Decision strip; evidence links; denser but clearer |
| `EvidencePanel` / `QuestionDrillDown` | Softer flags; collapsed technical details |
| `AssignmentDetailPage` / `AssignmentSettingsPage` | Publish checklist; plain viva settings |
| `EmptyState` usages site-wide | Wire actions |
| `AppShell` | Optional nav demotion of Reports/Vivas (careful, incremental) |

---

## 15. Pages to redesign (targeted)

- Student Dashboard  
- Viva prep + viva chrome (not protocol rewrite)  
- Instructor Dashboard  
- Review list  
- Assessment creation/publish surfaces (Settings + Detail, light touch)  
- Assessment review tab  

---

## 16. Pages that should remain unchanged (initially)

- Marketing `HomePage`  
- Auth login/register flows (copy tweaks only if needed)  
- WebSocket consumer / orchestrator backend  
- Evidence API services (unless filter aggregate required)  
- Celery pipelines, RAG, plagiarism algorithms  
- Admin audit/usage (copy + confirm only)  
- `brag-output` / marketing video artifacts  

---

## 17. Backend / API changes (only if required)

Prefer frontend-only.

| Change | Why | Approach |
|--------|-----|----------|
| Submissions list `review_status` or filter | Faster Needs review list | Optional: annotate serializer with latest assessment status; or fetch assessments client-side for v1 |
| `pending` query param | Deep links from dashboard | Extend `SubmissionViewSet` list filters; tests required |
| Evidence flags list | Org-wide open flags | Defer; use dashboard pending_reviews first |
| Expose slot duration / question budget plainly | Prep screen | Mostly already on session/assignment; read existing fields |
| Text viva conducting | Accessibility alternative | Larger feature — separate epic; don’t half-ship |

**Compatibility:** Any API additions must be additive and tested. No breaking contract changes.

---

## 18. Testing plan (when implementing)

1. **Functional:** Student submit→book→prep→viva→results; Instructor publish→review→finalize  
2. **Regression:** Existing Django tests; frontend `tsc`  
3. **Responsive:** 375 / 768 / 1280 / 1440 for student viva + instructor review  
4. **Accessibility:** Keyboard through prep/viva controls; live region announcements; contrast  
5. **Tenant/auth:** Confirm no permission regressions for student vs instructor vs org admin  

---

## 19. Explicit non-goals

- Rebuilding the frontend in a new framework  
- Replacing Hyperframes/brag work  
- Inventing TA/viewer product roles  
- Showing RAG/embeddings/model routing in student UI  
- Making AI the final grade without instructor finalize  
- One giant PR that rewrites all pages  

---

## 20. Definition of done (redesign program)

- Student can answer “what do I do next?” from Dashboard in &lt;5 seconds  
- Student sees duration, mic/camera, and integrity rules **before** Begin  
- Instructor sees pending reviews on Dashboard and can open a filtered Review list  
- Review list supports finding who needs a decision without opening every row  
- Viva listening/processing/error states are obvious and announced  
- AI vs instructor decision remains visually distinct  
- No P0 accessibility regressions on viva  
- Existing tests pass; no auth/tenant/WebSocket regressions  

---

## 21. Implementation gate

**Do not start coding the redesign until this plan is accepted.**

Suggested first implementation slice after approval:

1. `StatusBadge` + Review filters + Dashboard Needs attention (instructor P0)  
2. `VivaPrepScreen` + dashboard action cards (student P0/P1)  
3. Viva a11y/live regions + always-visible rules  

That order maximizes user impact while staying incremental.
