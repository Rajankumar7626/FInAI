# FinSight AI

FinSight AI is a prototype financial document analysis platform with Auth0 sign-in, server-enforced document ownership, bounded PDF uploads, and deterministic extraction, risk, comparison, and report workflows.

## Purpose

This repository currently provides:

- a FastAPI backend with Auth0 access-token validation and owner-scoped document APIs
- a React + TypeScript frontend using the Auth0 SPA SDK with in-memory token caching
- pytest, Vitest, lint, build, and Playwright verification
- local setup instructions and environment examples

## Repository structure

- `docs/` — project planning and specification documents
- `backend/` — Python + FastAPI backend
- `front-end/` — React + TypeScript frontend
- `tests/` — automated backend tests
- `requirements.txt` — pinned dependency ranges for the backend foundation
- `.env.example` — example backend environment configuration
- `.gitignore` — repository ignore rules

## Prerequisites

Use the versions verified in this environment:

- Python 3.14.7
- pip 26.2.1
- Node.js v24.19.0
- npm 11.17.0
- Git 2.51.0.windows.1

## Backend setup

From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn backend.api:app --host 127.0.0.1 --port 8000 --reload --env-file .env
```

The backend reads configuration values from environment variables. Auth0 configuration is required before protected document routes can be used; `/health` remains public. No application passwords or signing keys are stored by FinSight AI.

## Configuration conventions

- `APP_NAME`, `APP_VERSION`, `APP_DESCRIPTION` configure the API metadata.
- `APP_DEBUG` enables FastAPI debug mode when set to `true`.
- `BACKEND_HOST` and `BACKEND_PORT` control the ASGI host and port.
- `MAX_UPLOAD_SIZE_BYTES` defaults to `10485760` (10 MiB).
- `UPLOAD_CHUNK_SIZE_BYTES` defaults to `65536` (64 KiB).
- `UPLOAD_REQUEST_OVERHEAD_BYTES` defaults to `262144` (256 KiB multipart allowance above the file cap).
- `MAX_CONCURRENT_UPLOADS` defaults to `10` simultaneous upload-processing requests per backend process.
- `MAX_DOCUMENT_PAGES` defaults to `100`.
- `MAX_EXTRACTED_CHARACTERS` defaults to `1000000`.
- `MAX_REGISTERED_DOCUMENTS` defaults to `25` per worker process.
- `MAX_TOTAL_EXTRACTED_TEXT_BYTES` defaults to `26214400` (25 MiB UTF-8 text) per worker process.
- `CORS_ORIGINS` accepts a comma-separated list of allowed frontend origins.
- `AUTH0_DOMAIN` is the Auth0 tenant domain, without a scheme or trailing slash.
- `AUTH0_AUDIENCE` is the API Identifier configured for the Auth0 API.

## Authentication and document ownership

Create an Auth0 **Single Page Application** and an Auth0 **API**. Configure the API to use RS256 and set its Identifier as `AUTH0_AUDIENCE` in the backend and `VITE_AUTH0_AUDIENCE` in the frontend. Set `AUTH0_DOMAIN` and `VITE_AUTH0_DOMAIN` to the tenant domain, and set `VITE_AUTH0_CLIENT_ID` to the SPA's public client ID. Copy `.env.example` to `.env` and `front-end/.env.example` to `front-end/.env.local`, then replace each placeholder. These files are ignored by Git. The client ID, domain, and API audience are public configuration values, not secrets. The backend has no Auth0 client secret.

In the Auth0 application settings, allow the local frontend origin (`http://127.0.0.1:5173` and/or `http://localhost:5173`) in **Allowed Callback URLs**, **Allowed Logout URLs**, and **Allowed Web Origins**. Limit allowed origins and login connections to the intended users; disable provider sign-up if access should be invite-only. FinSight AI does not implement a public registration endpoint. See Auth0's [React SPA quickstart](https://auth0.com/docs/quickstart/spa/react) for application/API setup.

The frontend redirects users to Auth0 Universal Login. The Auth0 React SDK keeps access tokens in memory; the app does not put credentials in URLs or persistent browser storage. Logout clears all document and analysis state before redirecting to Auth0. A page reload may require sign-in again, subject to the provider's own SSO session.

