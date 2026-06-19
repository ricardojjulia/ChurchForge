# IMPROVE-SOFTWARE — ChurchCore LMS Council Review Protocol

This file defines the repeatable 4-agent council review process for advancing ChurchCore LMS toward MVP, security compliance, and competitive readiness. Run this council at the end of every major sprint or when deciding the next implementation priority.

---

## When to Run the Council

- After merging a significant feature branch
- Before planning the next sprint
- When the product backlog needs reprioritization
- After any production incident or user feedback cycle
- At minimum: once every two weeks of active development

---

## Council Structure

The council always runs 4 agents in parallel, each with a distinct audit lens. They do not edit code. They read and report. A fifth synthesis step (human or AI) combines findings into ADRs and implementation prompts.

| Agent | Role | Focus |
|-------|------|-------|
| **Agent 1** | Database & API Audit | Migrations, lib utilities, API routes, seed data, security gaps |
| **Agent 2** | Route & Page Audit | App navigation links, 404s, stub pages, API coverage |
| **Agent 3** | UX & Shell Audit | ARIA, loading states, error handling, mobile responsiveness, CSS |
| **Agent 4** | Feature & Competitive Audit | Feature completion, user-role boundary coverage, competitive gaps, MVP score |

---

## Agent Prompts

Copy these verbatim when spawning agents. Replace `[REPO_ROOT]` with the actual path.

### Agent 1 — Database & API Audit

```
You are Council Agent 1 for ChurchCore LMS. Your job is a database and API state audit. READ-ONLY — do not edit any files.

Repo root: [REPO_ROOT]

Produce a structured report covering:

1. Migrations — count all CREATE TABLE statements in supabase/migrations/. List each table, whether it has Row Level Security (RLS) enabled, and flag any tables that have no corresponding references in the TypeScript application files.

2. Lib & Server Utilities — list major directories under lib/ (e.g. lib/communications/, lib/supabase/, lib/shepherd-ai/). For each: note key types and check if there are matching repository/service files and unit/integration tests present under tests/ or near the source. Flag gaps.

3. API Routes — list every file under app/api/ (e.g. app/api/ai/route.ts, app/api/demo/feedback/route.ts). Note HTTP method from export names.

4. App Pages — list every page.tsx under app/. Flag any that call redirect() instead of rendering content and any that are empty stubs.

5. Seed data — check supabase/migrations/ or seed files for seed INSERT statements. Is the demo/seed dataset realistic? What is missing?

6. Top 5 critical missing pieces for database/API security and MVP completeness — be specific and honest.

Return concise structured markdown. Target 500–700 words.
```

### Agent 2 — Route & Page Audit

```
You are Council Agent 2 for ChurchCore LMS. Your job is a route and page audit. READ-ONLY — do not edit any files.

Repo root: [REPO_ROOT]

1. Shell nav inventories — read components/application/app-shell.tsx, components/application/member-bottom-nav.tsx, and components/application/reports-shell.tsx. List every nav href.

2. Page existence check — for every href, verify whether a page.tsx exists in app/. Mark each: EXISTS / STUB (calls redirect or <5 lines) / MISSING (404).

3. API route completeness — for every client form or button that does a fetch/POST/PATCH/DELETE, verify the corresponding API route exists under app/api/. Report any orphaned handlers.

4. Link consistency — look for hardcoded hrefs in page files that point to routes not covered by existing pages.

5. Summary table — | Route | Shell | Page Status | Notes |

Return concise structured markdown. Be specific — name every 404 and stub. Target 400–600 words.
```

### Agent 3 — UX & Shell Audit

