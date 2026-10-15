# Task: Create `docs/SECURITY.md` — FinSight AI Security Requirements

**Role:** Senior Application Security Engineer, Backend Security Architect, and AI Security Specialist.

## Objective

Create or update `docs/SECURITY.md` for **FinSight AI — AI-Powered Multi-Agent Financial Analysis System**.

This document defines security requirements, threats, verification procedures, and remediation priorities for the project's React + TypeScript + Vite frontend, FastAPI backend, financial document processing pipeline, multi-agent workflows, and any external services actually used.

Security must be considered throughout development—not added immediately before deployment.

## Mandatory Instructions

1. Inspect the actual repository before documenting security controls.
2. Read `RULES.md`, `TASKS.md`, `DECISIONS.md`, `MEMORY.md`, `docs/PRD.md`, and `docs/ARCHITECTURE.md` where available.
3. Inspect backend routes, request schemas, file upload handling, model integrations, document processing, storage, logging, frontend configuration, dependencies, and tests.
4. Distinguish **Implemented**, **Partially implemented**, **Not implemented**, and **Needs verification**.
5. Never claim a security control exists without evidence in source code, configuration, or executed tests.
6. Create or update **only `docs/SECURITY.md`**. Do not modify application code, install packages, or change Git state.

---

## 1. Security Objectives

Define the security goals for FinSight AI:

- Protect uploaded financial documents and extracted information.
- Prevent unauthorized access to documents, analysis results, and reports.
- Protect credentials, API keys, and sensitive configuration.
- Validate requests and uploaded files.
- Reduce risks from malicious documents and prompt injection.
- Prevent cross-document evidence contamination.
- Protect the integrity of financial calculations and reported conclusions.
- Avoid exposing sensitive information through logs, errors, or generated reports.
- Maintain service reliability when inputs or external dependencies fail.

Explain that security controls must be verified against the actual implementation.

## 2. System Security Boundaries

Inspect and document the actual security boundaries between:

- React frontend
- FastAPI backend
- Document upload and processing
- Agent orchestration
- Retrieval and vector storage, if implemented
- Model providers and external APIs, if implemented
- Databases and persistent storage, if implemented
- Generated reports and downloadable artifacts
- Deployment infrastructure

Identify where untrusted data enters the system and where sensitive information is processed.

Do not assume that authentication, authorization, a database, persistent storage, or a particular model provider exists unless confirmed.

## 3. Authentication

Document authentication requirements appropriate to the actual application.

**Current implementation:** The SPA uses Auth0 Universal Login through `@auth0/auth0-react` with memory-only token caching. The API accepts bearer access tokens and validates RS256 signatures from the configured tenant JWKS, issuer, audience, expiry, and required `sub`/`iat` claims. It uses the validated `sub` as the principal ID. There is no local password or account store. Provider configuration is deployment-specific and must be set before protected routes can be used.

If authentication is implemented:

- Verify credentials securely.
- Protect private routes and API operations.
- Enforce session or token validation on the server.
- Handle expired, invalid, and revoked credentials appropriately.
- Avoid exposing authentication tokens to unauthorized scripts or logs.
- Test unauthenticated requests to protected endpoints.

If authentication is not implemented:

- State this explicitly.
- Identify endpoints and data that could be exposed.
- Explain the production risks.
- Define authentication as a required decision or implementation task before exposing sensitive functionality publicly.

Do not mistake frontend route guards for backend authentication.

## 4. Authorization and Data Isolation

Define requirements for resource ownership and access control.

- Users must only access documents, analysis results, and reports they are authorized to access.
- Enforce access control on the server.
- Do not rely solely on frontend checks.
- Prevent insecure direct object reference vulnerabilities.
- Validate document and analysis ownership before returning results.
- Prevent retrieval from mixing information belonging to different users or documents.
- Ensure comparison workflows use only the documents supplied and authorized for that analysis.
- Test unauthorized access, guessed identifiers, and cross-document contamination.

The current ownership model is enforced by the API and uses a process-local registry. It isolates users within one backend process, but documents and ownership are volatile and are not shared across workers. Persistent shared storage and deployment-specific OIDC configuration are required before a multi-worker production deployment.

## 5. Secrets and Configuration

- Never hardcode API keys, passwords, access tokens, or private keys.
- Never expose backend secrets through frontend environment variables or client-side bundles.
- Use the project's established environment-variable configuration.
- Keep local `.env` files out of version control.
- Provide safe example configuration using placeholders only.
- Validate required configuration at startup where appropriate.
- Avoid printing secrets in logs, stack traces, or error messages.
- Rotate credentials if exposure is suspected.
- Use separate credentials and configuration for development and production.
- Restrict access to deployment secrets.

Inspect `.gitignore`, configuration modules, frontend build settings, and actual environment-variable usage.

Do not include secret values in this document.

## 6. Input Validation and API Security

For every relevant FastAPI endpoint, inspect and document:

- Request body validation
- Query and path parameter validation
- Request size limits
- Type and format validation
- Unexpected or missing fields
- Safe error responses
- Appropriate HTTP status codes
- Authentication and authorization requirements, where applicable
- Rate limiting and abuse controls, if implemented
- Timeouts and external-service failure handling

