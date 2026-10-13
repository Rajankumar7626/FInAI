# Task: Create `docs/DESIGN.md` — FinSight AI

Act as a Senior UI/UX Architect and Design Systems Specialist.

Inspect the existing codebase and create or update `docs/DESIGN.md` for the **FinSight AI — AI-Powered Multi-Agent Financial Analysis System**.

The document must describe the actual frontend design and establish consistent UI/UX rules for future development.

## 1. Inspect the Existing Frontend

Inspect these paths before writing:

- `front end/src/App.tsx`
- `front end/src/main.tsx`
- `front end/src/index.css`
- `front end/src/components/`
- `front end/src/components/ui/`
- `front end/src/lib/AppContext.tsx`
- `front end/src/lib/types.ts`
- `front end/src/lib/formatters.ts`
- `front end/src/pages/`
- `front end/package.json`

Review the actual implementation of all existing pages, shared components, navigation, charts, modals, forms, tables, loading states, and error states.

Do not assume a component or feature exists without verifying it.

## 2. Required Documentation Sections

### 2.1 Design Overview
Explain the purpose of the FinSight AI interface and its primary users.

### 2.2 Design Principles
Document these principles:

- Clarity over decoration.
- Evidence-backed financial presentation.
- Consistent layouts and spacing.
- Accessible color contrast.
- Responsive design.
- Reusable components.
- Clear loading, empty, success, and error states.
- Honest presentation of uncertainty and missing financial data.

### 2.3 Visual Design System
Document the actual implementation of:

- Color palette and semantic colors.
- Typography and font hierarchy.
- Spacing scale.
- Border radius and borders.
- Shadows and elevation.
- Icons.
- Layout widths and page spacing.
- Chart styling.
- Light/dark theme support, if implemented.

Extract existing values from CSS and components. Do not invent current design tokens.

If the current implementation has no consistent token system, document the gap and propose a clearly labeled recommendation.

### 2.4 Application Layout
Describe:

- Sidebar navigation.
- Top bar and page headers.
- Main content area.
- Responsive navigation.
- Content containers.
- Shared page-level layout.

### 2.5 Page-by-Page Design

Inspect and document each existing page, including:

- `WorkspacePage.tsx`
- `OverviewPage.tsx`
- `FinancialsPage.tsx`
- `ResearchPage.tsx`
- `RiskPage.tsx`
- `ComparisonPage.tsx`
- `ReportPage.tsx`
- `HistoryPage.tsx`
- `SettingsPage.tsx`

For each page, specify:

1. Purpose.
2. Main sections.
3. Important components.
4. User interactions.
5. Data displayed.
6. Loading, empty, and error states.
7. Responsive behavior.

Only describe behavior supported by the implementation. Mark missing or incomplete states as gaps.

### 2.6 Component Design System

Document reusable components found in the repository, including relevant examples such as:

- Buttons.
- Cards.
- Badges.
- Tabs.
- Modals.
- Skeleton loaders.
- Error banners.
- Empty states.
- Markdown renderer.
- Charts.
- Citation drawer.
- Analysis header.
- Sidebar and top bar.

Explain when each component should be reused instead of creating another implementation.

### 2.7 Financial Data Visualization

Define consistent presentation rules for:

- Revenue and profit.
- Assets and liabilities.
- Financial trends.
- Company comparisons.
- Year-over-year changes.
- Risk severity.
- Financial tables.
- Source citations.

Rules:

- Always display units and reporting periods when available.
- Distinguish positive, negative, and neutral changes.
- Do not use color as the only indicator of meaning.
- Never display missing data as zero.
- Do not imply that a company is universally better based on one metric.
- Keep chart labels and legends readable.
- Use consistent number and currency formatting.

Verify existing chart behavior before documenting it as implemented.

### 2.8 UX States and Interactions

Specify design rules for:

- PDF upload.
- Document-processing progress.
- Research questions and answers.
- Evidence and citation viewing.
- Risk inspection.
- Company selection and comparison.
- Report generation and download.
- API failures.
- Empty workspaces.
- Missing or conflicting metrics.

Avoid fake progress indicators or success messages when the backend has not confirmed completion.

### 2.9 Accessibility

Document requirements for:

- Keyboard navigation.
- Visible focus states.
- Semantic headings.
- Form labels.
- Accessible dialogs.
- Color contrast.
- Screen-reader-friendly status messages.
- Accessible chart summaries.

Clearly distinguish existing accessibility support from recommended improvements.

### 2.10 Responsive Design

Define behavior for:

- Desktop.
- Tablet.
- Mobile.

Inspect existing CSS breakpoints and layouts. Do not invent implemented breakpoints.

Identify tables, charts, navigation, and dialogs that may require responsive improvements.

### 2.11 Frontend Data and API Integration

Inspect `front end/src/lib/api.ts`, `AppContext.tsx`, and `types.ts`.

Document:

- How pages communicate with backend APIs.
- How shared state is managed.
- How loading and errors are represented.
- How frontend types correspond to API responses.
- How citation and evidence data should be presented.

Do not invent endpoint names, payload fields, or application states.

### 2.12 Design Consistency Rules

Establish rules that future developers must follow:

1. Reuse existing shared components.
2. Reuse existing design tokens.
3. Avoid duplicated CSS and inconsistent styling.
4. Preserve established navigation patterns.
5. Use the shared formatters for financial values.
6. Keep visual states consistent across pages.
7. Make all interactive controls functional.
8. Keep financial evidence accessible.
9. Do not introduce mock financial data into production workflows.
10. Follow existing TypeScript types and API contracts.

### 2.13 Design Gaps and Recommendations

List concrete inconsistencies or missing UX behavior discovered during inspection.

Separate them into:

- Existing behavior.
- Identified gaps.
- Recommended improvements.

Do not modify application code as part of this documentation task.

## 3. Required Deliverable

Create:

`docs/DESIGN.md`

The file should be detailed enough that another developer can implement a new page without introducing a different visual language.

Include Mermaid diagrams only where they clarify navigation or user flow. Do not use diagrams as a substitute for explaining page layouts and interaction behavior.

## 4. Restrictions

- Do not modify frontend or backend source files.
- Do not install dependencies.
- Do not redesign the application during this task.
- Do not create fictional design tokens.
- Do not claim responsive or accessibility support without evidence.
- Do not alter existing documentation other than `docs/DESIGN.md`.
- If `docs/PRD.md` and `docs/ARCHITECTURE.md` exist, keep the design documentation consistent with them.

## 5. Validation

After creating the file:

1. Confirm `docs/DESIGN.md` exists.
2. Verify that all referenced page and component paths exist.
3. Check design values against actual CSS.
4. Verify navigation against `App.tsx` and `Sidebar.tsx`.
5. Verify frontend state and API behavior against the actual source.
6. List the design gaps found.
7. Summarize the sections created.

**Success criterion:** `docs/DESIGN.md` accurately describes the current FinSight AI UI and establishes a practical, consistent design system for future development without changing application behavior.