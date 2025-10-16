# REST API Documentation

## Overview
This document describes the REST API endpoints available for the Document Management System. All endpoints require authentication via JWT token.

## Base URL
```
https://pbyerakkryuflamlmpvm.supabase.co/functions/v1
```

## Authentication
All API endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

To get your JWT token, authenticate through the web application and retrieve the session token.

---

## Documents API

### List Documents
**GET** `/api-documents`

Retrieve a list of documents with optional filters.

**Query Parameters:**
- `project_id` (optional): Filter by project ID
- `batch_id` (optional): Filter by batch ID
- `status` (optional): Filter by validation status (pending, validated, rejected)
- `limit` (optional, default: 50): Number of results per page
- `offset` (optional, default: 0): Pagination offset

**Example:**
```bash
curl -X GET \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-documents?limit=10&status=validated" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "file_name": "document.pdf",
      "validation_status": "validated",
      "confidence_score": 95.5,
      "extracted_metadata": {},
      "created_at": "2025-01-01T00:00:00Z",
      "projects": { "name": "Project Name" }
    }
  ],
  "total": 100,
  "limit": 10,
  "offset": 0
}
```

---

### Get Document
**GET** `/api-documents/{id}`

Get details of a specific document.

**Example:**
```bash
curl -X GET \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-documents/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "id": "uuid",
  "file_name": "document.pdf",
  "validation_status": "validated",
  "extracted_text": "Full extracted text...",
  "extracted_metadata": {
    "Accessioning Number": "CL2021-00353877"
  },
  "confidence_score": 95.5,
  "projects": { "name": "Project Name" },
  "batches": { "batch_name": "Batch 001" }
}
```

---

### Update Document
**PUT** `/api-documents/{id}`

Update document validation status, metadata, or classification.

**Request Body:**
```json
{
  "validation_status": "validated",
  "validation_notes": "Verified accessioning number",
  "extracted_metadata": {
    "Accessioning Number": "CL2021-00353877",
    "Custom Field": "Value"
  },
  "document_class_id": "uuid"
}
```

**Example:**
```bash
curl -X PUT \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-documents/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "validation_status": "validated",
    "validation_notes": "Document approved"
  }'
```

---

### Delete Document
**DELETE** `/api-documents/{id}`

Delete a document.

**Example:**
```bash
curl -X DELETE \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-documents/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Batches API

### List Batches
**GET** `/api-batches`

Retrieve a list of batches with optional filters.

**Query Parameters:**
- `project_id` (optional): Filter by project ID
- `status` (optional): Filter by batch status (new, processing, completed, exported)
- `limit` (optional, default: 50): Number of results per page
- `offset` (optional, default: 0): Pagination offset

**Example:**
```bash
curl -X GET \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-batches?status=processing" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "batches": [
    {
      "id": "uuid",
      "batch_name": "Batch 001",
      "status": "processing",
      "priority": 10,
      "total_documents": 50,
      "processed_documents": 25,
      "created_at": "2025-01-01T00:00:00Z",
      "projects": { "name": "Project Name" }
    }
  ],
  "total": 20,
  "limit": 50,
  "offset": 0
}
```

---

### Get Batch with Documents
**GET** `/api-batches/{id}`

Get details of a specific batch including all documents.

**Example:**
```bash
curl -X GET \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-batches/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "id": "uuid",
  "batch_name": "Batch 001",
  "status": "processing",
  "priority": 10,
  "total_documents": 50,
  "documents": [
    {
      "id": "uuid",
      "file_name": "doc1.pdf",
      "validation_status": "validated",
      "page_number": 1
    }
  ]
}
```

---

### Create Batch
**POST** `/api-batches`

Create a new batch.

**Request Body:**
```json
{
  "batch_name": "Batch 001",
  "project_id": "uuid",
  "priority": 10,
  "notes": "Optional notes",
  "metadata": {}
}
```

**Example:**
```bash
curl -X POST \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-batches" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_name": "Lab Results - January 2025",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "priority": 10
  }'
```

---

### Update Batch
**PUT** `/api-batches/{id}`

Update batch status, priority, or metadata.

**Request Body:**
```json
{
  "status": "completed",
  "priority": 20,
  "notes": "Updated notes",
  "metadata": {}
}
```

**Example:**
```bash
curl -X PUT \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-batches/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "priority": 20
  }'
```

---

### Delete Batch
**DELETE** `/api-batches/{id}`

Delete a batch (will also delete associated documents).

**Example:**
```bash
curl -X DELETE \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-batches/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Analytics API

