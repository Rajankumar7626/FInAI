# FinSight AI Security and Reliability Audit

**Audit date:** 2026-10-15
**Status:** Updated through TASK-019; application implementation verified with synthetic identity tests. Live Auth0 tenant and persistent-storage configuration remain unverified.

## Scope and Architecture

Reviewed the current untracked workspace implementation and its existing `docs/Security.md`, `docs/Architecture.md`, `docs/Test_plan.md`, `docs/Rules.md`, `docs/PRD.md`, `docs/Decision.md`, and `README.md`; backend upload, API, schemas, registry, extraction, risk, comparison, and report modules; frontend API client, dashboard, Vite and Playwright configuration; pytest, Vitest, and Playwright tests; and installed frontend dependency resolution.

The implemented path is React/TypeScript/Vite to FastAPI. PDF multipart requests are parsed by Starlette, copied to a generated temporary file, parsed with pypdf, converted to extracted text, and placed in a process-local registry. Deterministic extraction, risk, comparison, and report logic operate synchronously on that registered text. TASK-019 added Auth0 access-token validation and server-side document ownership. No database, model provider, AI agent, vector store, or production deployment configuration was found. The Auth0 integration has not been connected to a live tenant in this workspace.

The repository had no tracked diff at audit start; `git status --short` showed the existing project directories and files as untracked. No existing `SECURITY_AUDIT.md` or equivalent audit report was found. Those existing workspace changes were preserved.

## Baseline Verification

| Check | Actual result |
|---|---|
| `\.venv\Scripts\python.exe -m pytest tests -q` | Passed: 68 tests; 11 FastAPI/Starlette deprecation warnings |
| `cd front-end; npm run test` | Passed: 2 files, 11 tests |
| `cd front-end; npm run lint` | Passed with no findings |
| `cd front-end; npm run build` | Passed; Vite production build completed |
| `cd front-end; npm run test:e2e` | Passed: 4 browser tests |
| `cd front-end; npm ls --depth=0` | Passed; installed top-level dependencies resolved against the manifest |
| `git diff` at baseline | Empty for tracked files; workspace contents were untracked |

No `npm audit` or `pip-audit` was run. Dependency advisory status is therefore **not assessed**.

## Executive Summary

The core document parser has useful safeguards: the service reads bounded chunks into a generated temporary file, applies a 10 MiB application-level limit, rejects parser-invalid/encrypted/textless PDFs, limits pages and extracted characters, and removes the temporary file in a `finally` block. Schemas reject unknown fields and non-finite extracted metric values, and the deterministic rules preserve source contexts. Automated backend and frontend checks pass.

At audit time, every document endpoint lacked authentication. TASK-019 now validates Auth0 access tokens and enforces ownership on document operations; live-provider configuration remains unverified. The in-memory registry is still volatile and worker-local. A separate resource risk remains before the service-level upload cap: multipart parsing/spooling happens before the route executes. At audit time, synthetic probes also confirmed page-number association, malformed comma-group normalization, and non-finite comparison output. TASK-016 corrected those extraction and arithmetic defects. TASK-017 now leaves an unqualified `$` currency unknown unless USD is explicitly stated in the same evidence context.

No application fixes were made as part of this audit.

## Findings

### SEC-001 — No server-side authentication or document ownership

- **Severity:** High if the API is reachable beyond a trusted local user; otherwise deployment-conditional.
- **Confidence:** High.
- **Status:** Implemented for a configured Auth0 tenant and verified by synthetic-token/API ownership tests; live-tenant setup and deployment controls remain unverified.
- **Affected code:** `backend/auth.py`; protected routes in `backend/api.py`; owner-scoped operations in `backend/document_registry.py`; Auth0 session and API token handling in `front-end/src/main.tsx`, `front-end/src/App.tsx`, and `front-end/src/lib/api.ts`.
- **Evidence:** Every document route depends on a validated bearer access token. PyJWT pins RS256 and validates JWKS signature, configured issuer/audience, expiry, and required `sub`/`iat` claims. The owner ID comes only from the validated `sub`. The registry stores owner IDs and checks listing, retrieval, and deletion under its process-local lock. Unknown and non-owned IDs return the same 404 behavior. `tests/test_auth_ownership.py` covers missing and malformed credentials, bad signature, expiry, wrong issuer/audience, missing provider configuration, protected endpoints, owned workflows, mixed-owner rejection, listing, and non-owned deletion. The SPA uses memory-only token caching and clears workspace state on logout.
- **Preconditions and impact:** The Auth0 domain and API audience must match tenant configuration. The SPA must use its public client ID and exact callback/logout/web-origin allowlists. The registry remains process-local; documents disappear on restart and are not shared across workers.
- **Safe verification:** Synthetic RSA keys exercise JWT signature and claims validation with a mocked JWKS lookup; no real credentials or financial documents were used. E2E workflows use a separate test-only app entry point with a synthetic principal override; production `backend.api:app` retains full token validation. No live Auth0 login flow was exercised because tenant configuration is absent.
- **Remaining work:** Before deployment, configure and exercise the Auth0 SPA/API, require HTTPS, constrain allowed origins/connections, and choose persistent shared storage before adding workers. Do not treat CORS or UUIDs as authorization.

