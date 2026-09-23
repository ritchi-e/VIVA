# Mokhik UI/UX Audit

**Product:** Mokhik (AI-powered university oral assessment)  
**Scope:** Existing React + Django application in this repository  
**Method:** Code inspection of frontend routes/pages/components and backend roles/APIs/lifecycles  
**Date:** 2026-09-19  
**Status:** Audit complete — no implementation in this document

---

## 1. Current-state product summary

Mokhik is a multi-tenant SaaS platform where:

1. Instructors create courses and assignments, configure rubrics and viva settings, and publish.
2. Students submit work (PDF/DOCX/PPTX/ZIP/GitHub); the system processes submissions into evidence.
3. Students book a viva slot, then complete an adaptive oral (voice) viva grounded in their submission.
4. The system produces an AI assessment for **instructor review** (not automatic grading).
5. Instructors review assessment, evidence, similarity, and viva dialogue, then finalize.

The product already has:

- Role-gated shells (student vs instructor)
- Working submission → book → viva → results path
- Instructor Review hub (submission detail with Assessment / Work / Evidence / Similarity tabs)
- Soft modern design tokens (teal/grey), shared Card/Button/Badge/Input
- Human-facing progress copy for viva phases and submission stages
- Evidence provenance and plagiarism panels

It does **not** yet feel like a polished “next action obvious” university SaaS across all journeys. The main gaps are information architecture, prioritization of “needs attention,” student pre-viva clarity, and consistency of language/empty/error states.

---

## 2. Roles that actually exist

### Organization membership (`Membership.Role`)

| Role | In API permissions? | In UI? |
|------|---------------------|--------|
| `organization_admin` | Yes (`IsOrgAdmin`, also instructor surfaces) | Admin page + shell Admin link |
| `instructor` | Yes (`IsInstructorOrAdmin`) | Instructor shell |
| `student` | Yes (`IsStudent`) | Student shell |
| `viewer` | Effectively unused (read-only holes only) | Not productized |

### Course enrollment (`CourseEnrollment.Role`)

| Role | Used for API auth? |
|------|--------------------|
| `instructor` | No |
| `student` | No |
| `ta` | No — **do not invent TA UX**; enrollment TA is unused for permissions |

**Do not invent Teaching Assistant workflows.** Course `ta` is not wired into DRF permissions.

### Per-role goals (product reality)

#### Student
- **Goals:** Submit work, book viva, complete viva, see result/status.
- **Common tasks:** Upload, wait for processing, book slot, join/start viva, view score.
- **Needs:** Clear next action, time expectations, mic/camera rules **before** begin, recoverable errors.
- **Does not need:** RAG, embeddings, provenance JSON, model names, token costs, integrity event enums.
- **Pain points:** Dashboard is stats-heavy; no dedicated prep screen; raw status enums; mode mismatch (`start` with `mode: 'text'` while UI is voice); monitoring rules hidden on small screens.

#### Instructor
- **Goals:** Publish assessments, monitor completion, review flagged/pending work, finalize scores.
- **Common tasks:** Create course/assignment, rubric, publish, open Review, finalize assessment.
- **Needs:** “Who needs attention?”, compact review, AI vs human distinction, evidence on demand.
- **Does not need:** Default exposure of provenance internals, AI token tables (admin-only is fine).
- **Pain points:** Dashboard doesn’t drive review; Assessment vs Evidence vs Viva dialogue overlap; create→publish next step unclear; Review list lacks filters.

#### Organization admin
- **Goals:** Members, AI usage, audit.
- **Needs:** Safe member management, usage visibility.
- **Pain points:** Dense ops jargon; deactivate without confirmation; Students empty state says “invite” but invite lives only on Admin.

#### Viewer
- Exists in enum only — **out of scope** until productized.

---

## 3. Actual student journey (as implemented)

```text
Login / Register (role=student)
  ↓
Student Dashboard (/student/dashboard)
  ├─ KPIs (open assignments, submissions, completed vivas, average score)
  ├─ Upcoming booked slots → Join / Start / Retry
  ├─ Recent sessions / submissions
  └─ Performance (if assessments exist)
  ↓
Assignments list (/student/assignments)
  ↓
Assignment detail (/student/assignments/:id)
  ├─ Read description + instructions (raw assignment fields)
  ├─ Upload file and/or GitHub URL
  ├─ Poll processing status (stage copy)
  ├─ When ready → Book viva slot
  └─ Optional: View submission / Rejoin / View analysis
  ↓
Book slot (/student/assignments/:id/book-slot)
  ├─ Pick available time cell
  ├─ Cancel / Join (only if now in window AND viva_session_id exists)
  └─ (No mic/camera/duration checklist)
  ↓
Student viva (/student/viva/:id)
  ├─ Auto-prepare if CREATED/PREPARING (PreparingVivaOverlay)
  ├─ Pre-begin gate: voice choice, Preview voice, Begin viva
  │   (fullscreen + camera required; 5s leave rule)
  ├─ Immersive VivaInterface phases:
  │   connecting → preparing → speaking → listening → processing → …
  ├─ Progress: Question n of budget + excerpt from submission
  ├─ Integrity overlay / terminate on grace expiry or camera deny
  └─ Complete → View results  OR  Terminated → Dashboard
  ↓
Results list (/student/results)
  ↓
Result detail (/student/results/:id)
  └─ Score, submission refs, areas of improvement
     (limited; no full transcript for student)
```

