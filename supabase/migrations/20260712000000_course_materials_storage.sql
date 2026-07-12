-- Course lecture-notes (PDF) storage: replaces the previous client-side stub
-- in src/modules/planner/lib/pdfStorage.ts, which never persisted uploads.
-- Path convention: course-materials/<user_id>/<course_id>/<timestamp>_<filename>

create table if not exists course_materials (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  file_size integer not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists course_materials_course_id_idx
  on course_materials (course_id);

alter table course_materials enable row level security;

create policy "course_materials_select_own"
  on course_materials for select using (auth.uid() = user_id);

create policy "course_materials_insert_own"
  on course_materials for insert with check (auth.uid() = user_id);

create policy "course_materials_delete_own"
  on course_materials for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('course-materials', 'course-materials', false)
on conflict (id) do nothing;

create policy "course_materials_owner_read"
  on storage.objects for select
  using (bucket_id = 'course-materials' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "course_materials_owner_write"
  on storage.objects for insert
  with check (bucket_id = 'course-materials' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "course_materials_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'course-materials' and auth.uid()::text = (storage.foldername(name))[1]);
