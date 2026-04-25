-- Enforce course ownership for new resources and sessions without validating
-- historical rows. Existing RLS already requires inserted row.user_id = auth.uid().
-- These composite FKs require row.course_id to point at a course with the same
-- user_id, so inserted resources/sessions cannot reference another user's course.
--
-- Optional pre-validation checks for existing data:
-- select r.id from public.resources r join public.courses c on c.id = r.course_id where c.user_id <> r.user_id;
-- select s.id from public.sessions s join public.courses c on c.id = s.course_id where c.user_id <> s.user_id;

create unique index if not exists courses_id_user_id_idx
  on public.courses (id, user_id);

alter table public.resources
  add constraint resources_course_owner_fk
  foreign key (course_id, user_id)
  references public.courses (id, user_id)
  on delete cascade
  not valid;

alter table public.sessions
  add constraint sessions_course_owner_fk
  foreign key (course_id, user_id)
  references public.courses (id, user_id)
  on delete cascade
  not valid;
