-- 37 — Đợt 3a: lịch kỹ thuật (gán việc cho kỹ thuật, 1 chuyến đi nhiều việc)
--
-- ky_thuat: cả NHÂN VIÊN lẫn CỘNG TÁC VIÊN (cột email để nối đăng nhập sau — 3b).
-- lich_ky_thuat: 1 CHUYẾN ĐI (1 kỹ thuật, 1 ngày, 1 khách/địa chỉ).
-- lich_ky_thuat_viec: các VIỆC trong chuyến (nhiều việc/chuyến) — loại: lắp máy · bảo trì ·
--   ticket · thay lõi · khảo sát · khác (khác BẮT BUỘC ghi mô tả — enforced ở app).
-- RLS bật + 0 policy (service_role qua dataClient), như các bảng CSKH khác.

create table if not exists ky_thuat (
  id         uuid primary key default gen_random_uuid(),
  ten        text not null,
  sdt        text,
  vung       text,
  email      text,
  la_ctv     boolean not null default false,  -- true = cộng tác viên
  hoat_dong  boolean not null default true,
  created_at timestamptz not null default now()
);
alter table ky_thuat enable row level security;

create table if not exists lich_ky_thuat (
  id          uuid primary key default gen_random_uuid(),
  ky_thuat_id uuid references ky_thuat(id) on delete set null,
  ngay        date not null,
  customer_id uuid,
  dia_chi     text,
  ghi_chu     text,
  trang_thai  text not null default 'hen' check (trang_thai in ('hen', 'xong', 'huy')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table lich_ky_thuat enable row level security;
create index if not exists idx_lich_kt_ngay on lich_ky_thuat (ngay);
create index if not exists idx_lich_kt_ky_thuat on lich_ky_thuat (ky_thuat_id);

create table if not exists lich_ky_thuat_viec (
  id         uuid primary key default gen_random_uuid(),
  lich_id    uuid references lich_ky_thuat(id) on delete cascade,
  loai_viec  text not null check (loai_viec in ('lap_may', 'bao_tri', 'ticket', 'thay_loi', 'khao_sat', 'khac')),
  mo_ta      text,
  ref        text,   -- visit_id / ticket_code / serial tuỳ loại
  created_at timestamptz not null default now()
);
alter table lich_ky_thuat_viec enable row level security;
create index if not exists idx_lich_kt_viec_lich on lich_ky_thuat_viec (lich_id);