### Student journey gaps vs ideal

| Expected (prompt) | Actual |
|-------------------|--------|
| Clear “Your Assessments” action cards | Dashboard prioritizes KPI strip; action cards only for booked slots |
| Prep screen: duration, follow-ups, allowed resources, reconnect policy | Partial: begin-gate copy only; no estimated duration; no reconnect UX |
| Always-clear listening/recording state | Good phase titles exist; mic is auto-silence, not push-to-talk; no `aria-live` |
| Text alternative if voice fails | Dashboard can call `mode: 'text'` but viva UI is voice-centric |
| Friendly status language | Many badges show raw enums (`COMPLETED`, `ready`, `published`) |

---

## 4. Actual instructor journey (as implemented)

```text
Login / Register (instructor or organization_admin)
  ↓
Instructor Dashboard (/dashboard)
  ├─ Metric cards (not clickable)
  ├─ Quick links (duplicate sidebar)
  └─ Recent viva sessions → viva detail
  ↓
Courses (/courses) → Create course → Course detail
  └─ Assignment list (no create-assignment CTA on course detail)
  ↓
Assignments (/assignments) → Create (always draft)
  ↓
Assignment detail (/assignments/:id)
  ├─ Rubric | Settings | Booked slots | All submissions
  └─ Recent submissions (8)
  ↓
Assignment settings → Publish (also status select)
Assignment rubric → criteria (AI/instructor scoring language)
  ↓
Students submit & complete vivas
  ↓
Review hub (/submissions)  [nav label: “Review”]
  └─ Latest submission per student → Submission detail
        Tabs: Assessment | Submitted work | Evidence | Similarity
        AssessmentReview: AI vs instructor, questions, rubric, Finalize
        EvidencePanel: strength, flags, question drill-down, coverage
  ↓
Parallel paths (overlap):
  Viva sessions → dialogue + integrity + “Open review”
  Students → submissions
  Reports → charts + recent sessions (overlaps Dashboard)
  Admin (org admin) → members / AI usage / audit
```

### Instructor journey gaps vs ideal

| Expected | Actual |
|----------|--------|
| Dashboard “Needs attention” with deep link | `pending_reviews_count` exists but is not a primary CTA |
| Stepped assessment creation wizard | Flat create form + separate Settings/Rubric pages |
| Assessment preview before launch | Missing |
| Review: Student → flags → AI → evidence → decision | Tabs exist but Assessment default is dense; flags buried in Evidence |
| Tables with sort/filter/search/pagination | Lists are simple cards; no review-state filters |
| Onboarding for new instructors | None in-app |

---

## 5. Information architecture findings

### Strengths
- Student nav is already small (Dashboard / Assignments / Results).
- Submission detail as review hub (tabs) is the right pattern.
- Evidence URL redirects into the hub (`?tab=evidence`).
- Progress copy (`progressCopy.ts`, `userErrors.ts`) shows intentional product language work.

### Problems
1. **Instructor nav overload:** Dashboard ≈ Reports; Review vs Viva sessions vs Students all converge on the same work with different framing.
2. **Label mismatch:** Nav “Review” vs route `/submissions` vs historical “Submissions” mental model.
3. **Create lifecycle fragmentation:** Create assignment → must discover Settings → Publish; Course detail doesn’t continue the flow.
4. **Student “what next” is split** across Dashboard slots, Assignment detail, and Booking page.
5. **Technical language leaks** into primary UI: question budget, integrity stop, provenance details, raw enums, Analysis vs Results wording.

---

## 6. UX scoring (major workflows)

Scale: 1 = seriously problematic · 2 = poor · 3 = acceptable · 4 = good · 5 = excellent

### Student — Dashboard → Submit → Book → Viva → Results

