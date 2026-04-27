-- Ensure the canonical resource ordering column from the app schema exists.
-- Some databases may still have the old order_index column from pre-migration builds.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resources'
      AND column_name = 'order_index'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resources'
      AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE public.resources RENAME COLUMN order_index TO sort_order;
  ELSE
    ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS sort_order integer;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'resources'
        AND column_name = 'order_index'
    ) THEN
      UPDATE public.resources
      SET sort_order = order_index
      WHERE sort_order IS NULL;
    END IF;
  END IF;
END $$;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY created_at) - 1 AS rn
  FROM public.resources
  WHERE sort_order IS NULL
)
UPDATE public.resources
SET sort_order = ordered.rn
FROM ordered
WHERE public.resources.id = ordered.id;
