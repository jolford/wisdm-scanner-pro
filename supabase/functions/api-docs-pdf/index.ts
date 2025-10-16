import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const documentation = `
# REST API Documentation

## Overview
This document describes the REST API endpoints available for the Document Management System. All endpoints require authentication via JWT token.

## Base URL
https://pbyerakkryuflamlmpvm.supabase.co/functions/v1

## Authentication
All API endpoints require a Bearer token in the Authorization header:
Authorization: Bearer YOUR_JWT_TOKEN

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## DOCUMENTS API

### List Documents
GET /api-documents

Query Parameters:
• project_id (optional): Filter by project ID
• batch_id (optional): Filter by batch ID
• status (optional): Filter by validation status
• limit (optional, default: 50): Results per page
• offset (optional, default: 0): Pagination offset

Example Response:
{
  "documents": [...],
  "total": 100,
  "limit": 10,
  "offset": 0
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Get Document
GET /api-documents/{id}

Returns detailed information about a specific document including:
• File information and metadata
• Validation status and notes
• Extracted text and confidence score
• Related project and batch information

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Update Document
PUT /api-documents/{id}

Request Body:
{
  "validation_status": "validated",
  "validation_notes": "Verified",
  "extracted_metadata": {},
  "document_class_id": "uuid"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Delete Document
DELETE /api-documents/{id}

Permanently deletes a document and its associated files.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## BATCHES API

### List Batches
GET /api-batches

Query Parameters:
• project_id (optional): Filter by project ID
• status (optional): Filter by batch status
• limit (optional, default: 50): Results per page
• offset (optional, default: 0): Pagination offset

Batch Statuses: new, processing, completed, exported

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Get Batch with Documents
GET /api-batches/{id}

Returns batch details including all associated documents.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Create Batch
POST /api-batches

Request Body:
{
  "batch_name": "Batch 001",
  "project_id": "uuid",
  "priority": 10,
  "notes": "Optional notes",
  "metadata": {}
}

Priority Levels:
• 0 = Low
• 5 = Normal
• 10 = High
• 20 = Urgent

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Update Batch
PUT /api-batches/{id}

Request Body:
{
  "status": "completed",
  "priority": 20,
  "notes": "Updated notes",
  "metadata": {}
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Delete Batch
DELETE /api-batches/{id}

Deletes batch and associated documents.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ANALYTICS API

### Get Analytics (Admin Only)
GET /api-analytics

Query Parameters:
• days (optional, default: 30): Analysis period (7, 30, 90, 365)
• format (optional, default: json): Response format (json or csv)

Returns comprehensive metrics:
• Document statistics and validation rates
• Job performance and processing times
• Cost analysis and usage
• Quality metrics and extraction accuracy
• System-wide statistics

CSV Export Available:
Use format=csv to download analytics as CSV file

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## JOBS API

### List Jobs
GET /api-jobs

Query Parameters:
• status (optional): Filter by status
• job_type (optional): Filter by type
• limit (optional, default: 50): Results per page
• offset (optional, default: 0): Pagination offset

Job Types: ocr_document, export_batch
Job Statuses: pending, processing, completed, failed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Get Job Status
GET /api-jobs/{id}

Returns detailed job information including:
• Current status and timestamps
• Payload and results
• Error messages if failed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Create Job
POST /api-jobs

Request Body:
{
  "job_type": "ocr_document",
  "priority": "high",
  "payload": {
    "document_id": "uuid",
    "extraction_fields": []
  }
}

Priority Levels: low, normal, high, urgent

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Cancel Job
DELETE /api-jobs/{id}

Cancels a pending job. Only pending jobs can be cancelled.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ERROR RESPONSES

HTTP Status Codes:
• 200 OK - Success
• 201 Created - Resource created
• 400 Bad Request - Invalid parameters
• 401 Unauthorized - Missing/invalid auth
• 403 Forbidden - Insufficient permissions
• 404 Not Found - Resource not found
• 405 Method Not Allowed - Invalid HTTP method
• 429 Too Many Requests - Rate limit exceeded
• 500 Internal Server Error - Server error

Error Format:
{
  "error": "Error message description"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## RATE LIMITING

API requests are rate limited per customer/tenant:
• Maximum concurrent jobs: 5
• Maximum jobs per minute: 20
• Maximum jobs per hour: 500

When limits are exceeded, you'll receive HTTP 429 status.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## BEST PRACTICES

1. Use Pagination
   Always use limit and offset for large datasets

2. Filter Results
   Use query parameters to reduce response size

3. Check Job Status
   Poll job endpoints for long-running operations

4. Handle Errors Gracefully
   Implement retry logic for 5xx errors

5. Secure Your Tokens
   Never expose JWT tokens in client-side code

6. Use Appropriate Priorities
   Reserve high/urgent for critical jobs only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## EXAMPLE REQUESTS

Get Documents:
curl -X GET \\
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-documents?limit=10" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

Create Batch:
curl -X POST \\
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-batches" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "batch_name": "Lab Results",
    "project_id": "uuid",
    "priority": 10
  }'

Get Analytics:
curl -X GET \\
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-analytics?days=30" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

Queue OCR Job:
curl -X POST \\
  "https://pbyerakkryuflamlmpvm.supabase.co/functions/v1/api-jobs" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "job_type": "ocr_document",
    "priority": "high",
    "payload": {"document_id": "uuid"}
  }'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For support or questions, contact your system administrator.

Document Version: 1.0
Last Updated: January 2025
`;

    // Convert to simple text-based PDF format (plain text with formatting)
    const pdfContent = documentation;

    return new Response(pdfContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="API-Documentation.txt"',
      },
    });

  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