The FastAPI backend accepts only bearer **access tokens** and validates the RS256 signature against the tenant JWKS, exact issuer, configured audience, expiry, and required `sub`/`iat` claims. The stable owner key is the verified `sub` claim; no request field or header can select an owner. Missing or invalid credentials return 401. If the backend has not been configured with the Auth0 tenant and audience, a presented token receives 503 rather than being accepted without verification. Auth0 controls token lifetime; the API verifies expiry but does not maintain a revocation list, so an already issued token can remain usable until it expires.

All document APIs require authentication: upload/registration, listing, metadata/text retrieval, financial extraction, risk analysis, comparison, report generation, and deletion. Unknown and non-owned document IDs return the same 404 response. Mixed-owner comparisons and reports fail before producing results.

Identity lifecycle is managed by Auth0; FinSight AI stores no account records or password hashes. The document registry remains in memory and process-local. Documents disappear on restart and are not shared between workers; use a single backend process for this prototype. For production, use HTTPS, review Auth0 tenant/connection settings and plan limits, configure exact production callback/CORS URLs, and move documents plus ownership metadata to shared persistent storage before deploying multiple workers. This prototype is not a production-readiness claim.

The repo ignores `.env` files but keeps `.env.example` tracked for local setup.

Health endpoint:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "finsight-ai"
}
```

## PDF upload endpoint

The backend accepts one text-based PDF through `POST /documents/upload` using a `multipart/form-data` field named `file`:

```powershell
curl.exe -H "Authorization: Bearer $env:ACCESS_TOKEN" -X POST http://127.0.0.1:8000/documents/upload -F "file=@report.pdf;type=application/pdf"
```

Successful uploads return metadata and extracted text:

```json
{
  "document_id": "generated-uuid",
  "filename": "report.pdf",
  "page_count": 1,
  "extracted_character_count": 42,
  "extraction_status": "completed",
  "extracted_text": "Extracted PDF text"
}
```

Invalid, malformed, oversized, encrypted, or textless PDFs return a stable error shape:

```json
{
  "detail": "Uploaded file is not a valid PDF."
}
```

The request body is counted from streamed bytes (not only `Content-Length`) and buffered through a bounded spool before FastAPI multipart parsing. Its total-body cap is the file-size limit plus the configured multipart allowance. The spool keeps at most the configured 64 KiB threshold in memory before rolling to temporary storage. The selected file is then copied in bounded chunks with the 10 MiB file cap, parsed with `pypdf`, and processing resources are cleaned up on success, validation/parser errors, and cancellation. Request/file-size rejection returns structured HTTP 413. Temporary disk is used by the request spool, multipart parser, and processing file; concurrent uploads multiply this bounded per-request use, so this is not a complete denial-of-service defense. Documents are not stored permanently, and extracted financial content is not logged. Scanned-image PDFs requiring OCR are unsupported. The endpoint is an extraction foundation only; it does not perform financial metric extraction, analysis, or AI processing.

`MAX_CONCURRENT_UPLOADS` limits simultaneous upload request processing per backend process. Excess concurrent uploads receive HTTP 429 and can be retried when capacity is available. This is not a requests-per-minute rate limit.

## Document management endpoints

Successful uploads are registered in a process-local in-memory document registry:

- `GET /documents` returns metadata for all active documents and never includes extracted text.
- `GET /documents/{document_id}` returns metadata for one document.
- `GET /documents/{document_id}/text` returns metadata and extracted text for one document.
- `POST /documents/{document_id}/financial-data` extracts financial metrics.
- `POST /documents/{document_id}/risk-analysis` returns deterministic risk observations.
- `POST /documents/compare` compares two documents.
- `POST /reports/generate` creates a single-document or two-document report.
- `DELETE /documents/{document_id}` removes one document and returns `{"document_id": "...", "deleted": true}`.

Every endpoint listed here requires a valid Auth0 access token. Unknown and non-owned document IDs return `404` with `{"detail": "Document not found."}`. Deletion is intentionally not idempotent: deleting an already deleted document returns `404`.

The registry stores generated IDs, verified Auth0 subject ownership, original filenames, page counts, extraction metadata, and extracted text. It stores no PDF bytes or file paths. It rejects new records rather than evicting existing ones when the per-process limit reaches 25 documents (HTTP 429) or aggregate extracted text exceeds 25 MiB of UTF-8 bytes (HTTP 413). Admission and owner-scoped registry operations are lock-protected within one process. These limits apply independently in each worker. Documents disappear when the server restarts and are not shared between multiple worker processes.

## Financial data extraction endpoint

`POST /documents/{document_id}/financial-data` applies deterministic, rule-based parsing to the registered extracted text. It returns only metrics that can be associated unambiguously with a supported label and nearby numeric value:

- Revenue
- Net income or net profit
- Operating profit or operating income
- Total assets
- Total liabilities
- Total debt
- Cash and cash equivalents
- Operating cash flow
- Earnings per share (EPS)

The parser handles valid grouped numbers and decimals, explicit currency codes (`USD`, `EUR`, `GBP`), magnitude units, parenthesized negatives, and a single nearby reporting year. The `€` and `£` symbols map to `EUR` and `GBP`. An unqualified `$` is left with `currency: null`; it resolves to USD only when the same evidence context explicitly contains the `USD` code. The parser preserves source context and reported amount text, and omits years, percentages, missing values, malformed grouping, and ambiguous label/value associations.

Example response:

```json
{
  "document_id": "generated-uuid",
  "metrics": [
    {
      "metric_name": "revenue",
      "value": 1250.0,
      "original_reported_text": "USD 1,250 million",
      "currency": "USD",
      "unit": "million",
      "reporting_period": "2024",
      "source_context": "Revenue for 2024: USD 1,250 million",
      "extraction_method": "deterministic_label_value_rule"
    }
  ]
}
```

This rule-based result is an extraction aid, not a substitute for verifying the original financial report. It does not perform currency conversion, table reconstruction, OCR, financial analysis, or AI-assisted interpretation.

### Financial validation and evidence rules

Each returned metric is validated before it reaches the API response:

- `metric_name` must be one of the supported metric names.
- `value` must be a finite numeric value; the original reported amount remains in `original_reported_text`.
- Supported currencies are `USD`, `EUR`, and `GBP`; an unqualified `$` does not establish USD. A `$` amount is assigned USD only when `USD` is also present in that metric's evidence context. Supported magnitude units are `thousand`, `million`, and `billion`.
- `reporting_period` is present only when a single four-digit year is found; unknown periods remain `null`.
- `source_context` must contain the relevant metric label and the exact original reported amount text.
- Years, percentages, unsupported currencies/units, missing values, and multiple plausible numeric candidates are not converted into financial metrics.

These checks improve traceability but do not prove that a reported figure is correct. The original PDF should always be reviewed for final financial decisions.

## Deterministic risk analysis endpoint

`POST /documents/{document_id}/risk-analysis` runs transparent rules against the document's validated financial extraction. Each observation includes a stable rule ID, severity, explanation, relevant validated metrics, source evidence, and a limitation note. The response also includes `limitations` for missing or incomparable data.

Implemented rules:

- `negative_net_income` triggers for explicitly negative net income.
- `negative_operating_cash_flow` triggers for explicitly negative operating cash flow.
- `liabilities_exceed_assets` triggers only when assets and liabilities have the same explicit currency, unit, and reporting period, and liabilities are greater than assets.
- `high_debt_to_assets` triggers when comparable debt divided by assets is greater than `75%`. This is a technical screening threshold, not a universal financial standard.
- Missing key metrics are reported as information limitations, never as proof of financial distress.

Severity is limited to `medium` for negative income/cash flow and debt screening, and `high` for liabilities exceeding assets. These labels describe the rule result within this technical engine; they are not credit ratings, investment recommendations, or professional financial advice. No rule triggers when required metrics are missing, duplicated, from different periods, or expressed in incomparable currencies or units.

Risk tests can be run separately with `pytest tests/test_risk_engine.py -q`.

## Company financial comparison endpoint

`POST /documents/compare` compares two registered document IDs. The request body is:

```json
{
  "first_document_id": "first-generated-uuid",
  "second_document_id": "second-generated-uuid"
}
```

For each supported metric, the response reports `comparable`, `unavailable`, or `incomparable` status, preserves evidence from both reports, and includes the original values when available. Differences use the convention **second report minus first report**. Percentage change is calculated as `difference / first value * 100` only when the first value is nonzero.

Direct comparisons require both values to have the same explicit currency, magnitude unit, and reporting period. Missing or ambiguous metrics are marked unavailable. Currency, unit, or period mismatches are marked incomparable. No currency or unit conversion is performed, and a zero first value produces an absolute difference but no percentage change.

Document IDs identify the comparison inputs only; the system does not infer company identity or recommend which report is better. Comparison tests can be run separately with `pytest tests/test_comparison_engine.py -q`.

## Research report generation endpoint

`POST /reports/generate` creates a deterministic structured report from one or two registered documents. A single-document request is:

```json
{
  "first_document_id": "first-generated-uuid"
}
```

To include comparison results, add `second_document_id`:

```json
{
  "first_document_id": "first-generated-uuid",
  "second_document_id": "second-generated-uuid"
}
```

The response separates source documents and extracted metrics, rule-based risk observations, optional comparison results, missing information, limitations, and a concise methodology. Metric and risk evidence is preserved from the registered extracted text. Report IDs and UTC generation timestamps are created for each request.

Reports are generated in memory and are not persisted. The report result disappears after the request and no report database, PDF export, or background generation is implemented. The report is a deterministic data summary and is not AI-generated financial opinion, investment advice, forecasting, or professional financial analysis. Report tests can be run separately with `pytest tests/test_report_service.py -q`.

## Frontend setup

From the project root:

```powershell
cd front-end
Copy-Item .env.example .env
npm install
npm run dev
```

The frontend reads the backend URL from `VITE_API_BASE_URL` and defaults to `http://127.0.0.1:8000` when it is not set.