| Area | Score | Problem | Severity | Recommendation |
|------|------:|---------|----------|----------------|
| Discoverability | 2 | Next action buried under KPIs; booking not on dashboard unless slot exists | P1 | Action-first “Your assessments” cards |
| Clarity | 2 | Raw statuses; Analysis vs Results; no duration | P1 | Human status map; consistent Results language |
| Navigation | 4 | Simple student nav | P3 | Keep; deepen links into action cards |
| Cognitive load | 2 | Viva begin gate packs voice+camera+fullscreen+leave rule | P0/P1 | Dedicated prep screen; progressive disclosure |
| Feedback | 3 | Phase copy good; recording state not assertive for AT | P1 | `aria-live`, clearer Listening indicator |
| Error recovery | 3 | userErrors help; reconnect story weak; FAILED retry uneven | P1 | Explicit reconnect/retry paths |
| Accessibility | 2 | Almost no ARIA on student pages/viva; mobile hides monitoring tip | P0 | Focus, live regions, always-visible rules |
| Consistency | 2 | Badges/enums; mode text vs voice | P1 | Shared StatusBadge + copy map |
| Efficiency | 3 | Path works but many hops | P2 | Collapse prep into one guided screen |
| Trust | 3 | Monitoring/camera abrupt; “secure room” metaphor | P1 | Calm, plain-language integrity framing |

### Instructor — Create → Publish → Review → Finalize

| Area | Score | Problem | Severity | Recommendation |
|------|------:|---------|----------|----------------|
| Discoverability | 2 | Pending reviews not actionable from dashboard | P0 | Needs-attention panel with filtered Review |
| Clarity | 3 | AI vs human partially clear; jargon in settings/rubric | P1 | Plain labels; progressive advanced settings |
| Navigation | 2 | Overlapping Review / Vivas / Reports / Dashboard | P1 | Simplify IA; deep-link instead of duplicate hubs |
| Cognitive load | 2 | Dense AssessmentReview; Evidence + dialogue split | P1 | Decision-first review layout |
| Feedback | 3 | Finalize exists; success states thin | P2 | Clear post-finalize confirmation |
| Error recovery | 3 | ErrorState common; booked-slots inconsistent | P2 | Standardize |
| Accessibility | 3 | Shell ok; tables/forms uneven | P2 | Labels, focus, table semantics |
| Consistency | 2 | Empty states without CTAs; dual publish paths | P1 | Design-system empty/error patterns |
| Efficiency | 2 | No filters on Review; open each student | P0 | Filters + “Needs review” default |
| Trust | 4 | Disclaimer + finalize model is right | P3 | Keep; strengthen AI vs instructor chrome |

### Viva conducting (core)

| Area | Score | Notes |
|------|------:|-------|
| Discoverability | 3 | Begin gate present |
| Clarity | 3 | Phase titles good |
| Cognitive load | 2 | Too much concurrent instruction |
| Feedback | 3 | Orb + phase text; silence-end not obvious |
| Error recovery | 2 | Connection/mic failures uneven |
| Accessibility | 1–2 | Critical gap |
| Trust | 3 | Integrity enforcement strong but harsh |

---

## 7. Prioritized findings

### P0 — Blocks or seriously harms core workflows
1. **Instructor cannot see “who needs review” without hunting** — dashboard count exists but no filtered Review CTA.
2. **Student viva accessibility gaps** — phase/listening/errors not announced; monitoring rules hidden on small screens while still enforced.
3. **No true pre-viva preparation screen** — students learn camera/fullscreen/leave rules at Begin; risk of failed starts and terminated sessions.
4. **Review efficiency** — no status/review/flag filters on the Review list for large cohorts.

### P1 — Serious confusion / friction
5. Student dashboard is **stats-first**, not **action-first**.
6. Assignment creation → publish path is **fragmented** and next action unclear.
7. Overlapping instructor hubs (Dashboard / Reports / Viva sessions / Review).
8. Raw enum badges and mixed terminology (Analysis vs Results, Integrity stop, question budget).
9. `vivaApi.start({ mode: 'text' })` from dashboard while conducting UI is voice.
10. Evidence/flags language still somewhat technical; flag “what to do” incomplete.
11. Empty states often explain “why” but lack the primary action button.
12. Students empty state points to invite without linking Admin.

### P2 — Friction with recovery
13. Course detail lacks create-assignment continuation.
14. AssessmentReview still vertically heavy on smaller laptops.
15. Viva session detail vs Assessment tab authority unclear.
16. Settings page is a stub (profile only).
17. Reports charts without actionable drill-downs.
18. Inconsistent ErrorState vs inline red text.

### P3 — Polish
19. Visual consistency residuals (slate vs CSS variables in some components).
20. Microcopy tightening across Admin audit/tokens.
21. Skeleton loaders instead of full ProgressPanel on some pages.
22. Lightweight instructor onboarding checklist.

---

## 8. Design system audit (snapshot)

**Exists and should be reused:**
- Tokens in `frontend/src/index.css` (`--color-primary`, surfaces, radii, shadows)
- `Card`, `Button`, `Badge`, `Input`, `Textarea`, `PageHeader`, `EmptyState`, `ErrorState`, `ProgressPanel`
- Soft bento utilities (`mk-bento`, `mk-page-title`, focus ring)

