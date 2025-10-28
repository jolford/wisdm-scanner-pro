-- Add 'suspended' status to batch_status enum
ALTER TYPE public.batch_status ADD VALUE IF NOT EXISTS 'suspended';