-- ══════════════════════════════════════════════════════════════════════════
-- 19 — yeu_cau_thay_doi: đề xuất SỬA/XOÁ cần admin duyệt (khách, SĐT phụ, lịch thay lõi)
-- CS gửi đề xuất -> chờ; admin duyệt thì mới áp. Admin tự sửa/xoá thì áp ngay (không qua bảng này).
-- Xoá KHÁCH = ẩn mềm (cs_customers.trang_thai='da_xoa'); SĐT phụ + lịch thay lõi = xoá cứng.
-- App ghi bằng service_role (RLS bật, 0 policy).
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.yeu_cau_thay_doi (
  id          uuid primary key default gen_random_uuid(),
  doi_tuong   text not null check (doi_tuong in ('cs_customers','filter_replacement','customer_contacts')),
  ban_ghi_id  text not null,
  loai        text not null check (loai in ('sua','xoa')),
  payload     jsonb,                 -- giá trị mới cho 'sua'
  ly_do       text,                  -- lý do (nhất là xoá)
  nguoi_gui   text,                  -- email NV đề xuất
  trang_thai  text not null default 'cho_duyet' check (trang_thai in ('cho_duyet','da_duyet','tu_choi')),
  ly_do_tu_choi text,
  duyet_boi   text,
  duyet_luc   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists yctd_cho_idx on public.yeu_cau_thay_doi (trang_thai, created_at desc);
alter table public.yeu_cau_thay_doi enable row level security;
