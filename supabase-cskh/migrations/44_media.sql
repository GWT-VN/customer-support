-- Kho ảnh/video dùng chung (ticket + bảo trì). File nằm trên Google Drive
-- (Shared Drive), bảng này chỉ giữ metadata + con trỏ drive_file_id.
-- Xem docs/plans/2026-08-13-kho-anh-google-drive.md

create table if not exists public.media (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null check (entity_type in ('ticket', 'bao_tri')),
  entity_id     text not null,          -- ticket_code hoặc maintenance_visit.id
  drive_file_id text not null,
  filename      text,
  mime          text,
  size_bytes    bigint,
  uploaded_by   text,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz             -- soft delete; file Drive xoá kèm lúc set
);

create index if not exists media_entity_idx
  on public.media (entity_type, entity_id) where deleted_at is null;

-- App đọc/ghi bằng service_role sau requireStaff() như các bảng khác;
-- bật RLS không kèm policy = chặn anon/authenticated đụng thẳng.
alter table public.media enable row level security;
