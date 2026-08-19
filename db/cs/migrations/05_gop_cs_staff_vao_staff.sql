-- ─────────────────────────────────────────────────────────────────────────────
-- Gộp cs_staff VÀO staff — bỏ hai nguồn sự thật về cùng một con người.
--
-- Bối cảnh: hai bảng được dựng song song cùng ngày. `staff` (đợt 2 ticket) dùng
-- cho người phụ trách + lọc "việc của tôi"; `cs_staff` dùng cho rào đăng nhập.
-- Cả hai đều có email/vai_tro/hoat_dong và ĐÃ mâu thuẫn: ai@gwt.vn là 'admin'
-- bên staff nhưng 'nhan_vien' bên cs_staff.
--
-- Hậu quả nếu để nguyên: khoá một người trong `staff` mà họ vẫn đăng nhập được,
-- vì rào đăng nhập đọc bảng kia.
--
-- Giữ `staff` vì có dữ liệu thật, có tên người, vai trò đúng nghiệp vụ và đã
-- nối vào tính năng đang chạy. Rào đăng nhập trỏ sang đây.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.staff add column if not exists updated_at timestamptz not null default now();
alter table public.staff add column if not exists ghi_chu text;

-- Rào đăng nhập so sánh bằng chữ thường -> dữ liệu phải luôn là chữ thường,
-- không thì người có email viết hoa sẽ bị chặn oan.
update public.staff
   set email = lower(trim(email))
 where email is not null and email <> lower(trim(email));

alter table public.staff drop constraint if exists staff_email_chu_thuong;
alter table public.staff add constraint staff_email_chu_thuong
  check (email is null or email = lower(email));

drop trigger if exists trg_staff_updated_at on public.staff;
create trigger trg_staff_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

-- RLS: bật, không policy nào -> chỉ service_role đọc/ghi (như mọi bảng CSKH)
alter table public.staff enable row level security;

-- Chuyển những email CHỈ có bên cs_staff sang staff.
-- Hiện tại cả 2 dòng cs_staff đều đã có bên staff nên câu này không chuyển gì,
-- nhưng vẫn chạy để migration đúng với mọi trạng thái dữ liệu.
insert into public.staff (email, ten, vai_tro, hoat_dong, ghi_chu)
select c.email,
       split_part(c.email, '@', 1),   -- ten NOT NULL, tạm lấy phần trước @
       'cs',
       c.hoat_dong,
       c.ghi_chu
  from public.cs_staff c
 where c.email is not null
   and not exists (select 1 from public.staff s where s.email = c.email);

comment on table public.staff is
  'Nhan vien CSKH. Vua la danh sach cho phep dang nhap (rao vao cua), vua la danh sach nguoi phu trach ticket. vai_tro: admin | cs.';

-- CỐ Ý KHÔNG `drop table cs_staff` ở đây. Giữ làm bản lùi theo đúng thông lệ
-- repo (xem CHECKLIST, đợt di trú trước: "buffer read-only bảng cũ, KHÔNG xoá
-- ngay"). Xoá bằng migration riêng sau khi chạy ổn định.
comment on table public.cs_staff is
  'NGUNG DUNG 2026-07-28 - da gop vao public.staff. Giu lam ban lui, xoa sau khi chay on dinh.';
