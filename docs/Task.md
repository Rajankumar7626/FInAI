# Task: Create `TASKS.md` — FinSight AI Implementation Roadmap

**Role:** Senior Technical Project Manager and Software Architect.

## Objective

Create or update the root-level `TASKS.md` for **FinSight AI — AI-Powered Multi-Agent Financial Analysis System**.

This file must divide development into small, ordered, independently verifiable tasks. AI coding agents must use it to understand project progress, choose the next task, implement incrementally, and avoid attempting to build or refactor the entire application in one prompt.

## Mandatory Instructions

1. Inspect the current repository and its Git status before planning.
2. Read `RULES.md` and the relevant files in `docs/`, especially `PRD.md`, `ARCHITECTURE.md`, `DESIGN.md`, and `TEST_PLAN.md`, if present.
3. Inspect the actual frontend, backend, agents, orchestration modules, tests, and configuration.
4. Preserve existing completed work. Do not treat an existing feature as incomplete merely because it is absent from an old checklist.
5. Create or update **only `TASKS.md`**.
6. Do not implement application features, install packages, or change Git state.

## Required Structure

### 1. Project Status

Include:
- Project name and objective
- Current development phase
- How task completion is verified
- A reminder to inspect the repository before selecting a task

Do not invent a completion percentage or project status.

### 2. Task Status Convention

Use these statuses:

- `[ ]` Not started
- `[x]` Completed and verified
- `[!]` Blocked
- `[~]` In progress

A task can be marked completed only after its implementation and required verification have been inspected. Existing code alone is not sufficient evidence that the task is complete.

### 3. Phased Roadmap

Build a realistic roadmap for the existing FinSight AI project using the phases below. Adapt the tasks to the actual repository and mark already verified work accordingly.

**Phase 1 — Repository and Documentation**
- Verify project structure and development commands.
- Review and maintain project documentation.
- Establish development rules and architecture constraints.
- Identify existing tests and quality gates.

**Phase 2 — Environment and Application Foundation**
- Verify backend startup and configuration.
- Verify frontend startup and API connectivity.
- Validate environment-variable handling.
- Confirm safe local development defaults.

**Phase 3 — Document Processing**
- Verify document upload and input validation.
- Test document parsing and text extraction.
- Validate document identity and source metadata.
- Test empty, malformed, and unsupported documents.

**Phase 4 — Financial Extraction**
- Verify financial metric extraction.
- Validate units, currencies, reporting periods, and source references.
- Handle missing, conflicting, and malformed values.
- Add regression tests for extraction failures.

**Phase 5 — Research and Evidence**
- Verify retrieval and evidence relevance.
- Validate research question analysis and orchestration.
- Verify claim validation and evidence sufficiency.
- Prevent unsupported financial claims.
- Test cross-document isolation and conflicting evidence.

**Phase 6 — Red Flag Analysis**
- Verify risk classification and supporting evidence.
- Test false-positive and false-negative scenarios.
- Validate missing-data handling.
- Test model failures and incomplete analysis.

**Phase 7 — Financial Comparison**
- Verify company and period matching.
- Validate calculation and normalization rules.
- Test incompatible units, currencies, and missing values.
- Ensure comparisons do not invent unavailable metrics.

**Phase 8 — Report Generation**
- Verify report assembly and formatting.
- Preserve financial figures, reporting periods, and evidence.
- Test incomplete inputs and agent failures.
- Verify download or export behavior only where implemented.

**Phase 9 — Frontend Integration and UX**
- Verify existing pages and navigation.
- Test API integration and state management.
- Validate loading, empty, success, error, and partial-result states.
- Check responsive layouts and accessibility basics.
- Avoid duplicating existing UI functionality.

**Phase 10 — Security and Reliability**
- Validate uploads and input handling.
- Review secret management and logging.
- Test prompt-injection resistance.
- Test timeouts, retries, and partial failures.
- Verify document isolation and cleanup behavior.

**Phase 11 — Integration, Regression, and Release**
- Run the available backend and frontend test suites.
- Validate complete supported workflows.
- Review outstanding defects and security issues.
- Verify build and deployment configuration.
- Document known limitations and release readiness.

Do not assume every phase needs new implementation. Some phases may require only verification, regression tests, or documentation.

### 4. Task ID and Task Format

Give every task a unique, stable ID, such as `TASK-001`.

Use this format:

#### TASK-001 — Verify Backend Startup

- **Phase:** Environment and Application Foundation
- **Status:** Not started / In progress / Blocked / Completed
- **Priority:** Critical / High / Medium / Low
- **Type:** Implementation / Testing / Documentation / Verification
- **Dependencies:** Relevant task IDs, or None
- **Scope:** Exact behavior or files involved
- **Acceptance criteria:**
  - [ ] The backend starts using the verified project command.
  - [ ] Required configuration is validated.
  - [ ] Relevant tests pass.
  - [ ] No unrelated files are modified.
- **Verification:** Exact command or manual procedure.
- **Notes:** Known constraints or unresolved issues.

Keep tasks small enough to implement and verify in one focused coding session. Split tasks that involve multiple independent components or substantial architectural changes.

### 5. Task Ordering and Dependencies

- Assign IDs in a stable order.
- Document dependencies explicitly.
- Do not begin a task while its mandatory prerequisites remain incomplete.
- Allow independent tasks to proceed separately where safe.
- Prioritize correctness, security, and core workflow reliability over cosmetic improvements.
- Do not create tasks for features that already exist and are verified unless additional testing or improvement is needed.

### 6. Definition of Done

A task is complete only when:
1. Its scope and acceptance criteria are satisfied.
2. Relevant tests or verification steps have been executed.
3. Existing behavior has not been unintentionally broken.
4. Documentation has been updated where necessary.
5. The diff contains no unrelated changes.
6. The actual verification result is recorded.

If a test cannot be run, record the blocker and do not falsely mark the task completed.

### 7. AI Agent Execution Protocol

Every coding agent working on the project must follow this sequence:

1. Read `RULES.md` and the relevant project documentation.
2. Inspect `TASKS.md` and the actual repository state.
3. Select **one task only**.
4. Confirm that its dependencies are satisfied.
5. State the task ID, scope, planned changes, and verification steps.
6. Implement only that task.
7. Run relevant tests and inspect the diff.
8. Report actual results and any remaining issues.
9. Update the task status only when the completion criteria are satisfied.
10. Stop and wait for the next instruction.

Do not automatically start the next task after finishing the current one.

### 8. Blockers and Changes in Scope

- Record blocked tasks and the reason they are blocked.
- Do not silently skip dependencies.
- If new work is discovered, add a task with a unique ID.
- If scope changes, explain the impact before making substantial changes.
- Preserve task history and IDs instead of renumbering tasks unnecessarily.
- Do not mark a task complete solely to make the roadmap appear current.

### 9. Current Task Summary

At the end, include a concise summary of:
- Completed and verified tasks
- Tasks in progress
- Blocked tasks
- Next recommended task
- Outstanding critical risks

Derive this summary from the actual repository and task statuses.

## Final Deliverable

Create or update only the root-level `TASKS.md`. Then report the file path, the roadmap structure, the next recommended task, and any verification limitations.