Additional requirements:

- Validate inputs at trust boundaries.
- Use existing typed schemas and validators where appropriate.
- Do not trust frontend validation as a security boundary.
- Avoid leaking stack traces, internal paths, credentials, or sensitive document contents.
- Avoid unsafe dynamic command execution and unsafe file path construction.
- Consider resource exhaustion from unusually large or repeated requests.

Record actual controls separately from recommended controls.

## 7. File Upload and Document Processing Security

Financial documents are a major input boundary for FinSight AI.

Define requirements for:

### File type
- Allow only supported file types.
- Do not trust filename extensions alone.
- Validate content and parser compatibility.
- Reject unsupported formats safely.

### File size and resource limits
- Enforce a maximum upload size.
- Consider limits on extracted text, page count, processing time, and memory consumption.
- Handle decompression and malformed-document risks where applicable.
- Prevent uncontrolled resource consumption.

### Filename and file handling
- Sanitize filenames before display or storage.
- Prevent path traversal.
- Generate safe server-side storage names when necessary.
- Avoid executing uploaded content.
- Use isolated temporary storage where appropriate.
- Clean up temporary files according to retention requirements.
- Avoid publicly exposing uploaded documents or generated artifacts without authorization.

### Parser safety
- Handle corrupt, encrypted, malformed, or unexpectedly structured documents.
- Catch parser failures without exposing internal details.
- Do not trust metadata or embedded instructions.
- Test malicious and malformed inputs using safe test fixtures.

Record actual upload limits, supported formats, storage locations, and cleanup behavior only when verified.

## 8. AI Security and Prompt Injection

Treat uploaded documents, retrieved passages, user questions, and external content as **untrusted data**, not privileged instructions.

Define requirements for:

- Prompt injection resistance
- Instruction/data separation
- Preventing document content from overriding trusted agent instructions
- Preventing unauthorized disclosure of prompts, credentials, or internal configuration
- Restricting model-generated tool calls and side effects, if tools are available
- Validating model output before using it in downstream operations
- Preventing retrieved content from introducing unrelated company or document information
- Handling malformed, adversarial, and irrelevant evidence
- Limiting sensitive information sent to external model providers

For financial analysis specifically:

- Never accept a financial claim as verified solely because a model produced it.
- Preserve source references and evidence provenance where supported.
- Validate financial calculations independently of generated prose.
- Clearly identify unsupported or uncertain claims.
- Prevent missing data from being treated as proof of a financial risk.
- Do not allow a document's embedded instructions to change security rules or grant access.

Document the existing protections and propose tests for any missing safeguards.

## 9. Financial Data Integrity

Define requirements for maintaining the integrity of financial information:

- Preserve source-reported values and relevant reporting periods.
- Keep currencies and units explicit.
- Avoid silent unit conversions.
- Handle missing, zero, negative, and conflicting values correctly.
- Validate calculated metrics and ratios.
- Distinguish extracted facts from derived calculations and model-generated interpretations.
- Prevent unauthorized modification of analysis inputs or outputs.
- Avoid presenting fabricated values as verified financial facts.

Prioritize deterministic calculations and testable business rules for financial arithmetic.

## 10. Database, Vector Store, and Storage Security

Inspect the actual storage implementation.

Where applicable, document requirements for:

- Authentication and least-privilege access
- Secure connection configuration
- Data isolation
- Access policies and permissions
- Protection of stored documents and derived data
- Encryption in transit and at rest, where supported
- Backup security and retention
- Deletion and cleanup
- Vector-store metadata filtering
- Preventing cross-user and cross-document retrieval
- Secure handling of temporary and generated files

If a storage technology or database has not been implemented or verified, mark it accordingly rather than assuming a particular solution.

## 11. Frontend Security

Inspect the actual React frontend.

Define requirements for:

- Keeping secrets out of client-side code
- Avoiding unsafe HTML rendering
- Safe rendering of model-generated content
- Appropriate output encoding
- Avoiding unnecessary storage of authentication tokens or sensitive data
- Handling errors without exposing internal details
- Configuring CORS on the backend rather than relying on frontend restrictions
- Using HTTPS in production
- Avoiding unsafe links and untrusted URL handling
- Restricting development-only tooling in production builds where appropriate

Document actual Content Security Policy, security headers, and other browser protections only if configured and verified.

## 12. External Services and Model Providers

Where external services are used:

- Keep credentials server-side.
- Use explicit timeouts and bounded retries.
- Handle provider errors safely.
- Apply request and usage limits where available.
- Send only the data necessary for the operation.
- Review provider data-retention and privacy requirements before processing sensitive financial documents.
- Avoid logging complete prompts or documents by default.
- Validate external responses before consuming them.
- Prevent retries from causing duplicate side effects.

Identify the actual providers and integration boundaries from the repository.

## 13. Logging, Monitoring, and Error Handling