### SEC-002 — Upload cap was enforced after multipart parsing and file spooling

- **Severity:** Medium; higher if the unauthenticated API is publicly reachable.
- **Confidence:** High.
- **Status:** Remediated for bounded request size and concurrent upload processing by TASK-018; concurrent disk/CPU pressure remains bounded but not eliminated.
- **Affected code:** `backend/upload_limits.py`; middleware wiring in `backend/api.py`; settings in `backend/config.py`; secondary chunked file check in `backend/document_service.py:25-52`. The original Starlette behavior was verified in installed `formparsers.py:124-127,159-164,208,253-260` and `requests.py:287-295`.
- **Evidence:** The middleware now bounds actual request-body chunks before FastAPI multipart parsing, with default cap 10 MiB + 256 KiB. `Content-Length` is an early-rejection optimization only. A 64 KiB spool-memory threshold bounds in-memory buffering before disk rollover. A per-process nonblocking semaphore admits at most 10 upload requests at once and returns structured HTTP 429 when full; it spans body buffering and downstream PDF processing and releases in `finally`. The existing 10 MiB chunked per-file check remains.
- **Preconditions and impact:** The previous unbounded per-request multipart spool path is closed within a configured body limit. The semaphore bounds simultaneous upload request processing per process, not request frequency. Each accepted request can still use temporary disk in middleware, Starlette multipart parsing, and processing; concurrent accepted uploads multiply that bounded use.
- **Safe verification:** Tests cover declared, absent, and understated `Content-Length`, 413/429 responses, no body consumption on concurrency rejection, permit release after completion, processing exception and cancellation, bounded replay, and CORS-readable errors. No destructive load test was run.
- **Recommended remediation:** Retain these safeguards. If deployment needs a global budget across multiple workers or stricter disk/CPU bounds, configure infrastructure concurrency/request limits and size them based on worker count. This is not a requests-per-minute rate limiter and does not prevent every denial-of-service condition.

### REL-001 — Process-local registry has bounded capacity but remains volatile

- **Severity:** Informational design limitation; resource exposure remains conditional on access and concurrency.
- **Confidence:** High.
- **Status:** Partially remediated by TASK-018; volatility, worker-local scope, and lack of expiry remain. Upload processing is additionally capped at 10 concurrent requests per worker by TASK-018.
- **Affected code:** `backend/document_registry.py:18-65`; registry construction in `backend/api.py`; limits in `backend/config.py`.
- **Evidence:** Registration now checks, atomically under the registry lock, a default maximum of 25 documents and 25 MiB of aggregate UTF-8 extracted text per process. It rejects rather than evicts: count capacity returns 429 and aggregate text capacity returns 413. Tests cover both rejection paths, no partial record, and concurrent attempts at the count boundary. Records still contain full extracted text and are removed only by explicit deletion or process termination; there is no expiry.
- **Preconditions and impact:** The new quotas bound registry growth per worker but do not create a global multi-worker budget. Each worker has independent capacity; restarts discard state. Concurrent in-flight uploads can still consume temporary resources before registration.
- **Safe verification:** Focused registry tests, API quota tests, and a 16-thread registration test passed. No destructive load test was run.
- **Recommended remediation:** Retain the per-process quotas and document them operationally. If deploying multiple workers, size aggregate capacity across workers and add a retention/ownership architecture only through a separately approved task.

### FIN-001 — Label-to-value extraction can misclassify unrelated figures

