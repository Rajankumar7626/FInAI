import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  compareDocuments,
  generateReport,
  getDocuments,
  getHealth,
  setApiAuthentication,
  uploadDocument,
} from '../lib/api'

const healthPayload = { status: 'ok', service: 'finsight-ai' }
const documentPayload = [{
  document_id: '11111111-1111-1111-1111-111111111111',
  filename: 'annual-report.pdf',
  page_count: 1,
  extracted_character_count: 42,
  extraction_status: 'completed',
}]

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    setApiAuthentication(async () => 'synthetic-access-token')
  })

  it('returns health and document responses from the backend', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(jsonResponse(healthPayload))
      .mockResolvedValueOnce(jsonResponse(documentPayload))

    await expect(getHealth()).resolves.toEqual(healthPayload)
    await expect(getDocuments()).resolves.toEqual(documentPayload)
    expect(fetchMock.mock.calls[1][0]).toBe('http://127.0.0.1:8000/documents')
    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ Accept: 'application/json' })
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({
      Accept: 'application/json',
      Authorization: 'Bearer synthetic-access-token',
    })
  })

  it('formats PDF uploads as multipart form data', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...documentPayload[0], extracted_text: 'Revenue: USD 100 million' }))
    const file = new File(['pdf bytes'], 'report.pdf', { type: 'application/pdf' })

    await uploadDocument(file)

    const request = fetchMock.mock.calls[0]?.[1]
    if (!request) throw new Error('Upload request was not captured.')
    expect(request.method).toBe('POST')
    expect(request.body).toBeInstanceOf(FormData)
    expect((request.body as FormData).get('file')).toBe(file)
  })

  it('surfaces structured API errors and network failures', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Document not found.' }, 404))
    await expect(getDocuments()).rejects.toMatchObject<ApiError>({
      name: 'ApiError',
      status: 404,
      message: 'Document not found.',
    })

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: 'Upload request exceeds the configured size limit.' }, 413),
    )
    await expect(getDocuments()).rejects.toMatchObject<ApiError>({
      name: 'ApiError',
      status: 413,
      message: 'Upload request exceeds the configured size limit.',
    })

    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await expect(getHealth()).rejects.toMatchObject<ApiError>({
      name: 'ApiError',
      status: 0,
      message: 'The backend is unavailable. Check that the API server is running.',
    })
  })

  it('invokes the session handler when a protected request returns 401', async () => {
    const fetchMock = vi.mocked(fetch)
    const onUnauthorized = vi.fn()
    setApiAuthentication(async () => 'synthetic-access-token', onUnauthorized)
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Unauthorized' }, 401))

    await expect(getDocuments()).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('formats comparison and report request bodies', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ metrics: [], limitations: [] }))
      .mockResolvedValueOnce(jsonResponse({ report_id: 'report-1' }))

    await compareDocuments('first-id', 'second-id')
    await generateReport('first-id', 'second-id')

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      first_document_id: 'first-id',
      second_document_id: 'second-id',
    })
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      first_document_id: 'first-id',
      second_document_id: 'second-id',
    })
  })
})
