-- Allow course owners to access their resources even if historical resource rows
-- have stale ownership metadata. This does not change table structure.

drop policy if exists "users can select own resources" on public.resources;
drop policy if exists "users can insert own resources" on public.resources;
drop policy if exists "users can update own resources" on public.resources;
drop policy if exists "users can delete own resources" on public.resources;

create policy "users can select own resources"
  on public.resources for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.courses c
      where c.id = resources.course_id
        and c.user_id = auth.uid()
    )
  );

create policy "users can insert own resources"
  on public.resources for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.courses c
      where c.id = resources.course_id
        and c.user_id = auth.uid()
    )
  );

create policy "users can update own resources"
  on public.resources for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.courses c
      where c.id = resources.course_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.courses c
      where c.id = resources.course_id
        and c.user_id = auth.uid()
    )
  );

create policy "users can delete own resources"
  on public.resources for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.courses c
      where c.id = resources.course_id
        and c.user_id = auth.uid()
    )
  );