- **Severity:** Medium (financial data integrity).
- **Confidence:** High.
- **Status:** Remediated by TASK-016 and TASK-017; unqualified dollar currency remains explicitly unknown.
- **Affected code:** `backend/financial_extraction.py:28-38,51-88,118-155` (`NUMBER_PATTERN`, `extract_financial_data`, `_amount_candidates`).
- **Evidence:** Before TASK-016, synthetic `Revenue\nPage 12` returned revenue value `12`, and `Revenue: USD 1,2,3 million` returned `123`. TASK-016 added standalone-amount continuation checks and valid thousands grouping. Before TASK-017, `Revenue: $100 million` returned currency `USD`. TASK-017 now returns `currency: null` for that case, keeps explicit USD/EUR/GBP codes, and resolves `$` to USD only when `USD` appears in the same evidence context. Regression tests cover all five currency examples and the explicit-context case.
- **Preconditions and impact:** The page-number, malformed-grouping, and implicit-dollar-currency paths are corrected. An unqualified dollar amount cannot be currency-compared and is reported as incomparable until a currency is explicit.
- **Safe reproduction:** Synthetic parser probes and regression tests were run before and after TASK-016/TASK-017. No financial report was used.
- **Recommended remediation:** Retain the same-evidence-context rule and regression tests. If broader document-level currency inference is later desired, define and review a deterministic source rule before implementation.

### REL-002 — Finite values can overflow comparison arithmetic and fail response serialization

- **Severity:** Medium (availability and result integrity).
- **Confidence:** High.
- **Status:** Remediated by TASK-016; strict output validation retained as defense in depth.
- **Affected code:** `backend/comparison_engine.py:115-132`; `backend/schemas.py:170-202` (`ComparedMetric`); `backend/api.py:133-149`. Installed Starlette JSON serialization: `.venv/Lib/site-packages/starlette/responses.py:171-188`.
- **Evidence:** Before TASK-016, synthetic equal-period values `-1.7e308` and `1.7e308` returned infinite absolute and percentage differences, and strict JSON serialization rejected the result. TASK-016 now marks an overflowing absolute difference `incomparable` with differences omitted; it omits an overflowing percentage while preserving a finite absolute difference and explanation. `ComparedMetric` now rejects non-finite values, and tests strictly serialize the resulting comparison payload with non-finite JSON values disallowed.
- **Preconditions and impact:** The previous serialization failure required extreme finite comparable values. The arithmetic path is now guarded; future additions to comparison calculations must preserve the finite-output invariant.
- **Safe reproduction:** The synthetic overflow was reproduced before the fix and the same focused regression suite passed after TASK-016. No real report or external service was used.
- **Recommended remediation:** Retain the finite-arithmetic checks and strict schema constraints; extend them if future derived metrics are added.

### FIN-002 — Two-document reports do not identify which source produced each risk observation

- **Severity:** Low (evidence traceability).
- **Confidence:** High.
- **Status:** Confirmed schema/composition limitation.
- **Affected code:** `backend/schemas.py:140-149` (`RiskObservation`); `backend/report_service.py:48-75`; `front-end/src/App.tsx:294`.
- **Evidence:** `RiskObservation` contains rule, metric references, and evidence, but no source document ID or filename. For a two-document report, `report_service.py` extends the same flat `risk_observations` list with observations from the second document. The report separately lists source documents, but does not bind each observation to one of them; identical risk rules/evidence can therefore be difficult to attribute.
- **Preconditions and impact:** A two-document report triggers a rule in either or both documents. Readers may not reliably determine which report the observation belongs to, weakening auditability and potentially causing misattribution.
- **Safe verification:** Code/schema inspection; the current report tests assert risk inclusion but not per-observation source attribution.
- **Recommended remediation:** Include source document identity in each report-level risk item (or structure observations by source) and test single- and dual-source attribution.

### REL-003 — Comparison output remains visible after changing the second selection

- **Severity:** Low (user-facing result integrity).
- **Confidence:** High.
- **Status:** Confirmed by state flow inspection; not browser-reproduced in this audit.
- **Affected code:** `front-end/src/App.tsx:189-200` (`runComparison`), `250`, and `280-285` (`ComparisonView` selector/result rendering).
- **Evidence:** `runComparison` stores results in `comparison`. The second-report `<select>` only updates `secondId`; it does not clear or mark the existing comparison stale. `ComparisonView` renders any non-null comparison while showing the newly selected second report in its controls. The table does not identify the two filenames alongside the results.
- **Preconditions and impact:** Run a comparison, then change the second-report selection without running comparison again. Old results remain under controls that now describe a different pair, which can mislead review.
- **Safe verification:** Static state-flow inspection; no test currently changes the comparison selection after success.
- **Recommended remediation:** Clear or explicitly mark results stale when either selected document changes, and display the exact document names/IDs used by each response. Add a browser regression test.

