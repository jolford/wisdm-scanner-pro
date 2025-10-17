import { z } from 'zod';

/**
 * Validation schemas for all forms in the application
 * Using zod for type-safe runtime validation
 */

// Project schemas
export const projectSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Project name can only contain letters, numbers, spaces, hyphens, and underscores'),
  description: z.string()
    .trim()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  enableCheckScanning: z.boolean().default(false),
  extractionFields: z.array(
    z.object({
      name: z.string()
        .trim()
        .min(1, 'Field name is required')
        .max(50, 'Field name must be less than 50 characters'),
      description: z.string()
        .trim()
        .max(200, 'Field description must be less than 200 characters')
        .optional(),
    })
  ).min(1, 'At least one extraction field is required'),
  exportConfig: z.record(
    z.object({
      enabled: z.boolean(),
      destination: z.string()
        .trim()
        .max(500, 'Destination path must be less than 500 characters')
        .optional(),
      url: z.string()
        .trim()
        .max(255, 'URL must be less than 255 characters')
        .optional(),
      username: z.string()
        .trim()
        .max(100, 'Username must be less than 100 characters')
        .optional(),
      password: z.string()
        .max(255, 'Password must be less than 255 characters')
        .optional(),
      project: z.string()
        .trim()
        .max(100, 'Project name must be less than 100 characters')
        .optional(),
      fieldMappings: z.record(z.string()).optional(),
    })
    .refine((data) => {
      // If enabled, validate based on whether it's an ECM or file export
      if (!data.enabled) return true;
      
      // If has URL, it's an ECM export - validate ECM fields
      if (data.url) {
        return data.username && data.password && data.project;
      }
      
      // Otherwise it's a file export - validate destination
      // Allow Windows paths (C:\, \\network\), Unix paths (/path/), and spaces
      if (data.destination) {
        // Allow any valid path characters including backslashes, colons, spaces, etc.
        // Just check that it's not empty after trimming
        return data.destination.trim().length > 0;
      }
      
      return false; // Must have either URL or destination if enabled
    }, {
      message: 'Please complete all required fields for the export type'
    })
  ),
});

// Batch schemas
export const batchSchema = z.object({
  batchName: z.string()
    .trim()
    .min(1, 'Batch name is required')
    .max(100, 'Batch name must be less than 100 characters'),
  projectId: z.string()
    .uuid('Invalid project selection'),
  priority: z.number()
    .int()
    .min(0)
    .max(2),
  notes: z.string()
    .trim()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
});

// License schemas
export const licenseSchema = z.object({
  companyName: z.string()
    .trim()
    .min(1, 'Company name is required')
    .max(100, 'Company name must be less than 100 characters'),
  contactName: z.string()
    .trim()
    .max(100, 'Contact name must be less than 100 characters')
    .optional(),
  contactEmail: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
  phone: z.string()
    .trim()
    .max(20, 'Phone number must be less than 20 characters')
    .regex(/^[0-9\s\-\+\(\)]+$/, 'Invalid phone number format')
    .optional()
    .or(z.literal('')),
  totalDocuments: z.number()
    .int('Total documents must be a whole number')
    .min(1, 'Total documents must be at least 1')
    .max(10000000, 'Total documents must be less than 10 million'),
  durationMonths: z.number()
    .int('Duration must be a whole number')
    .min(1, 'Duration must be at least 1 month')
    .max(36, 'Duration must be less than 36 months'),
  notes: z.string()
    .trim()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional(),
});

// Document validation schemas
export const documentMetadataSchema = z.record(
  z.string()
    .trim()
    .max(500, 'Field value must be less than 500 characters')
);

export const validationNotesSchema = z.string()
  .trim()
  .max(1000, 'Validation notes must be less than 1000 characters')
  .optional();

// Export type definitions
export type ProjectFormData = z.infer<typeof projectSchema>;
export type BatchFormData = z.infer<typeof batchSchema>;
export type LicenseFormData = z.infer<typeof licenseSchema>;
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;
