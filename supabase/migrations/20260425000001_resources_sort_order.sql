-- Add sort_order to resources for manual drag-to-reorder.
-- Initialize each resource's sort_order to its position within the course (by created_at).
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY created_at) - 1 AS rn
  FROM public.resources
)
UPDATE public.resources SET sort_order = ordered.rn
FROM ordered WHERE public.resources.id = ordered.id;