## Dashboard workflow

The frontend dashboard at `http://127.0.0.1:5173` provides the core local workflow:

- Upload a PDF and refresh the in-memory document list.
- Select a document to view metadata and extracted financial metrics.
- Open extracted text deliberately in a source-review dialog.
- Review deterministic risk observations, evidence, and limitations.
- Select a second document for comparison and inspect comparable, unavailable, and incomparable metrics.
- Generate single-document or two-document research reports from the existing API responses.

The interface shows loading, empty, success, and API error states. Deletion requires confirmation. It does not display fabricated financial values, and no frontend test framework is configured yet; manual verification covers backend connectivity, upload, document selection, text viewing, risk, comparison, report generation, and deletion.

## Backend test suite

From the project root:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

The test suite generates small synthetic PDFs and text fixtures and does not use external services or real financial reports. Financial extraction tests can be run separately with `pytest tests/test_financial_extraction.py -q`.

Authentication and ownership regression tests run with the full backend suite or separately with `\.venv\Scripts\python.exe -m pytest tests/test_auth_ownership.py -q`. They use generated RSA keys and synthetic users; no Auth0 account or live credentials are needed.

## Frontend build verification

```powershell
cd front-end
npm run build
```

## Frontend tests

From `front-end/`:

```powershell
npm run test
```

The frontend test suite uses Vitest with jsdom and Testing Library. It mocks the API client boundary and does not require the backend or external network access.

## Browser end-to-end tests

Install the Playwright browser once, then run from `front-end/`:

```powershell
npx playwright install chromium
npm run test:e2e
```

The Playwright suite starts isolated local servers on backend port `8002` and frontend port `5175`. Its test-only frontend session and `tests.e2e_app` inject a synthetic principal; this exercises the UI and document workflows but does not test a live Auth0 redirect. JWT validation and cross-user authorization are covered separately by synthetic RS256 backend tests. The suite uses synthetic PDFs, covers upload, extraction, risk, comparison, report generation, API errors, and deletion, and removes only the document IDs created by each test. The backend registry is process-local, so the suite runs serially against a fresh dedicated server rather than relying on persistent state.

## Notes

- This repository is intentionally limited to a minimal startup foundation.
- The current implementation includes Auth0 authentication, server-enforced document ownership, bounded PDF text extraction, and deterministic financial metric extraction. It does not include application-managed accounts, persistent document storage, currency conversion, OCR, or AI workflows.
- No production deployment configuration is claimed yet.
