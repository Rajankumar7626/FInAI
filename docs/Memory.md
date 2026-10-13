# Task: Create `MEMORY.md` — FinSight AI Project State

**Role:** Senior Software Architect and AI Coding Agent Context Manager.

## Objective

Create or update the root-level `MEMORY.md` for **FinSight AI — AI-Powered Multi-Agent Financial Analysis System**.

This document must provide a concise, accurate snapshot of the project's current state so that a new AI coding session can continue work without guessing what has been implemented, what remains incomplete, or what should happen next.

**Important:** Inspect the actual repository before writing. Do not invent project progress or claim tests passed without verification.

## 1. Sources of Truth

Inspect these files if present:

- `RULES.md`
- `TASKS.md`
- `DECISIONS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DESIGN.md`
- `docs/TEST_PLAN.md`
- `docs/SECURITY.md`
- Relevant source code, test files, configuration, and Git status

Prioritize verified implementation and test results over outdated notes.

If documentation conflicts with the source code, record the discrepancy rather than silently assuming either is correct.

Create or update **only `MEMORY.md`**. Do not modify source code, install packages, or change Git state.

## 2. Required Document Structure

### Project Memory

Include the project name, purpose, and a brief description of the current implementation.

### 1. Current Status

Summarize the actual state of the major components:

- Frontend
- Backend API
- Document processing
- Financial extraction
- Research and evidence retrieval
- Red Flag analysis
- Company comparison
- Report generation
- Testing and quality assurance
- Documentation

Use concise statuses such as:
- Verified
- In progress
- Needs verification
- Blocked
- Not implemented

Do not use "Verified" without supporting evidence.

### 2. Completed Work

List important features and tasks that have actually been completed and verified.

For each meaningful item, include:
- What was completed
- Relevant file paths or modules
- Tests or verification performed, if known

Do not duplicate every task from `TASKS.md`. Summarize the major milestones.

### 3. Current Task

Record:

- Task ID from `TASKS.md`, if available
- Task title
- Objective
- Relevant files
- Dependencies
- Acceptance criteria
- Current blocker, if any

If no task is actively in progress, explicitly state that no active task has been confirmed. Recommend the next task based on the actual roadmap without marking it as started.

### 4. Known Issues

Record verified issues and unresolved questions.

For each issue, include:
- Description
- Affected component
- Severity or priority
- Reproduction steps, when known
- Current status
- Recommended next action

Separate confirmed defects from suspected problems and unverified observations.

### 5. Recent Changes

Summarize significant recent changes discovered from the available project history, documentation, or Git state.

Do not invent commit history or assume uncommitted changes were saved.

Include relevant architecture, agent, API, or testing changes when they materially affect the next development step.

### 6. Testing Status

Record the actual verification status of:

- Backend tests
- Frontend tests
- API tests
- Agent-specific tests
- Integration workflows
- Build, lint, and type checks

Include exact commands and actual results when known.

Distinguish between:
- Passed
- Failed
- Not run
- Blocked
- Not configured

Do not copy old test counts into the current status without verifying that they still apply.

### 7. Environment and Commands

Document verified local development commands and prerequisites.

For example, inspect whether these commands are appropriate for the current repository:

**Backend**
```powershell
python -m uvicorn backend.api:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend**
```powershell
cd "front end"
npm install
npm run dev
```

Include only commands that match the actual project configuration. Never include secret values or credentials.

### 8. Important Constraints

Summarize constraints that the next AI coding session must remember:

- Rules in `RULES.md`
- Accepted decisions in `DECISIONS.md`
- Current architecture and API contracts
- Financial accuracy and evidence-grounding requirements
- Security and privacy requirements
- Testing expectations
- Files or modules that should not be changed without justification

Do not copy entire documents into memory. Link their responsibilities by filename.

### 9. Next Steps

List the next three to five recommended tasks in priority order.

For each task, include:
- Task ID, if available
- Short title
- Why it matters
- Dependencies
- Definition of completion

Base the list on `TASKS.md`, known issues, and the actual repository state.

### 10. Session Handoff

End with a short handoff that another AI coding session can use immediately:

- What the project currently does
- What was most recently verified
- What is not yet verified
- Which task should be picked up next
- Which documentation should be read before coding

## 3. Memory Maintenance Rules

- Keep `MEMORY.md` concise, factual, and easy to scan.
- Update it after meaningful milestones, bug fixes, or verification sessions.
- Do not update it for every minor code edit.
- Preserve useful context across sessions without storing secrets or unnecessary personal information.
- Do not treat proposed features as completed work.
- Do not treat a task as complete just because code exists.
- Do not change permanent architecture decisions here; update `DECISIONS.md` through its established process.
- Keep detailed task tracking in `TASKS.md`.
- Keep test strategy in `docs/TEST_PLAN.md`.
- Reference relevant file paths instead of copying large implementation details.
- If a fact is unknown, state **Unknown** or **Needs verification**.
- If no task is currently active, say so rather than inventing one.

## 4. Validation Before Completion

Before finishing:

1. Check the current task statuses against `TASKS.md`.
2. Verify important completed-work claims against source code and tests.
3. Confirm test results and commands are accurate.
4. Identify inconsistencies between project documentation and implementation.
5. Ensure that no secrets or confidential financial information are included.
6. Create or update only the root-level `MEMORY.md`.

## Final Response

Report:
- The file path created or updated.
- The current project status.
- The active or next recommended task.
- Any critical issues or unknowns.
- Confirmation that no other files were modified.