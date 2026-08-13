# Investor lens: AI Viva before you sell

I've looked at the repo, docs, architecture, and what's actually built. Short version: **you have a strong demo and a credible thesis**, but this is **not yet a sellable institutional product**. It's a well-architected MVP that can win pilots — if you close specific gaps first.

Your positioning — *"Assess understanding, not AI usage"* — is timely and defensible. That's rare. Most edtech is either detectors (contested) or auto-graders (policy risk). You're in the middle: **evidence-backed oral assessment with human final authority**. That's the right wedge for universities worried about GenAI in coursework.

---

## What's already investable (strengths)

**1. Clear problem–solution fit**  
The PRD articulates a real pain: instructors can't verify comprehension from polished submissions. HITL assessment (instructor must finalize) aligns with academic policy — that's not optional, it's a feature.

**2. End-to-end workflow exists**  
Assignment → submission → RAG → question plan → live viva → evaluation → instructor review. That's a full loop, not a slide deck.

**3. Architecture is sane for a seed-stage company**  
Modular monolith, multi-tenant org model, Celery for async, provenance on questions, audit trail on assessment edits. You won't need to rewrite this for the first 10 institutions.

**4. Thoughtful AI design**  
Provider abstraction, mock mode for demos, separate planning vs. live conversation, grounding in submission chunks. Shows you understand this isn't "ChatGPT grades essays."

**5. Documentation maturity**  
PRD, SRS, ADRs, threat model, deployment reference — unusual for this stage. Buyers and auditors will ask for this; you already have drafts.

---

## Critical blockers before taking money

These are **must-fix** before any paid contract, not nice-to-haves.

### 1. Production reliability & latency (you've felt this)

Live viva turns take **20–30+ seconds** with real LLMs. For a student sitting in an oral exam, that feels broken. Before selling:

