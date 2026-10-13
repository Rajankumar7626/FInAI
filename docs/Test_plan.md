# Task: Create `docs/TEST_PLAN.md`

**Role:** Senior QA Engineer, Test Architect, and AI Agent Evaluation Specialist.

## Project Context

You are working on **FinSight AI**, an AI-powered multi-agent financial analysis platform built with a React + TypeScript + Vite frontend and a Python FastAPI backend.

The system includes specialized agents and workflows for:

- Financial document processing
- Financial metric extraction
- Financial research and evidence retrieval
- Red flag and financial risk analysis
- Company comparison
- Financial report generation

The backend also contains orchestration modules related to evidence sufficiency, claim validation, financial calculations, fact extraction, question analysis, research reasoning, and research state management.

The repository may have changed recently. Inspect the current codebase before documenting its testing strategy.

## Primary Objective

Create or update **only `docs/TEST_PLAN.md`**.

The document must describe how FinSight AI should be tested, which tests already exist, which behaviors remain unverified, and how developers can run and interpret the tests.

Do not modify application source code, add test files, install packages, change dependencies, or modify Git state.

## 1. Repository Inspection

Inspect the actual repository before writing the document.

Check, where present:

- Backend API and route definitions
- Backend agent implementations
- Orchestration modules
- Financial calculation and validation logic
- Document ingestion and extraction pipeline
- Research and evidence retrieval services
- Red Flag, Comparison, and Report agents
- Frontend pages and reusable components
- Frontend API client and application state
- Test directories, test files, fixtures, and configuration
- `pyproject.toml`, `pytest.ini`, `setup.cfg`, `tox.ini`, `requirements*.txt`, and other relevant configuration files
- `package.json` and frontend testing configuration
- CI workflows, if present
- Existing architecture, PRD, security, and design documentation

Trace actual imports, function calls, API contracts, and agent dependencies where necessary.

Do not assume a test framework or test command exists simply because it is common.

## 2. Required Document Structure

Create `docs/TEST_PLAN.md` with the following sections.

### 1. Purpose and Scope
- Purpose of the test plan
- Features and components covered
- In-scope and out-of-scope testing
- Testing objectives and quality expectations

### 2. System Under Test
Document the actual architecture relevant to testing:
- Frontend
- FastAPI backend
- Specialized agents
- Orchestration modules
- Document and evidence processing
- External services or model providers, if implemented
- Persistence and storage, if implemented

Distinguish confirmed implementations from planned or unverified functionality.

### 3. Testing Strategy
Describe appropriate testing levels:

- **Unit testing:** Individual functions, validators, calculators, schemas, and utilities.
- **Integration testing:** Interactions between API routes, services, retrieval components, and agents.
- **API testing:** Request validation, response schemas, HTTP status codes, and error handling.
- **End-to-end testing:** Complete workflows from document upload to final results, where supported.
- **Frontend testing:** Rendering, navigation, forms, API integration, loading states, and error states.
- **AI output evaluation:** Factual correctness, evidence grounding, hallucination resistance, and output consistency.
- **Regression testing:** Previously fixed bugs and known failure cases.
- **Security and privacy testing:** File validation, document isolation, input handling, and sensitive-data exposure.
- **Performance testing:** Document processing, retrieval, and analysis latency where measurable.

For each level, explain its purpose, recommended scope, and relevant components. Clearly identify which levels are actually implemented and which are recommendations.

### 4. Test Environment and Prerequisites
Document verified requirements:
- Python version and backend dependencies
- Node.js and npm requirements
- Environment variables
- Required API keys or external services
- Local test fixtures
- Database, vector store, or other infrastructure requirements, if applicable

Separate tests that run locally without external services from tests requiring credentials, network access, or third-party APIs.

Never include real API keys, tokens, passwords, or personal data.

### 5. Test Frameworks and Commands
Identify the actual testing frameworks and configuration files.

Provide exact commands only when supported by repository configuration or verified scripts.

