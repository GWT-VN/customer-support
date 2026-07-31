-- ══════════════════════════════════════════════════════════════════════════
-- 21 — yeu_cau_export: xuất danh sách CÓ PII (SĐT/địa chỉ) cần admin duyệt (Đợt A)
-- Bản KHÔNG PII: CS xuất thẳng. Bản CÓ PII: admin xuất thẳng; CS -> tạo yêu cầu
-- chờ, admin duyệt xong CS mới tải (tái sinh CSV từ dữ liệu hiện tại, đánh dấu da_tai).
-- App ghi bằng service_role (RLS bật, 0 policy).
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.yeu_cau_export (
  id          uuid primary key default gen_random_uuid(),
  bang        text not null default 'cs_customers',
  tieu_chi    jsonb,                 -- bộ lọc, vd {"q":"..."}
  co_pii      boolean not null default true,
  nguoi_gui   text,
  trang_thai  text not null default 'cho_duyet'
              check (trang_thai in ('cho_duyet','da_duyet','tu_choi','da_tai')),
  duyet_boi   text,
  duyet_luc   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists yc_export_cho_idx on public.yeu_cau_export (trang_thai, created_at desc);
create index if not exists yc_export_nguoi_idx on public.yeu_cau_export (nguoi_gui, trang_thai);
alter table public.yeu_cau_export enable row level security;
