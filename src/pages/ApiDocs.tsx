import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';

const ApiDocs = () => {
  useEffect(() => {
    document.title = 'API Documentation';
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Print button - hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 z-50">
        <Button onClick={handlePrint} className="gap-2">
          <Download className="h-4 w-4" />
          Download as PDF
        </Button>
      </div>

      {/* Documentation content */}
      <div className="max-w-4xl mx-auto p-8 print:p-0">
        <div className="space-y-8">
          {/* Header */}
          <div className="border-b pb-6 print:border-black">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-8 w-8 text-primary print:text-black" />
              <h1 className="text-4xl font-bold">REST API Documentation</h1>
            </div>
            <p className="text-muted-foreground print:text-gray-700">
              Document Management System API Reference
            </p>
            <p className="text-sm text-muted-foreground print:text-gray-600 mt-2">
              Version 1.0 | Last Updated: January 2025
            </p>
          </div>

          {/* Overview */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-primary print:text-black">Overview</h2>
            <p className="text-muted-foreground print:text-gray-800 mb-4">
              This document describes the REST API endpoints available for the Document Management System.
              All endpoints require authentication via JWT token.
            </p>
            <div className="bg-muted print:bg-gray-100 p-4 rounded-lg print:rounded-none">
              <p className="font-mono text-sm">
                <strong>Base URL:</strong> https://pbyerakkryuflamlmpvm.supabase.co/functions/v1
              </p>
            </div>
          </section>

          {/* Authentication */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-primary print:text-black">Authentication</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Internal API (JWT)</h3>
                <p className="text-muted-foreground print:text-gray-800 mb-2">
                  Internal endpoints require a Bearer token in the Authorization header:
                </p>
                <div className="bg-muted print:bg-gray-100 p-4 rounded-lg print:rounded-none font-mono text-sm">
                  Authorization: Bearer YOUR_JWT_TOKEN
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Public API (API Key)</h3>
                <p className="text-muted-foreground print:text-gray-800 mb-2">
                  Public v1 endpoints require an API key in the X-API-Key header:
                </p>
                <div className="bg-muted print:bg-gray-100 p-4 rounded-lg print:rounded-none font-mono text-sm">
                  X-API-Key: YOUR_CUSTOMER_ID
                </div>
                <p className="text-xs text-muted-foreground print:text-gray-600 mt-2">
                  Note: Currently uses customer_id as the API key. Contact your administrator for your API key.
                </p>
              </div>
            </div>
          </section>

          {/* Public API v1 */}
          <section className="break-before-auto">
            <h2 className="text-2xl font-bold mb-4 text-primary print:text-black border-t pt-6 print:border-black">
              Public API (v1) - External Integration
            </h2>
            <p className="text-sm text-muted-foreground print:text-gray-800 mb-4">
              These endpoints use API key authentication and are designed for external system integrations.
            </p>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Submit Document</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  POST /api-v1-submit
                </p>
                <p className="text-sm text-muted-foreground print:text-gray-800 mb-2">
                  Upload and process a document. Returns a document ID for status tracking.
                </p>
                <div className="bg-muted print:bg-gray-100 p-3 rounded print:rounded-none text-xs">
                  <p className="font-semibold mb-2">Request Body (JSON):</p>
                  <pre className="whitespace-pre-wrap">{`{
  "project_id": "uuid",
  "file_base64": "base64_encoded_file",
  "file_name": "document.pdf",
  "file_type": "application/pdf",
  "batch_name": "API-Batch-001" (optional),
  "metadata": {} (optional)
}`}</pre>
                  <p className="font-semibold mt-3 mb-2">Response:</p>
                  <pre className="whitespace-pre-wrap">{`{
  "document_id": "uuid",
  "batch_id": "uuid",
  "status": "processing"
}`}</pre>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Check Status</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  GET /api-v1-status?document_id=UUID
                </p>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  GET /api-v1-status?batch_id=UUID
                </p>
                <p className="text-sm text-muted-foreground print:text-gray-800 mb-2">
                  Check processing status of a document or batch. Returns current status and confidence scores.
                </p>
                <div className="bg-muted print:bg-gray-100 p-3 rounded print:rounded-none text-xs">
                  <p className="font-semibold mb-2">Response (Document):</p>
                  <pre className="whitespace-pre-wrap">{`{
  "document_id": "uuid",
  "file_name": "document.pdf",
  "status": "validated",
  "confidence_score": 0.95,
  "extracted_data": {...},
  "created_at": "2025-01-15T10:00:00Z",
  "validated_at": "2025-01-15T10:05:00Z"
}`}</pre>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Retrieve Data</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  GET /api-v1-retrieve?document_id=UUID
                </p>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  GET /api-v1-retrieve?batch_id=UUID&status=validated
                </p>
                <p className="text-sm text-muted-foreground print:text-gray-800 mb-2">
                  Retrieve validated document data and extracted information. Only returns documents with "validated" status unless status parameter is specified.
                </p>
                <div className="bg-muted print:bg-gray-100 p-3 rounded print:rounded-none text-xs">
                  <p className="font-semibold mb-2">Response:</p>
                  <pre className="whitespace-pre-wrap">{`{
  "document_id": "uuid",
  "file_name": "invoice.pdf",
  "status": "validated",
  "confidence_score": 0.98,
  "extracted_data": {
    "Invoice Number": "40925",
    "Invoice Date": "7/30/2020",
    "Invoice Total": "$5,119.80",
    "Vendor Name": "Acme Corp"
  },
  "line_items": [...],
  "validated_at": "2025-01-15T10:05:00Z",
  "validated_by": "uuid"
}`}</pre>
                </div>
              </div>
            </div>
          </section>

          {/* Documents API */}
          <section className="break-before-auto">
            <h2 className="text-2xl font-bold mb-4 text-primary print:text-black border-t pt-6 print:border-black">
              Documents API (Internal - JWT Required)
            </h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">List Documents</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  GET /api-documents
                </p>
                <div className="space-y-2 text-sm">
                  <p className="font-semibold">Query Parameters:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground print:text-gray-800">
                    <li>project_id (optional): Filter by project ID</li>
                    <li>batch_id (optional): Filter by batch ID</li>
                    <li>status (optional): Filter by validation status</li>
                    <li>limit (optional, default: 50): Results per page</li>
                    <li>offset (optional, default: 0): Pagination offset</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Get Document</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  GET /api-documents/{'{id}'}
                </p>
                <p className="text-sm text-muted-foreground print:text-gray-800">
                  Returns detailed information about a specific document including metadata and extracted text.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Update Document</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  PUT /api-documents/{'{id}'}
                </p>
                <p className="text-sm text-muted-foreground print:text-gray-800 mb-2">
                  Update document validation status, metadata, or classification.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Delete Document</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  DELETE /api-documents/{'{id}'}
                </p>
                <p className="text-sm text-muted-foreground print:text-gray-800">
                  Permanently deletes a document and its associated files.
                </p>
              </div>
            </div>
          </section>

          {/* Batches API */}
          <section className="break-before-auto">
            <h2 className="text-2xl font-bold mb-4 text-primary print:text-black border-t pt-6 print:border-black">
              Batches API (Internal - JWT Required)
            </h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">List Batches</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  GET /api-batches
                </p>
                <div className="space-y-2 text-sm">
                  <p className="font-semibold">Query Parameters:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground print:text-gray-800">
                    <li>project_id (optional): Filter by project ID</li>
                    <li>status (optional): Filter by batch status</li>
                    <li>limit (optional, default: 50): Results per page</li>
                    <li>offset (optional, default: 0): Pagination offset</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Create Batch</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  POST /api-batches
                </p>
                <p className="text-sm text-muted-foreground print:text-gray-800 mb-2">
                  Create a new batch for organizing documents.
                </p>
                <div className="bg-muted print:bg-gray-100 p-3 rounded print:rounded-none text-xs">
                  <p className="font-semibold mb-2">Priority Levels:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>0 = Low</li>
                    <li>5 = Normal</li>
                    <li>10 = High</li>
                    <li>20 = Urgent</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Update Batch</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  PUT /api-batches/{'{id}'}
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Delete Batch</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  DELETE /api-batches/{'{id}'}
                </p>
              </div>
            </div>
          </section>

          {/* Analytics API */}
          <section className="break-before-auto">
            <h2 className="text-2xl font-bold mb-4 text-primary print:text-black border-t pt-6 print:border-black">
              Analytics API (Internal - JWT Required)
            </h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">Get Analytics (Admin Only)</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  GET /api-analytics
                </p>
                <div className="space-y-2 text-sm">
                  <p className="font-semibold">Query Parameters:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground print:text-gray-800">
                    <li>days (optional, default: 30): Analysis period (7, 30, 90, 365)</li>
                    <li>format (optional, default: json): Response format (json or csv)</li>
                  </ul>
                  <p className="mt-3 text-muted-foreground print:text-gray-800">
                    Returns comprehensive metrics including document statistics, job performance,
                    cost analysis, and quality metrics.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Jobs API */}
          <section className="break-before-auto">
            <h2 className="text-2xl font-bold mb-4 text-primary print:text-black border-t pt-6 print:border-black">
              Jobs API (Internal - JWT Required)
            </h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-2">List Jobs</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  GET /api-jobs
                </p>
                <div className="bg-muted print:bg-gray-100 p-3 rounded print:rounded-none text-xs mt-2">
                  <p className="font-semibold mb-2">Job Types:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>ocr_document - OCR processing</li>
                    <li>export_batch - Batch export</li>
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Create Job</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  POST /api-jobs
                </p>
                <p className="text-sm text-muted-foreground print:text-gray-800">
                  Queue a new OCR or export job with specified priority.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Get Job Status</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  GET /api-jobs/{'{id}'}
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">Cancel Job</h3>
                <p className="font-mono text-sm bg-muted print:bg-gray-100 p-2 rounded print:rounded-none mb-2">
                  DELETE /api-jobs/{'{id}'}
                </p>
              </div>
            </div>
          </section>

          {/* Error Responses */}
          <section className="break-before-auto">
            <h2 className="text-2xl font-bold mb-4 text-primary print:text-black border-t pt-6 print:border-black">
              Error Responses
            </h2>
            <div className="space-y-2 text-sm">
              <p className="font-semibold mb-2">HTTP Status Codes:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground print:text-gray-800">
                <li>200 OK - Success</li>
                <li>201 Created - Resource created successfully</li>
                <li>400 Bad Request - Invalid request parameters</li>
                <li>401 Unauthorized - Missing or invalid authentication</li>
                <li>403 Forbidden - Insufficient permissions</li>
                <li>404 Not Found - Resource not found</li>
                <li>429 Too Many Requests - Rate limit exceeded</li>
                <li>500 Internal Server Error - Server error</li>
              </ul>
            </div>
          </section>

          {/* Rate Limiting */}
          <section>
            <h2 className="text-2xl font-bold mb-4 text-primary print:text-black border-t pt-6 print:border-black">
              Rate Limiting
            </h2>
            <div className="bg-muted print:bg-gray-100 p-4 rounded-lg print:rounded-none">
              <p className="font-semibold mb-2">API Rate Limits (per customer/tenant):</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Maximum concurrent jobs: 5</li>
                <li>Maximum jobs per minute: 20</li>
                <li>Maximum jobs per hour: 500</li>
              </ul>
            </div>
          </section>

          {/* Best Practices */}
          <section className="break-before-auto">
            <h2 className="text-2xl font-bold mb-4 text-primary print:text-black border-t pt-6 print:border-black">
              Best Practices
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground print:text-gray-800">
              <li>Always use pagination for large datasets</li>
              <li>Use query parameters to filter and reduce response size</li>
              <li>Poll job endpoints to track long-running operations</li>
              <li>Implement retry logic for 5xx server errors</li>
              <li>Never expose JWT tokens in client-side code</li>
              <li>Reserve high/urgent priorities for critical jobs only</li>
            </ol>
          </section>

          {/* Footer */}
          <div className="border-t pt-6 text-center text-sm text-muted-foreground print:text-gray-600 print:border-black">
            <p>For support or questions, contact your system administrator.</p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          @page {
            margin: 1.5cm;
          }
        }
      `}</style>
    </div>
  );
};

export default ApiDocs;