Include relevant commands for:
- Running the complete backend test suite
- Running an individual test file
- Running tests for a specific agent or service
- Running frontend tests, if configured
- Running linting, type checking, or build verification, if configured

If a command has not been verified, label it **Unverified** or provide it as a recommended command rather than claiming it works.

Do not install anything or execute destructive operations.

### 6. Unit Test Plan
Create a table with these columns:

| Component | Test scenario | Expected result | Existing coverage | Priority |
|---|---|---|---|---|

Cover applicable areas such as:
- Request and response schemas
- Financial metric extraction
- Financial calculations and ratio calculations
- Claim validation
- Evidence sufficiency
- Research question analysis
- Retrieval and relevance filtering
- Red flag classification
- Comparison logic
- Report formatting and generation
- Error handling and utility functions

Only include components that exist in the repository or clearly label proposed tests.

### 7. API and Integration Test Plan
Document actual API routes and their expected behavior.

For each relevant route, cover:
- Valid requests
- Missing or malformed fields
- Invalid file types or empty uploads
- Unsupported or corrupt documents
- Missing configuration or unavailable external services
- Appropriate HTTP status codes and error responses
- Response schema validation
- Integration with the relevant agent or orchestration flow

Use the actual route paths and payload schemas found in the code. Do not invent endpoints.

### 8. Multi-Agent Workflow Testing
Define tests for applicable workflows:

**Single-company analysis**
1. Submit a financial document.
2. Process and extract supported financial information.
3. Retrieve relevant evidence.
4. Perform research and risk analysis.
5. Generate the final output or report.

**Company comparison**
1. Supply documents or data for multiple companies.
2. Validate each company's extracted metrics.
3. Normalize compatible metrics and reporting periods.
4. Compare only supported values.
5. Report missing or incompatible information explicitly.

**Research and evidence**
- Claims must be traceable to relevant evidence.
- Unsupported claims must not be presented as verified facts.
- Missing evidence must be handled explicitly.
- Conflicting values must be identified or resolved according to documented rules.
- Calculated values must be distinguishable from source-reported values.

**Red Flag analysis**
- Genuine financial concerns should be detected when supported by evidence.
- Normal financial variations should not automatically become severe warnings.
- Missing information must not be treated as proof of financial distress.
- Risk explanations should identify supporting evidence when available.

**Report generation**
- The report should accurately represent the analysis output.
- Financial values, reporting periods, and source references must remain consistent.
- Partial failures should be handled according to the actual implementation.

Mark unsupported or unimplemented workflows as proposed tests.

### 9. Financial Accuracy and Edge Cases
Include scenarios for:
- Missing, null, zero, and negative financial values
- Currency differences and unit conversions
- Thousands versus millions versus billions
- Fiscal-year and reporting-period mismatches
- Percentage and growth-rate calculations
- Division by zero
- Rounding and precision
- Conflicting figures across document sections
- Restated financial results
- Incomplete financial statements
- Non-standard or malformed extracted values

Specify expected behavior based on implemented business rules. If no rule exists, document the gap rather than inventing the expected behavior.

### 10. AI Quality and Evaluation
Define measurable evaluation criteria where feasible:
- Extraction accuracy
- Claim-to-evidence alignment
- Financial calculation correctness
- Unsupported-claim rate
- False-positive and false-negative risk detection
- Comparison consistency
- Report completeness
- Handling of ambiguous questions
- Reproducibility and regression stability

Recommend a small, version-controlled evaluation dataset containing known financial facts, evidence references, expected calculations, and expected risk outcomes.

Separate deterministic assertions from model-quality judgments. Use tolerances where appropriate for numerical calculations.

Do not claim an evaluation score unless an actual evaluation has been run and its results are available.

### 11. Frontend Testing
Use the actual pages and components discovered in the repository.

