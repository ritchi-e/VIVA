# Plagiarism detection

## Current behaviour (MVP)

Implemented in `backend/submissions/plagiarism.py`. After **each individual viva completes**, post-processing compares that submission against other ready submissions on the **same assignment** using:

- File checksums and content hashes (uploads, repo files, text chunks)
- Identical GitHub repository snapshots (`owner/repo@commit`)
- Embedding similarity between submission chunks (pgvector when available)

Results are stored per submission in `PlagiarismReport` and shown to **instructors only** on the submission detail page (similarity panel + list badges).

This is a **per-submission, incremental** check — not a final assignment-wide report.

---

## Planned behaviour (not implemented yet)

We intend to replace / extend the above with an **assignment-level plagiarism workflow**:

### 1. Instructor deadline for viva slot booking

- The instructor sets a **viva booking deadline** on the assignment (or a related scheduling window).
- Students book slots and complete vivas before or by that deadline.
- Slot booking / new vivas are closed after the deadline passes.

### 2. Batch check after all vivas are done

- Plagiarism is **not** the primary gate during the viva period.
- Once the deadline has passed (meaning all expected students have had the opportunity to complete their viva, or the assignment viva window is closed), the system runs a **single batch plagiarism pass** for the whole assignment cohort.

### 3. One complete report for the teacher (not student-by-student)

Instead of scattered per-submission panels, the instructor gets **one assignment-level report**, for example:

- Whether any plagiarism was detected across the cohort
- **Who** was flagged (student names / submissions)
- **Why** each flag was raised (identical repo, matching files, highly similar text sections, pairwise similarity scores)
- **Evidence details** — matched files, chunk paths, similarity percentages, links between submission pairs
- Summary statistics (e.g. number of pairs above threshold, clusters of similar work)

The report should be suitable for academic review: actionable, auditable, and readable in one place (assignment detail or a dedicated “Plagiarism report” view) rather than requiring the teacher to open every submission individually.

### 4. Relationship to current MVP

| Aspect | Current (MVP) | Planned |
|--------|---------------|---------|
| Trigger | After each viva completes | After assignment viva deadline |
| Scope | One submission vs peers | Full assignment cohort |
| Output | Per-submission `PlagiarismReport` | One assignment-level report |
| UI | Submission detail panel | Assignment-level report for instructor |

The existing hash/embedding comparison logic can be reused for the batch pass; the main work is **scheduling**, **deadline enforcement**, **cohort aggregation**, and **report UI**.

---

## References

- Code: `backend/submissions/plagiarism.py`, `backend/viva/post_process.py`
- Model: `submissions.PlagiarismReport`
- UI: `frontend/src/components/submissions/PlagiarismReportPanel.tsx`
