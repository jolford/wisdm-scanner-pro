-- Expand access to duplicate_detections so users who uploaded documents can see their own duplicates
ALTER POLICY "Users can view duplicate detections for their documents"
ON public.duplicate_detections
USING (
  EXISTS (
    SELECT 1
    FROM public.documents d
    LEFT JOIN public.batches b ON b.id = d.batch_id
    LEFT JOIN public.projects p ON p.id = b.project_id
    WHERE d.id = duplicate_detections.document_id
      AND (
        d.uploaded_by = auth.uid()
        OR public.has_customer(auth.uid(), p.customer_id)
        OR public.is_system_admin(auth.uid())
      )
  )
);