Where applicable, cover:
- Application startup and route navigation
- Document upload and validation
- API request and response handling
- Loading, empty, success, and failure states
- Financial tables, metrics, and charts
- Research evidence and risk explanations
- Company comparison
- Report preview or download
- Analysis history and settings
- Responsive layouts and accessibility basics

Document existing automated coverage separately from manual checks and recommended future tests.

### 12. Security and Reliability Tests
Include applicable tests for:
- Unsupported file types and oversized uploads
- Malformed documents
- Unsafe file handling
- Invalid or malicious input
- Secrets in logs and error responses
- Cross-document evidence contamination
- Prompt injection in uploaded documents
- Timeouts, retries, and external service failures
- Partial agent failures
- Repeated requests and duplicate processing
- Temporary-file cleanup and sensitive document retention

Only describe protections that are confirmed in the source code as implemented.

### 13. Test Fixtures and Test Data
List actual fixtures and their purposes.

For each fixture, document:
- File path
- Data or document type
- Intended test usage
- Expected output, if defined
- Whether the fixture is synthetic, public, or otherwise approved for testing, if known

Inspect existing fixtures such as `data/abb_2025_report.txt` if they are still present.

Prefer synthetic or approved public financial data. Never introduce confidential financial documents or real secrets.

### 14. Regression Test Matrix
Create a prioritized matrix:

| ID | Component | Regression scenario | Expected behavior | Test status |
|---|---|---|---|---|

Include known bug-prone areas found in the code or existing tests, such as:
- Incorrect financial metrics
- Unsupported or fabricated claims
- False-positive financial risk flags
- Inconsistent company comparisons
- Incorrect API error handling
- Failed model-provider requests
- Broken document-processing workflows

Do not invent historical bugs. Label newly proposed regression scenarios as proposed.

### 15. Execution and Release Criteria
Define a practical release checklist covering:
- Required automated tests
- Critical workflow verification
- No known critical failures
- Financial calculation correctness
- Evidence traceability
- Security checks
- Frontend build or type checking where configured
- Review of newly introduced regressions

Clearly label recommended release gates versus gates already enforced by CI.

### 16. Known Gaps and Next Steps
List the highest-priority missing tests and evaluation capabilities based on repository inspection.

For each gap, explain:
- Why it matters
- Which component is affected
- The recommended next action
- Priority: Critical, High, Medium, or Low

## 3. Test Status Rules

Use only these statuses:

- **Verified existing:** Test code exists and its relevant execution or assertion has been verified.
- **Existing, not run:** Test code exists but was not executed during this task.
- **Proposed:** Recommended test not currently implemented.
- **Blocked:** Cannot be run because a documented prerequisite is unavailable.
- **Failed:** A test was executed and failed.

Do not mark a test as passing based on its filename, comments, or previous reports. Record the actual execution result and relevant command where available.

If tests are executed, report the number passed, failed, skipped, and blocked only when the test runner provides those results.

## 4. Documentation Quality Requirements

- Use clear, professional Markdown.
- Use tables for test matrices and coverage summaries.
- Add stable test IDs such as `UNIT-001`, `API-001`, `AI-001`, and `E2E-001`.
- Reference real repository paths.
- Distinguish implemented behavior from proposed tests.
- Avoid duplicating the entire architecture document.
- Explain important assumptions and unresolved questions.
- Keep the plan actionable for future contributors.

## 5. Validation Before Completion

Before finishing:

1. Confirm every referenced file path exists or explicitly label it unverified.
2. Confirm test commands against the actual project configuration.
3. Verify any test results claimed in the document.
4. Ensure no invented endpoints, frameworks, coverage percentages, or passing results.
5. Ensure the document does not expose secrets or sensitive financial information.
6. Create or update only `docs/TEST_PLAN.md`.

## Final Response

After completing the document, provide:
- The file path created or updated.
- A short summary of the test strategy documented.
- The actual test commands verified.
- Tests executed and their real results, if any.
- The most important uncovered testing gaps.
- Any assumptions or blockers that remain.

Do not claim the project is fully tested unless the evidence supports that conclusion.