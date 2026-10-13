# Task: Create `DECISIONS.md` — FinSight AI Architecture Decision Records

**Role:** Senior Software Architect and Architecture Decision Record (ADR) Maintainer.

## Objective

Create or update the root-level `DECISIONS.md` for **FinSight AI**.

This file records important technical decisions, the reasoning behind them, their consequences, and their current status. Its purpose is to prevent AI coding agents from randomly changing frameworks, architectural boundaries, data flow, or technology choices.

## Mandatory Instructions

1. Inspect the current repository and relevant project documentation.
2. Read `RULES.md`, `TASKS.md`, `docs/PRD.md`, and `docs/ARCHITECTURE.md` where available.
3. Inspect actual source code and configuration before recording a decision as established.
4. Create or update only `DECISIONS.md`.
5. Do not modify source code, install dependencies, or change Git state.

## 1. Decision Record Principles

- Record decisions that materially affect architecture, reliability, security, data integrity, or development workflows.
- Explain why each decision was made and which alternatives were considered.
- Distinguish verified existing decisions from proposed decisions and assumptions.
- Never invent a historical discussion or claim that a choice was formally approved when there is no evidence.
- Do not record every minor coding preference as an architectural decision.
- Do not silently reverse an existing decision.
- When a decision needs to change, create a new ADR that explicitly supersedes the old one.
- Preserve old ADRs for historical context.

## 2. Required Document Structure

### Project Overview
Briefly describe FinSight AI and the purpose of this document.

### Decision Status Convention

Use these statuses:
- **Accepted:** Confirmed as the governing decision.
- **Proposed:** Awaiting approval.
- **Deprecated:** No longer recommended.
- **Superseded:** Replaced by a later ADR.

Clearly identify decisions inferred from the existing implementation rather than formally approved.

### Architecture Constraints
Document verified constraints such as:
- Frontend framework and language
- Backend framework and language
- API communication patterns
- Agent responsibilities and boundaries
- Financial calculation and evidence-handling principles
- Testing and security requirements

Only include constraints supported by the repository or existing project documentation.

### Architecture Decision Records

Use this template:

#### ADR-001 — Decision Title

- **Status:** Accepted / Proposed / Deprecated / Superseded
- **Date:** YYYY-MM-DD, only if the date is known
- **Context:** The problem or requirement.
- **Decision:** The selected approach.
- **Reasoning:** Why the approach is appropriate.
- **Alternatives considered:** Other approaches and their trade-offs.
- **Consequences:** Benefits, limitations, and maintenance implications.
- **Affected components:** Actual file paths or modules.
- **Verification:** Evidence supporting the decision.
- **Supersedes / Superseded by:** ADR references, when applicable.

Do not invent dates or approvals.

## 3. Decision Areas to Investigate

Inspect whether decisions exist in the following areas:

1. **Frontend architecture:** React, TypeScript, Vite, component organization, state management.
2. **Backend architecture:** FastAPI, service boundaries, request validation, and API structure.
3. **Multi-agent design:** Responsibilities of Document, Extraction, Research, Red Flag, Comparison, and Report agents.
4. **Orchestration:** How the agents and research modules communicate.
5. **Evidence grounding:** How retrieved evidence supports financial claims.
6. **Financial calculations:** Deterministic calculation logic, units, currencies, and reporting periods.
7. **Document processing:** File validation, parsing, indexing, and source metadata.
8. **Model integration:** Provider configuration, retries, validation, and failure handling, if implemented.
9. **Persistence and retrieval:** Database, vector store, and document-storage choices, if implemented.
10. **API contracts:** Schema validation, error formats, and compatibility.
11. **Security and privacy:** Secret management, file handling, isolation, and retention.
12. **Testing:** Test frameworks, fixtures, and quality gates.
13. **Deployment:** Local development, hosting, environment configuration, and release practices.
14. **Dependency management:** Versioning and upgrade policy.

Do not create an ADR for every category automatically. Include only decisions that are material and supported by evidence. Mark unresolved choices as proposed only when there is a concrete decision to make.

## 4. Prevent Unapproved Architectural Changes

Include these rules prominently:

- Do not replace an existing framework, database, vector store, model provider, or orchestration strategy without explicit approval.
- Do not introduce a new architectural layer or infrastructure service without explaining the need and trade-offs.
- Do not change agent responsibilities or data contracts as an incidental part of another task.
- Do not remove a dependency or integration before checking all affected imports, tests, configuration, and workflows.
- Do not change API contracts without assessing frontend and downstream consumers.
- Do not treat an ADR as permission to implement a change that has not been approved.
- For significant architectural changes, propose a new ADR before implementation.
- Update affected documentation and tests after an approved decision is implemented.

## 5. Relationship to Other Project Documents

Explain the distinct role of each document:

- `RULES.md`: How contributors and AI agents must work.
- `TASKS.md`: What work remains and its verification status.
- `DECISIONS.md`: Why important technical choices exist.
- `docs/PRD.md`: What the product must accomplish.
- `docs/ARCHITECTURE.md`: How the system is structured.
- `docs/DESIGN.md`: How the frontend should behave and look.
- `docs/TEST_PLAN.md`: How correctness and reliability are tested.
- `docs/SECURITY.md`: Security threats, controls, and gaps.
- `docs/MEMORY.md` or `MEMORY.md`: Relevant project context, if present.

Follow the repository's actual documentation paths and naming conventions.

## 6. Updating Decisions

When a new material decision is needed:

1. Explain the problem and relevant constraints.
2. Inspect existing decisions and implementation.
3. Propose realistic alternatives.
4. Explain trade-offs and consequences.
5. Obtain approval when required by project rules.
6. Record the new ADR with a unique ID.
7. Update the architecture documentation and affected tasks where necessary.
8. Preserve previous decisions and mark them superseded when appropriate.

## Final Deliverable

Create or update only the root-level `DECISIONS.md`.

After completion, report:
- The file path created or updated.
- The decisions documented.
- Which entries are verified, inferred, or proposed.
- Any unresolved architectural questions.
- Confirmation that no other files were modified.