### Get Analytics
**GET** `/api-analytics`

Get comprehensive analytics data (Admin only).

**Query Parameters:**
- `days` (optional, default: 30): Number of days to analyze (7, 30, 90, 365)
- `format` (optional, default: json): Response format (json or csv)

**Example:**
```bash
curl -X GET \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-analytics?days=30&format=json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "period": {
    "days": 30,
    "start": "2024-12-01T00:00:00Z",
    "end": "2025-01-01T00:00:00Z"
  },
  "documents": {
    "total": 1000,
    "validated": 850,
    "pending": 150,
    "validationRate": "85.00"
  },
  "jobs": {
    "total": 1000,
    "completed": 950,
    "failed": 50,
    "avgProcessingTimeSeconds": 45,
    "errorRate": "5.00"
  },
  "costs": {
    "totalUsd": "125.50",
    "avgPerDocUsd": "0.1255"
  },
  "quality": {
    "extractionAccuracy": "94.50",
    "statusBreakdown": {
      "validated": 850,
      "pending": 100,
      "rejected": 50
    }
  }
}
```

**CSV Export Example:**
```bash
curl -X GET \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-analytics?days=30&format=csv" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -o analytics.csv
```

---

## Jobs API

### List Jobs
**GET** `/api-jobs`

Retrieve a list of processing jobs.

**Query Parameters:**
- `status` (optional): Filter by status (pending, processing, completed, failed)
- `job_type` (optional): Filter by type (ocr_document, export_batch)
- `limit` (optional, default: 50): Number of results per page
- `offset` (optional, default: 0): Pagination offset

**Example:**
```bash
curl -X GET \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-jobs?status=completed&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "jobs": [
    {
      "id": "uuid",
      "job_type": "ocr_document",
      "status": "completed",
      "priority": "high",
      "created_at": "2025-01-01T00:00:00Z",
      "completed_at": "2025-01-01T00:02:00Z",
      "result": {}
    }
  ],
  "total": 100,
  "limit": 10,
  "offset": 0
}
```

---

### Get Job Status
**GET** `/api-jobs/{id}`

Get details and status of a specific job.

**Example:**
```bash
curl -X GET \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-jobs/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "id": "uuid",
  "job_type": "ocr_document",
  "status": "completed",
  "priority": "high",
  "payload": {},
  "result": {
    "text": "Extracted text...",
    "metadata": {}
  },
  "created_at": "2025-01-01T00:00:00Z",
  "started_at": "2025-01-01T00:00:30Z",
  "completed_at": "2025-01-01T00:02:00Z"
}
```

---

### Create Job
**POST** `/api-jobs`

Queue a new OCR or export job.

**Request Body:**
```json
{
  "job_type": "ocr_document",
  "priority": "high",
  "payload": {
    "document_id": "uuid",
    "extraction_fields": []
  }
}
```

**Example:**
```bash
curl -X POST \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-jobs" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "ocr_document",
    "priority": "high",
    "payload": {
      "document_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  }'
```

**Response:**
```json
{
  "id": "uuid",
  "job_type": "ocr_document",
  "status": "pending",
  "priority": "high",
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

### Cancel Job
**DELETE** `/api-jobs/{id}`

Cancel a pending job.

**Example:**
```bash
curl -X DELETE \
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-jobs/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Error Responses

All endpoints return standard HTTP status codes:

- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `405 Method Not Allowed` - HTTP method not supported
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

**Error Response Format:**
```json
{
  "error": "Error message description"
}
```

---

## Rate Limiting

API requests are rate limited per customer/tenant:
- Maximum concurrent jobs: 5
- Maximum jobs per minute: 20
- Maximum jobs per hour: 500

When rate limits are exceeded, you'll receive a `429` status code.

---

## Webhook Support

To receive real-time notifications when jobs complete or documents are validated, you can set up webhooks (contact support to configure).

---

## Best Practices

1. **Use pagination** - Always use `limit` and `offset` for large datasets
2. **Filter results** - Use query parameters to reduce response size
3. **Check job status** - Poll job endpoints to track long-running operations
4. **Handle errors gracefully** - Implement retry logic for 5xx errors
5. **Secure your tokens** - Never expose JWT tokens in client-side code
6. **Use appropriate priorities** - Reserve high/urgent priorities for critical jobs

---

## Need Help?

For questions or issues with the API, contact support or check the admin analytics dashboard for system status.