- Record operational failures without unnecessarily storing sensitive content.
- Never log secrets, credentials, access tokens, or private keys.
- Avoid logging entire financial documents or prompts by default.
- Use request or correlation IDs where supported.
- Return safe client-facing errors.
- Preserve useful internal diagnostics without exposing them publicly.
- Monitor repeated failures and suspicious request patterns where monitoring exists.
- Avoid logging sensitive data from model responses without a justified need.

State which logging and monitoring controls currently exist and which remain recommendations.

## 14. Dependency and Supply-Chain Security

- Keep dependencies explicit and reproducible.
- Review security advisories for relevant packages.
- Avoid unnecessary dependencies.
- Pin or constrain versions according to the project's dependency-management strategy.
- Review dependency changes before merging.
- Protect CI/CD credentials and deployment secrets.
- Avoid executing untrusted scripts or code from uploaded documents.
- Document available dependency audit commands only when supported by the actual tooling.

Do not upgrade dependencies or change lockfiles as part of this documentation task.

## 15. Security Testing Checklist

Create a checklist using these columns:

| ID | Security test | Expected behavior | Current status | Priority |
|---|---|---|---|---|

Include relevant scenarios such as:

- `SEC-001`: Unauthenticated access to protected endpoints
- `SEC-002`: Unauthorized access to another user's resources
- `SEC-003`: Cross-document retrieval isolation
- `SEC-004`: Unsupported upload format
- `SEC-005`: Oversized upload
- `SEC-006`: Malformed or corrupt document
- `SEC-007`: Path traversal attempts
- `SEC-008`: Missing or invalid API request fields
- `SEC-009`: Prompt injection embedded in a document
- `SEC-010`: Model output containing unsupported financial claims
- `SEC-011`: Secrets accidentally exposed in logs or frontend assets
- `SEC-012`: External model-provider timeout or failure
- `SEC-013`: Sensitive information in error responses
- `SEC-014`: Unsafe rendering of generated report content
- `SEC-015`: Rate limiting and resource exhaustion

Adapt the scenarios to the actual architecture. Mark inapplicable tests and explain why.

Use these statuses:

- **Verified:** The control or test has been verified with evidence.
- **Partial:** Some protection exists, but gaps remain.
- **Missing:** Required protection is not implemented.
- **Needs verification:** Insufficient evidence to determine the status.
- **Blocked:** Verification could not be performed because of a prerequisite.

Do not mark a test verified merely because a test file exists.

## 16. Production Readiness Checklist

Create a separate release checklist covering:

- [ ] Authentication and authorization requirements are satisfied for the deployment model.
- [ ] Sensitive resources have appropriate access controls.
- [ ] Secrets are stored securely and excluded from frontend bundles.
- [ ] File type, size, and parser validation are enforced.
- [ ] API inputs and external responses are validated.
- [ ] AI prompt-injection risks are addressed and tested.
- [ ] Evidence isolation and financial integrity checks are verified.
- [ ] Errors and logs do not disclose sensitive information.
- [ ] Storage, retention, and deletion behavior are documented.
- [ ] Dependencies and deployment configuration have been reviewed.
- [ ] Relevant security tests have been executed.
- [ ] Critical security issues are resolved or explicitly block release.
- [ ] Production HTTPS and appropriate security headers are configured where applicable.

This is a target checklist, not proof that the project currently satisfies these requirements.

## 17. Known Gaps and Remediation Plan

Create a prioritized table:

| Gap ID | Finding | Evidence | Risk | Recommended remediation | Priority |
|---|---|---|---|---|---|

Separate:
- Confirmed vulnerabilities
- Missing security controls
- Unverified protections
- Future hardening recommendations

Do not label a suspected issue as a confirmed vulnerability without sufficient evidence.

## 18. Incident Response

Provide a concise response process for suspected credential exposure, unauthorized document access, data leakage, or compromised dependencies:

1. Contain the affected service or access path where appropriate.
2. Revoke or rotate exposed credentials.
3. Preserve relevant logs and diagnostic evidence securely.
4. Identify affected documents, users, and services.
5. Fix the root cause and add regression tests.
6. Verify remediation.
7. Document the incident and follow applicable notification requirements.

Do not include real credentials or sensitive incident data.

## 19. Security Review and Maintenance

Require a security review when:
- Authentication or authorization changes.
- New upload formats or parsers are introduced.
- New agents, tools, or model providers are integrated.
- Storage, retrieval, or document-isolation logic changes.
- API contracts or deployment settings change.
- New dependencies introduce meaningful security risk.

Update `SECURITY.md` when security-relevant architecture or requirements change.

---

## Final Validation

Before finishing:

1. Verify all documented controls against actual source code and configuration.
2. Confirm endpoint names and file paths.
3. Separate existing protections from recommended changes.
4. Identify production blockers clearly.
5. Do not expose secrets or confidential financial information.
6. Create or update only `docs/SECURITY.md`.

## Final Response

Report:
- The file path created or updated.
- Confirmed security controls.
- Missing or unverified controls.
- Highest-priority production risks.
- Any tests actually executed and their results.
- Confirmation that no other files were modified.
