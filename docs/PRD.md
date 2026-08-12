# Product Requirements Document — AI Viva

**Version:** 0.1 (Phase 0)  
**Tagline:** Assess understanding, not AI usage.

## 1. Problem

Instructors cannot reliably determine whether students understand work submitted under their name when generative AI can produce plausible assignments. Traditional AI detectors estimate whether text was machine-generated; they do not verify comprehension and are contested in academic policy.

## 2. Solution

AI Viva lets instructors configure assignments with learning outcomes and rubrics, accepts student submissions (documents, presentations, code), builds an internal representation of the work, plans personalized viva questions, conducts an adaptive session (text or voice), evaluates answers against evidence and rubric criteria, and generates an assessment package for instructor review—with citations to submission content where possible.

## 3. Goals

- Demonstrate **understanding** through dialogue grounded in the student’s own submission.
- Provide **traceable evidence** (answers, chunks, rubric links) for each assessment dimension.
- Enforce **human-in-the-loop**: AI recommends; instructors approve or modify.
- Support **multi-tenant** institutions with server-side isolation.
- Run **locally via Docker** for demos, portfolio, and interview discussion.

## 4. Non-goals (MVP)

- Definitive AI-authorship detection.
- Automatic final grading without instructor action.
- Full LMS replacement or university ERP.
- Executing untrusted student code on application servers.
- Server-side voice pipelines in MVP (browser Web Speech API instead).

## 5. Users

| Persona | Needs |
|---------|--------|
| **Instructor** | Courses, assignments, rubrics, submission review, viva monitoring, assessment review/modification |
| **Student** | View assignments, upload/connect submissions, complete viva, see permitted status |
| **Organization admin** | Users, org settings, audit visibility (focused on assessment, not full ERP) |

## 6. Core workflow

1. Instructor creates assignment, learning outcomes, rubric, viva settings → publishes.
2. Student submits work → async processing → submission ready.
3. System plans questions with provenance → student starts viva.
4. Adaptive Q&A updates understanding state until session completes.
5. System generates assessment → instructor reviews evidence → finalizes.

## 7. Success metrics (product)

- End-to-end demo path completable without paid AI keys (mock provider).
- Instructors can answer “why was this question asked?” via provenance.
- Every assessment criterion links to student answers and/or submission evidence.
- Tenant data cannot be accessed across organizations via API.

## 8. Constraints

- Backend: Django + DRF + Channels + Celery; not FastAPI.
- Frontend: React + Vite + TypeScript + Tailwind; not Next.js.
- Vectors: pgvector in PostgreSQL; not a separate vector DB for MVP.
- Default `AI_PROVIDER=mock`.

## 9. Roadmap pointer

Phased delivery: [development-plan.md](development-plan.md). Future V2/V3 items: [roadmap.md](roadmap.md).