### REL-004 — Extracted-text request failure leaves the modal in a loading presentation

- **Severity:** Low (failure-state reliability).
- **Confidence:** High.
- **Status:** Confirmed by control-flow inspection; not exercised in existing tests.
- **Affected code:** `front-end/src/App.tsx:178-185` (`viewExtractedText`) and `254` (text-modal loading branch).
- **Evidence:** The modal opens before `getDocumentText` completes. On failure the catch sets the global analysis error state/message, but the modal only renders extracted text when `selectedText` exists and otherwise always renders “Loading source text...”. The modal does not render the failure message or offer an inline retry.
- **Preconditions and impact:** The text endpoint returns an error or network failure. The user sees a permanent-looking loading state in the open dialog and may not see the error set on a different view.
- **Safe verification:** Code inspection; frontend tests do not cover extracted-text endpoint rejection.
- **Recommended remediation:** Give text loading its own request state/error presentation, preserve an explicit retry/close path, and add a component test for a failed text request.

### REL-005 — Frontend API client has no request deadline or successful-payload validation

- **Severity:** Low (availability and robustness).
- **Confidence:** High.
- **Status:** Confirmed client behavior; failure cases not covered by current tests.
- **Affected code:** `front-end/src/lib/api.ts:122-145` (`request`).
- **Evidence:** Requests use `fetch` without `AbortSignal` or a timeout. JSON parse failures become `null`; any successful HTTP status then returns `payload as T` without runtime shape validation. A stalled connection can leave UI actions loading, while a proxy/misconfigured server that returns HTTP 200 with an unexpected JSON shape can lead components to fail when they call `.map` or read required fields.
- **Preconditions and impact:** Network stalls or an intermediary/misconfigured API returns malformed successful JSON. This does not require malicious document content.
- **Safe verification:** The API client tests cover standard success, structured error, and rejected fetch paths; they do not test timeout or malformed success payloads.
- **Recommended remediation:** Add bounded client request deadlines and validate critical response shapes at the API boundary; test timeout and malformed-success responses.

### DOC-001 — README contains stale implementation and test-status statements

- **Severity:** Informational.
- **Confidence:** High.
- **Status:** Confirmed documentation inconsistency.
- **Affected code/docs:** `README.md:3,252`.
- **Evidence:** The introduction still describes the implementation as a health-check foundation. A later frontend testing note says no frontend test framework is configured, although the current manifest and verification commands include Vitest and Playwright. Later sections document the newer workflows, so the document contradicts itself.
- **Preconditions and impact:** Contributors use the README as current setup/security context. Stale claims can lead to incorrect assumptions about implemented routes and test coverage; no direct runtime security impact was demonstrated.
- **Safe verification:** Compare the README statements with the actual backend routes, `front-end/package.json`, and the passing Vitest/Playwright commands recorded above.
- **Recommended remediation:** Reconcile the README overview and testing note with the current implementation, preserving explicit limitations such as authentication and in-memory storage.

## Verified Positive Controls

- Upload processing has a bounded pre-parser raw-request spool (default cap 10 MiB plus 256 KiB multipart overhead, 64 KiB memory rollover threshold) and a second configured chunked file cap of 10 MiB. It rejects empty files, uses `PdfReader(..., strict=True)`, rejects encrypted documents, and enforces 100 pages and 1,000,000 extracted characters (`backend/upload_limits.py`, `backend/document_service.py`, `backend/config.py`).
- Original filenames are stored/displayed but are not used as filesystem paths. The temporary filename is generated by `NamedTemporaryFile` with a constant suffix.
- The processing service attempts upload close and temp unlink in cleanup while preserving an active processing/cancellation exception. The request-body spool closes in `finally`. Tests cover success, parser/size/page rejection, close-error masking, processing cancellation, middleware cancellation, and registry-capacity rejection cleanup. OS-level abrupt termination or filesystem cleanup failure is not guaranteed.
- Registry admission is atomic and bounded to 25 documents and 25 MiB of extracted UTF-8 text per process; it does not evict records. These limits do not aggregate across multiple workers.
- Upload request processing is limited to 10 concurrent requests per process by a nonblocking semaphore. Excess requests get HTTP 429; this is concurrency control, not a time-window rate limit.
- Pydantic schemas forbid extra fields, constrain supported metric/currency/unit values, reject non-finite extracted metric inputs, and require evidence to contain the metric label and original reported text (`backend/schemas.py`).
- Unknown UUIDs consistently return structured 404 responses for document operations. IDs are generated with UUID4, but are not an authorization control.
- Default CORS origins are explicit localhost origins, not wildcard. `CORS_ORIGINS` can override the list. CORS is not authentication.
- Application code search found no `dangerouslySetInnerHTML`, `innerHTML`, `localStorage`, or `sessionStorage` usage. Extracted text, evidence, and errors are rendered through React text nodes.
- No application logging of extracted content was found. Uvicorn access logs/configuration at a deployment layer were not audited.
- Playwright uses synthetic PDFs, one worker, dedicated ports, `reuseExistingServer: false`, and records uploaded document IDs for deletion in `afterEach`. The full suite passed in this run.
- No AI/model provider is integrated in the reviewed code. Prompt-injection findings are therefore not applicable to the current runtime; uploaded text remains a future untrusted-input boundary if AI processing is added.