```
You are Council Agent 3 for ChurchCore LMS. Your job is a UX and shell quality audit. READ-ONLY — do not edit any files.

Repo root: [REPO_ROOT]

1. ARIA correctness — scan shell components and key page files (using Mantine and Lucide components). Check: aria-expanded, aria-selected, aria-label, aria-current. Flag strings used where booleans are needed, or missing where required.

2. Loading and empty states — for each major church-admin, pastor, giving, finance, and member page, does it handle empty data collections gracefully? Is there a loading skeleton or Mantine Loader? Does it crash on empty arrays?

3. CSS/Styling completeness — read next.config.ts, postcss.config.mjs, and look for global CSS styles. Are referenced CSS classes defined? Is there mobile responsiveness?

4. Shell nav active state — how does each layout identify the active nav item? Is it implemented consistently across app-shell and member-bottom-nav?

5. Error handling — are there error.tsx files at app/ level or layout levels? Do server components handle DB errors or let them bubble and crash?

6. Top 3 UX pain points a real user would hit today.

Return concise structured markdown. Be specific. Target 400–600 words.
```

### Agent 4 — Feature & Competitive Audit

```
You are Council Agent 4 for ChurchCore LMS. Your job is feature completeness and competitive gap analysis. READ-ONLY — do not edit any files.

Repo root: [REPO_ROOT]

Read first:
- [REPO_ROOT]/DEVELOPMENT_PLAN.md
- [REPO_ROOT]/docs/security-role-access-matrix.md
- [REPO_ROOT]/docs/tenant-data-segmentation.md

Then audit the actual implementation:

1. Workflow completion — check the progress of the core ChurchCore modules (Member Care, Volunteer Scheduling, Children's Check-in, Events & Registrations, Giving & Finances, Communications, and AI Governance). Give % for each.

2. User role coverage — rate 0–100% role-based access validation for: Super-Admin (Control Plane), Church-Admin, Pastor, Secretary, Ministry-Leader, Teacher, Member.

3. Core operations workflows — rate completeness for: Child Checkin/Checkout Security, Double-entry general ledger, Resend/Twilio dispatch with suppression rules, Impersonation gates, and ADR/HQ Governance logging.

4. Competitive gap — vs. Planning Center Online (PCO), Breeze ChMS, Tithe.ly: the 5 most critical feature/compliance gaps preventing adoption today.

5. MVP readiness score — 0–100 with justification. Be honest.

Return concise structured markdown. Be honest and direct. Target 500–700 words.
```

---

## Synthesis Step (After All 4 Agents Report)

After receiving all 4 agent reports, the synthesis step must produce:

### 1. Cross-Agent Consensus

List findings that multiple agents independently flagged. These are highest priority.

### 2. ADR Drafts

For every architectural decision the council identifies (new boundary, new pattern, new constraint), draft an ADR following the format in `docs/adr/`. Assign the next sequential number.

ADR triggers:
- A new module pattern or boundary (e.g., how error.tsx is structured)
- A new role-based access pattern
- A new integration contract
- A new data exposure rule

### 3. Implementation Prompts

For every agreed-upon change, write a concrete implementation prompt using this template:

```
## Prompt [LETTER] — [SHORT TITLE]

**ADR Reference:** ADR-XXXX (if applicable)
**Files:** [comma-separated list of files to create or modify]
**Scope:** [1–3 sentences describing exactly what to build]

**Work:**
1. [Specific step]
2. [Specific step]
...

**Verification:**
- npm test
- npm run lint
- npm run build
- [Any additional checks]
```

### 4. Execution Order

List prompts in dependency order. Note which are independent (can run in parallel) and which must be sequential.

---

## Output Location

After each council run, commit the following:

- `docs/reviews/YYYY-MM-DD-council-review-[N]-synthesis.md` — full synthesis with prompts
- `docs/reviews/YYYY-MM-DD-council-review-[N]-agent-[1–4]-*.md` — individual agent reports
- `docs/adr/XXXX-*.md` — any new ADRs drafted by the council

---

## Council Quality Rules

- Agents must not edit code.
- Agents must cite specific file paths and line numbers where possible.
- The synthesis must not add scope beyond what agents identified.
- Implementation prompts must be self-contained — a coder reading only the prompt should know exactly what to build.
- Every prompt that touches auth, tenant isolation, or student records must explicitly state what security check is expected.
- ADRs must be committed before implementation begins.