- Target **<8 seconds** p95 for next-question generation (faster model for live turns, smaller prompts, caching, prefetch — you've started some of this).
- Define and publish **SLA targets** even for pilots (uptime, max session duration, recovery from disconnect).
- Load-test WebSocket + Celery under concurrent vivas (50–200 students in an exam window is normal).

**Investor view:** If the core loop feels slow or flaky in a pilot, you don't get a second meeting.

### 2. Voice is not exam-grade yet

Browser Web Speech API is fine for a portfolio demo. It is **not** acceptable for high-stakes assessment:

- Voice quality varies by browser/OS.
- No proctoring signal (who is speaking? second person? read-aloud from phone?).
- No server-side transcript audit trail comparable to professional STT.
- Accessibility gaps (students who can't use mic/speech).

Before selling, you need at least: **reliable server STT/TTS option**, transcript storage, fallback text mode that's first-class (not "error state"), and a **recorded session replay** for disputes.

### 3. Submission coverage gaps

Architecture review already flags: **no real OCR** (scanned PDFs fail), GitHub is text-only, no code execution for CS vivas. If you sell to CS / engineering faculties, they'll hit this on day one.

Minimum bar: honest **supported formats matrix** on the website + graceful failure UX + roadmap for OCR and code-aware questioning.

### 4. Security & compliance (institutions will ask on call #1)

You have a threat model — good. You don't yet have what procurement needs:

| Gap | Why it matters |
|-----|----------------|
| No SSO/SAML | Universities won't onboard 500 instructors with local passwords |
| No LMS integration (LTI 1.3) | Instructors won't manually recreate courses |
| No FERPA/GDPR posture | Legal review stalls deals |
| No formal pen test / SOC 2 path | Research IT blocks cloud vendors |
| Phase 10 security "pending" | Threat model says revisit before prod |

**Minimum to sell a pilot:** data processing agreement template, data retention/deletion policy, encryption at rest/in transit doc, subprocessors list (OpenAI etc.), student consent flow, and **tenant data isolation evidence** (you have tests — package them for buyers).

### 5. AI quality is unproven at scale

Your eval suite: **3 mock cases, 0% failure on mock provider**. That's development tooling, not validation. Buyers will ask:

- "How often do questions ignore the submission?"
- "How often does evaluation disagree with instructors?"
- "Can students game it by memorizing generic answers?"

You need **real-LLM eval** (100+ cases), instructor calibration studies, and published **inter-rater reliability** vs. human markers. Without this, you're selling faith, not outcomes.

### 6. Test coverage is far too thin for production

~**18 test functions** across the backend, no Playwright E2E, frontend has **zero automated tests**. One regression in the viva flow (duplicate speech, early finish — bugs you've already hit) destroys trust in a pilot.

Before selling: E2E path for full viva, tenant isolation regression suite, WebSocket chaos tests.

---

## Product gaps buyers will notice in week 1

**Instructor experience**
- No live **monitoring dashboard** during vivas (who's stuck, who's done, flags).
- No **question override** mid-session or "this question was unfair" workflow.
- Analytics/ cohort reporting is V2 — but dept heads ask on day one.

**Student experience**
- No clear **appeals / technical difficulty** path ("my mic failed").
- No practice viva / low-stakes mode.
- Progress UX during long "examiner thinking" waits needs design polish.

**Admin / ops**
- No billing, usage metering, or seat management.
- No institution-level policy (retention, AI provider choice, disable voice).
- Email is console backend — password reset won't work in prod.

**Integrations**
- Google OAuth is a stub.
- No grade passback to LMS gradebook.
- No SIS roster sync.

---

## Commercial readiness (what I'd want before "start selling")

### Tier 0 — Don't charge yet (current state)
- Docker demo, single-org, manual onboarding, best-effort support.
- **Use for:** portfolio, academic submission, design partners who sign a free pilot MOU.

### Tier 1 — Paid pilot ($5–15k / dept / semester)
Requires:
- Hosted production environment (not localhost Docker)
- SSO or centralized admin onboarding
- SLA + support contact
- DPA + privacy policy
- Session recording / audit export
- Instructor training materials (1-pager + 10-min video)
- Known-issues list (OCR, voice browsers, latency)

### Tier 2 — Institutional license ($50k+)
Requires everything in Tier 1 plus:
- LMS LTI integration
- SSO (SAML/OIDC)
- Pen test report
- FERPA-aligned contracts
- Multi-year roadmap committed on paper
- Customer success / onboarding playbook

You're at **Tier 0 heading toward Tier 1**, not Tier 2.

---

## Go-to-market: who to sell to first

Don't sell "to universities" broadly. Pick **one wedge**:

| Wedge | Why | Risk |
|-------|-----|------|
| **CS / Software Engineering** | Code submissions, viva culture already exists | Needs code-aware questions |
| **Capstone / Final-year projects** | High stakes, oral defense normal | Long sessions, latency hurts |
| **Honors / integrity office** | GenAI anxiety, budget for integrity | Political sensitivity |

Best first customer profile: **one department chair** running capstones who already does oral exams manually and wants to scale review, not replace it.

**Pricing hint:** Don't price per student initially. Price **per course / per cohort** with a pilot fee + success metric ("instructor time saved on review").

---

## Defensibility (what makes this a business, not a feature)

LMS vendors could add "AI oral quiz." Your moat needs to be:

1. **Provenance graph** — "why this question, from which excerpt" (you have this; productize it in UI).
2. **Instructor trust workflow** — modification audit, evidence bundles (strong ADR-008).
3. **Domain-tuned eval** — calibration per discipline/rubric over time.
4. **Compliance packaging** — hard for Notion-wrapper startups to copy.

Right now moat is **architecture + positioning**, not data or workflow lock-in. Pilots must generate **instructor feedback loops** you feed back into question/eval quality.

---

## Prioritized 90-day plan (if I were mentoring you)

**Days 1–30 — "Pilot-safe"**
1. Production deploy (AWS/GCP/Fly + managed Postgres/Redis/S3)
2. Fix viva UX reliability (latency, duplicate speech, last-question flow — in progress)
3. Server STT option + full session transcript storage
4. Real-LLM eval suite (50+ cases) + one instructor usability study (n=5)
5. Privacy policy, DPA template, security one-pager

**Days 31–60 — "First paid pilot"**
6. Instructor monitoring view (session list, status, export)
7. SSO via Google/Microsoft OIDC (good enough for many unis)
8. E2E tests + staging environment
9. OCR for scanned PDFs OR explicit "unsupported" with conversion guide
10. Sales collateral: 3-min demo video, pilot proposal template, ROI story

**Days 61–90 — "Repeatable"**
11. LTI 1.3 basic (launch + grade passback)
12. Usage/billing hooks (even if manual invoicing)
13. Analytics v1 (completion rate, avg viva duration, instructor override rate)
14. Second pilot in a different discipline to prove generalization

---

## Bottom line

| Question | Answer |
|----------|--------|
| **Is the idea sellable?** | Yes — timing and positioning are strong. |
| **Is *this build* sellable today?** | Only as a **free/discounted design partner pilot**, not as production SaaS. |
| **Biggest risk?** | Live experience quality (speed, voice, edge cases) undermines trust before AI quality is even debated. |
| **Biggest opportunity?** | You're on the right side of academic policy (HITL, evidence, no detection claims). |

**My advice:** Don't "start selling" broadly. Sign **1–2 design partners** with written pilot agreements, fix what breaks in their real courses, then charge. Universities buy **trust and compliance**, not features on a README.

If you want, I can turn this into a one-page **pilot readiness checklist** or a **pitch deck outline** for dept chairs — still in Ask mode, so I'd provide the content for you to use, not edit the repo.