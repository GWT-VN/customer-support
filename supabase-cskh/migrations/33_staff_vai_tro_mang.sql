-- ─────────────────────────────────────────────────────────────────────────────
-- staff.vai_tro: CHUỖI ĐƠN -> TẬP vai trò (text[]) để 1 người giữ NHIỀU role.
--
-- Bối cảnh (sếp chốt): cty nhỏ -> kiêm nhiệm. Cần {admin, cs_manager, cs,
-- sales_manager, sales} và 1 người có thể giữ nhiều role cùng lúc (vd chủ vừa
-- quản CS vừa quản Sales; NV vừa CS vừa Sales). Mô hình cũ 1-người-1-vai
-- (text 'admin'|'cs') không đáp ứng.
--
-- Bảng staff DÙNG CHUNG với Sales, nhưng Sales XÁC NHẬN chưa có code nào đọc
-- staff (dashboard gate bằng email @gwt.vn) -> CS tự chạy migration này theo
-- lịch của CS, không phải hẹn giờ deploy chung.
--
-- ⚠️ THỨ TỰ TRIỂN KHAI (app CS đang chạy production — ĐỪNG ĐẢO):
--   1. Deploy code CS đọc vai_tro dạng MẢNG TRƯỚC (code đã làm phòng thủ:
--      chuanHoaVaiTro() đọc được cả chuỗi cũ lẫn mảng mới).
--   2. Áp migration NÀY SAU khi deploy đã live.
-- Nếu áp migration trước khi deploy, code cũ so `vai_tro === 'admin'` trên
-- ['admin'] -> false -> admin mất quyền tức thì trên app đang chạy.
--
-- Trước migration (đã soi DB): vai_tro text NOT NULL default 'cs'::text, KHÔNG
-- có CHECK nào -> ALTER TYPE không bị chặn. Data: 4 cs + 2 admin.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Bỏ default cũ ('cs'::text) — không tương thích kiểu mới trước khi ALTER TYPE.
alter table public.staff alter column vai_tro drop default;

-- 2) text -> text[]. Giá trị cũ gói vào mảng 1 phần tử: admin->{admin}, cs->{cs}.
--    (guard null/'' cho chắc; hiện cột NOT NULL nên không có null.)
alter table public.staff
  alter column vai_tro type text[]
  using case
    when vai_tro is null or vai_tro = '' then '{}'::text[]
    else array[vai_tro]
  end;

-- 3) default MỚI: KHÔNG tự cấp role. Người @gwt.vn vào lần đầu vẫn hoat_dong=false
--    (chờ duyệt); admin gán role lúc kích hoạt ở /nhan-vien.
alter table public.staff alter column vai_tro set default '{}'::text[];

-- 4) Chặn role rác (canh ở DB vì là bảng dùng chung, không chỉ ở tầng app).
alter table public.staff drop constraint if exists chk_vai_tro;
alter table public.staff add constraint chk_vai_tro
  check (vai_tro <@ '{admin,cs_manager,cs,sales_manager,sales}'::text[]);

-- 5) is_admin(): 'vai_tro = admin' cũ sẽ LỖI KIỂU trên text[] -> đổi sang chứa
--    phần tử. is_admin/is_staff là SECURITY DEFINER (migration 15), Tầng 1 RLS
--    dựa vào nó; app hiện dùng service_role nên chưa gọi, nhưng phải đúng sẵn.
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
    where lower(s.email) = lower(nullif(auth.jwt() ->> 'email', ''))
      and s.hoat_dong and s.vai_tro @> array['admin']
  );
$$;
