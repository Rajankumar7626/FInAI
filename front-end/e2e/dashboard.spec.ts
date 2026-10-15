import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const backendURL = 'http://127.0.0.1:8002'
const createdDocumentIds: string[] = []

function escapePdfText(text: string) {
  return text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
}

function makeSyntheticPdf(text: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${escapePdfText(text.split('\n')[0])}) Tj 0 -20 Td (${escapePdfText(text.split('\n')[1] ?? '')}) Tj 0 -20 Td (${escapePdfText(text.split('\n')[2] ?? '')}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ]
  const header = '%PDF-1.4\n'
  let body = header
  const offsets = [0]
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body))
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return Buffer.from(body, 'ascii')
}

async function uploadPdf(page: Page, request: APIRequestContext, filename: string, text: string) {
  await page.getByLabel('Upload PDF').setInputFiles({
    name: filename,
    mimeType: 'application/pdf',
    buffer: makeSyntheticPdf(text),
  })
  await expect(page.getByText(`${filename} is ready for analysis.`)).toBeVisible()
  const response = await request.get(`${backendURL}/documents`)
  const payload = await response.json() as unknown
  if (!Array.isArray(payload)) {
    throw new Error(`Document list request failed (${response.status()}): ${JSON.stringify(payload)}`)
  }
  const documents = payload as { document_id: string; filename: string }[]
  const created = documents.find((document) => document.filename === filename)
  if (!created) throw new Error(`Uploaded document was not registered: ${filename}`)
  createdDocumentIds.push(created.document_id)
  return created.document_id
}

test.afterEach(async ({ request }) => {
  for (const documentId of createdDocumentIds.splice(0)) {
    await request.delete(`${backendURL}/documents/${documentId}`)
  }
})

test('loads the dashboard and handles an empty workspace', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Online')).toBeVisible()
  await expect(page.getByText('No reports yet')).toBeVisible()
})

test('uploads a report and shows financial evidence and risk limitations', async ({ page, request }) => {
  await page.goto('/')
  const filename = `browser-financial-${Date.now()}.pdf`
  await uploadPdf(page, request, filename, 'Revenue for 2024: USD 100 million\nNet income: (USD 10 million)\nTotal assets: USD 100 million')

  await expect(page.getByRole('button', { name: new RegExp(filename) })).toBeVisible()
  await expect(page.getByText('revenue')).toBeVisible()
  await expect(page.getByText('USD 100 million', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Risk analysis/ }).click()
  await expect(page.getByText('Negative net income')).toBeVisible()
  await expect(page.getByText('Limitations')).toBeVisible()
})

test('compares two reports and generates a research report', async ({ page, request }) => {
  await page.goto('/')
  const firstFilename = `browser-first-${Date.now()}.pdf`
  const secondFilename = `browser-second-${Date.now()}.pdf`
  await uploadPdf(page, request, firstFilename, 'Revenue for 2024: USD 100 million')
  await uploadPdf(page, request, secondFilename, 'Revenue for 2024: USD 150 million')
  await page.getByRole('button', { name: new RegExp(firstFilename) }).click()

  await page.getByRole('button', { name: /Comparison/ }).click()
  await page.getByLabel('Second report').selectOption({ label: secondFilename })
  await page.getByRole('button', { name: 'Run comparison' }).click()
  await expect(page.getByText('Comparison results')).toBeVisible()
  await expect(page.getByText('+50', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Reports/ }).click()
  await page.getByLabel('Optional comparison report').selectOption({ label: secondFilename })
  await page.getByRole('button', { name: 'Generate report' }).click()
  await expect(page.getByText('Research report', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Extracted metrics', exact: true })).toBeVisible()
  await expect(page.getByText('Method', { exact: true })).toBeVisible()
})

test('shows API errors and deletes a document after confirmation', async ({ page, request }) => {
  await page.route('**/health', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Service unavailable' }) }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Service unavailable')
  await page.unroute('**/health')

  const filename = `browser-delete-${Date.now()}.pdf`
  await uploadPdf(page, request, filename, 'Revenue for 2024: USD 100 million')
  await page.getByRole('button', { name: /Documents/ }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete document' }).click()
  await expect(page.getByText('No reports yet')).toBeVisible()
})