## Coverage Gaps and Unverified Assumptions

- Upload tests cover actual request-body counting with accurate, absent, and understated `Content-Length`, bounded replay, malformed/non-PDF/empty inputs, page/text limits, cancellation cleanup, registry rejection cleanup, concurrent registration, concurrent-upload rejection, and permit release after success, processing failure, and cancellation. Compressed-stream expansion, parser CPU time, filesystem-level cleanup failures, and high-volume concurrent upload behavior remain untested.
- Extractor tests now cover page-number continuation rejection, malformed grouping rejection, valid grouped decimals, and the five required currency cases. Locale-specific number formats and broader document-level currency-context inference remain uncovered and unsupported.
- Comparison tests now cover extreme finite difference and percentage overflow plus strict JSON serialization. Interpretation of percentage change across negative baselines remains a business-rule/test gap.
- Risk tests cover implemented rule triggers and comparable/incomparable inputs; no multi-period trend or cross-user isolation model exists.
- Frontend Vitest covers standard API, upload, report, comparison, error, and deletion behavior, but not malformed HTTP-200 payloads, request stalls/timeouts, extracted-text failure presentation, or stale comparison results after changing a selector.
- Browser tests verify four principal flows. They do not inject a successful upload followed by a failed list refresh to prove cleanup tracking, nor do they test teardown failure. The dedicated backend process is local and process-local; normal process termination discards leftovers, but that does not prove cleanup on abnormal termination.
- `npm ls --depth=0` succeeded; no package advisory scan (`npm audit`) or Python advisory scan (`pip-audit`) was run.
- Production reverse proxy, TLS, host binding, security headers, firewall, logging retention, and deployment environment were not present/verified in this workspace.

## Prioritized Remediation Roadmap

| Priority | Work | Rationale |
|---|---|---|
| P0 before public exposure | Define server-side authentication and per-document authorization, or ensure the API is strictly confined to a trusted local boundary. | All document data and mutating operations are currently unauthenticated. |
| P1 | Maintain the request-body/multipart cap before Starlette parsing and the service-level file check. | Implemented by TASK-018; concurrency and infrastructure-level temporary disk budgets remain deployment concerns. |
| P1 | Maintain per-process document-count and extracted-text quotas; define cross-worker capacity/retention if deployment changes. | Implemented by TASK-018 per process; registry remains volatile and worker-local. |
| P1 | Harden number parsing and label/value association; handle ambiguous currency symbols explicitly. | Page-number continuation and malformed grouping were corrected by TASK-016; resolve the remaining dollar-currency convention. |
| P1 | Reject non-finite comparison outputs and add extreme-range tests. | Completed by TASK-016 with finite-safe comparison status/limitations, schema validation, and regressions. |
| P2 | Associate each report risk observation with its source document; invalidate or label stale comparison results when selectors change. | Preserve financial evidence provenance end to end. |
| P2 | Add frontend timeout/response-shape validation and explicit extracted-text error state. | Bound stalled requests and prevent malformed success responses from breaking presentation. |
| P2 | Add tests for exceptional/cancelled upload cleanup, upload parser limits, extraction edge cases, stale results, and cleanup failure paths. | Close coverage gaps in the most sensitive workflows. |
| P3 before production | Review TLS, security headers, debug configuration, dependency advisories, and operational logging at the deployment boundary. | These controls cannot be confirmed from this repository. |

## Deployment Risks and Limitations

