-- 40 — Nghỉ phép kỹ thuật (để tránh gán trùng ngày nghỉ). 1 dòng = 1 KT nghỉ 1 ngày.

create table if not exists ky_thuat_nghi (
  id          uuid primary key default gen_random_uuid(),
  ky_thuat_id uuid references ky_thuat(id) on delete cascade,
  ngay        date not null,
  ly_do       text,
  created_at  timestamptz not null default now(),
  unique (ky_thuat_id, ngay)
);
alter table ky_thuat_nghi enable row level security;
create index if not exists idx_kt_nghi_ngay on ky_thuat_nghi (ngay);
