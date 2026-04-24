-- Expand the resources.type CHECK constraint to include new content types.
-- Old values (pdf, video, online_course, textbook, exercises, other) are kept for backwards compatibility.

ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_type_check;
ALTER TABLE public.resources ADD CONSTRAINT resources_type_check
  CHECK (type IN (
    'pdf', 'textbook', 'notes', 'slides',
    'video', 'lecture_recording', 'podcast',
    'article', 'problem_set',
    'online_course', 'exercises', 'other'
  ));