The README describes local development, and its documented Uvicorn command binds to `127.0.0.1`; no production deployment configuration was found. If the API is bound publicly or placed behind an accessible proxy, lack of authentication is a release blocker for confidential financial documents. The process-local registry is shared by all clients reaching that worker, bounded to its configured count/text quotas, volatile across restarts, and independent across multiple workers. Aggregate capacity therefore scales with worker count and is not a global quota. Do not treat local-only defaults, CORS, UUIDs, or the development dashboard as production security controls.

`APP_DEBUG` defaults to false but enables FastAPI debug mode when configured truthy. A production environment that sets it true may expose diagnostic tracebacks for unhandled exceptions; verify the actual deployment value. No AI prompt injection or model-provider security claim is made because those components are not implemented.

## Audit Scope Limitations

- Verification was limited to this workspace, current installed dependencies, the required local test commands, and safe synthetic parser probes.
- No real financial or personal documents were used.
- No production endpoint, destructive load test, unauthenticated access test against a shared service, dependency advisory database, or deployment infrastructure was assessed.
- `git status --short` showed the repository content as untracked, so the audit could not establish a clean committed baseline or attribute untracked files to a particular author. No tracked diff was present at audit start.

## TASK-016 Follow-up Verification

The targeted extraction, currency, and comparison regressions were verified after remediation:

- Backend suite: `77 passed, 11 warnings`.
- Frontend Vitest: `11 passed`.
- Frontend lint: passed with no findings.
- Frontend production build: passed.
- Playwright E2E: `4 passed`.
- Synthetic parser checks: `Revenue` followed by `Page 12` and malformed grouping are omitted; valid `1,234.56` grouped decimal remains extracted; unqualified `$` is unknown and explicit supported currency codes are retained.
- Synthetic comparison checks: overflowing absolute differences are marked `incomparable`; overflowing percentage calculations retain finite absolute differences and omit the percentage with a limitation. Comparison models reject non-finite fields, and strict JSON serialization passed for returned regression results.

The pre-remediation reproductions remain documented under FIN-001 and REL-002 as historical evidence. Unqualified `$` is now conservatively represented as unknown; broader context inference is not implemented.

## TASK-018 Follow-up Verification

- Backend suite: `106 passed, 11 warnings` (FastAPI/Starlette deprecations).
- Frontend Vitest: `11 passed`.
- Frontend lint: passed with no findings.
- Frontend production build: passed.
- Playwright E2E: `4 passed`.
- Focused upload/registry/concurrency tests: passed, covering actual body-size counting with absent/understated `Content-Length`, bounded replay, 413/429 behavior, permit release after completion, processing exceptions and cancellation, cleanup preserving the original exception, CORS-readable errors, atomic quota rejection, and concurrent count-quota registration.
- Defaults: per-file limit 10 MiB; total raw upload request limit 10 MiB + 256 KiB; request-spool memory threshold 64 KiB; concurrent upload-processing cap 10 per process; 100 pages; 1,000,000 extracted characters; 25 registered documents and 25 MiB of extracted UTF-8 text per process.
- The concurrency cap limits simultaneous processing, not requests per minute. Resource limits do not prevent all denial-of-service conditions: concurrent accepted requests still multiply bounded temporary storage/CPU use, and registry quotas are per worker rather than global.

## TASK-019 Follow-up Verification

- Backend suite: 112 passed, including synthetic RS256 token validation and owner-isolation regressions; 11 existing FastAPI/Starlette deprecation warnings.
- Frontend Vitest: 15 passed, including sign-in state, provider error handling, bearer-header behavior, 401 handling, and logout data clearing.
- Frontend lint and production build: passed.
- Playwright: 4 passed using an isolated test-only app entry point with a synthetic principal override; this does not substitute for a live Auth0 callback test.
- Token verification pins RS256 and checks signature, issuer, audience, expiry, and required subject/issued-at claims. All document endpoints enforce owner scope; mixed-owner comparison/report requests return 404 without partial data.
- Identity and document persistence are distinct: Auth0 owns account lifecycle, while document records and ownership are volatile and process-local. Restart loses documents; multiple workers do not share records. No production-readiness claim is made.
- Remaining deployment verification: connect an Auth0 SPA and API, confirm callback/logout/origin settings and actual access-token issuance, check provider plan limits, use HTTPS, and decide on persistent shared storage before multi-worker deployment. The API does not check token revocation; token lifetime must be configured appropriately at Auth0.

## Change Record

This report was created for TASK-015 and updated to record TASK-016 through TASK-019 remediation status. No commit or push was performed.
