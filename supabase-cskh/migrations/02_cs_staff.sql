-- ─────────────────────────────────────────────────────────────────────────────
-- cs_staff — nhân viên được phép vào app CSKH
--
-- Bảng này VỪA là danh sách CHO PHÉP (email ngoài @gwt.vn vẫn vào được nếu có
-- tên ở đây), VỪA là danh sách CẤM (hoat_dong = false thắng cả luật domain,
-- dùng để khoá người nghỉ việc ngay mà không cần chờ xoá tài khoản Google).
--
-- Luật đầy đủ: docs/specs/2026-07-28-dang-nhap-google-va-deploy-vercel.md mục 4
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.cs_staff (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  ho_ten     text,
  vai_tro    text not null default 'nhan_vien',
  hoat_dong  boolean not null default true,
  ghi_chu    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cs_staff_email_chu_thuong check (email = lower(email))
);

comment on table public.cs_staff is
  'Nhân viên được vào app CSKH. Vừa là allowlist vừa là blocklist; vai_tro chừa cho giai đoạn 2 (UI phân quyền), giai đoạn 1 chỉ ghi không đọc.';

drop trigger if exists trg_cs_staff_updated_at on public.cs_staff;
create trigger trg_cs_staff_updated_at
  before update on public.cs_staff
  for each row execute function public.set_updated_at();

-- RLS bật, KHÔNG policy nào → chỉ service_role đọc/ghi (giống các bảng CSKH khác)
alter table public.cs_staff enable row level security;

-- Nạp sẵn 2 tài khoản đang tồn tại (Authentication > Users, 2026-07-28)
insert into public.cs_staff (email, vai_tro, ghi_chu) values
  ('bella@gwt.vn', 'nhan_vien', 'Tài khoản đang dùng trước khi bật đăng nhập Google'),
  ('ai@gwt.vn',    'nhan_vien', 'Quản trị, nhận việc 2026-07-28')
on conflict (email) do nothing;