**Gaps:**
- No shared `StatusBadge` mapping enums → human labels/tones
- No shared `Tabs` primitive (SubmissionDetail invents its own)
- No shared `DataTable` / filters / pagination
- No shared `Alert` / `ConfirmDialog` for destructive actions
- EmptyState `action` prop underused
- Mixed slate utility classes vs CSS variables in older components
- No onboarding / help components

---

## 9. Accessibility audit (summary)

| Check | Student app | Instructor app | Viva |
|-------|-------------|----------------|------|
| Keyboard nav | Partial | Partial | Weak |
| Focus visible | Button/Input OK | OK | Weak on custom controls |
| Contrast | Generally OK post soft redesign | OK | OK |
| Labels | File upload unlabeled | Forms uneven | Voice picker not radiogroup |
| Live regions | Almost none | Rare | Critical missing |
| Screen reader structure | Weak | Moderate | Weak |
| Timing | Auto-silence / 5s grace | N/A | High risk |
| Alternatives | Text mode not real in UI | N/A | Gap |

---

## 10. Responsive audit (summary)

| Workflow | Desktop | Laptop | Tablet | Mobile |
|----------|---------|--------|--------|--------|
| Student dashboard | OK | OK | Crowded KPIs | Stats dominate |
| Upload / book | OK | OK | OK | Slot grid cramped |
| Viva | Designed immersive | OK | Risky | Monitoring tip hidden; high failure risk |
| Instructor Review | Improved with tabs | Assessment still dense | Tabs wrap | Review possible but heavy |
| Admin tables | OK | OK | Horizontal scroll | Poor |

**Priority:** Make viva rules and controls safe on small screens; instructor admin can remain desktop-first.

---

## 11. Error / loading / empty patterns

| Pattern | Strength | Weakness |
|---------|----------|----------|
| `ProgressPanel` + `PLATFORM_PROGRESS` | Contextual titles | Overused full-page; few skeletons |
| `ErrorState` | Consistent retry | Not used everywhere |
| `userErrors` / viva formatters | Softens backend jargon | List badges bypass it |
| EmptyState | Good copy often | Primary CTA frequently missing |
| Success | Rare explicit confirmations | Users may doubt publish/finalize/book |

---

## 12. Evidence & AI-vs-human audit

**Strengths:**
- Assessment disclaimer and Finalize model match product ethics.
- Evidence tab + QuestionDrillDown show submission → question → answer → evaluation chain.
- Plagiarism panel separates peer review links clearly (“Open peer review”).

**Weaknesses:**
- Flag types still somewhat model-ish (`unsupported_claim`, etc.) without “what should I do?”
- Provenance “Show details” can dominate if expanded by default curiosity.
- Instructor must leave Assessment tab for Evidence/flags and Viva dialogue — slows decisions.
- No org-wide open-flags list API/UI.

---

## 13. Pages / areas that should remain largely unchanged

Do **not** rewrite unless required for a P0/P1 fix:

- WebSocket viva protocol and `VivaInterface` core state machine (improve UX chrome, don’t replace protocol)
- Auth (JWT, Google, tenancy header)
- Evidence backend services and APIs (extend filters/aggregates only if needed)
- Soft design token direction (teal/grey modernism)
- Landing/marketing `HomePage` (separate brand surface)
- Admin AI usage/audit tables (clarify copy; don’t turn into student UI)

---

## 14. Backend/API gaps that affect UX (do not invent data)

| Need | Available today? | Notes |
|------|------------------|-------|
| Pending reviews count | Yes (`pending_reviews_count`) | Needs frontend deep link + list filter |
| Per-submission review status | Yes (assessment status / evidence dashboard) | Surface on Review list rows |
| Open flags org-wide | No list endpoint | Prefer per-submission first; extend API only if required |
| Estimated viva duration | Partial (`time_limit_seconds`, slot duration setting) | Expose plainly in prep UI |
| Question budget | Yes (`question_budget` / viva_config) | Show as “About N questions” |
| Needs-review list filter | Not as query param on submissions | Can filter client-side initially via assessment join, or add API later |
| Text viva mode in UI | API supports `text`/`voice` | UI does not offer real text conducting |
| Assignment close | Status exists | No first-class close UX |

---

## 15. Audit conclusion

Mokhik’s **bones are correct**: role-specific shells, submission processing copy, viva phases, instructor review hub with evidence, human-in-the-loop finalize.

The product fails the “next action obvious” bar mainly because:

1. Students see **systems and stats** before **what to do next / how to prepare**.
2. Instructors see **many hubs and dense detail** before **who needs a decision**.
3. Language and status presentation still **leak implementation**.
4. Accessibility on the viva path is **below university SaaS standard**.

**Next document:** `docs/ui-ux-redesign-plan.md` — prioritized, incremental implementation plan that reuses the existing architecture.
