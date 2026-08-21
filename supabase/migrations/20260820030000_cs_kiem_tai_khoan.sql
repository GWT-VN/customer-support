-- Hỏi "người này đã có tài khoản đăng nhập chưa?".
--
-- Vì sao cần: bảng staff và auth.users là HAI thứ khác nhau. Admin thêm một người
-- vào staff không tạo ra tài khoản đăng nhập — tài khoản chỉ sinh ra khi họ đăng
-- nhập Google lần đầu, hoặc admin tạo tay trên Supabase.
--
-- Không có hàm này thì nút "gửi lại mật khẩu" NÓI DỐI: resetPasswordForEmail cố ý
-- trả về thành công cả khi email không tồn tại (chống dò email), nên admin bấm
-- thấy "đã gửi" mà người kia chẳng nhận được gì và không ai biết vì sao.
--
-- PostgREST chỉ expose schema `public` nên app không query thẳng auth.users được;
-- đây là đường hợp lệ duy nhất. SECURITY DEFINER + thu hồi quyền của anon/authenticated
-- ⇒ chỉ service_role (đã qua gác cổng tầng app) gọi được.

create or replace function public.nen_tang_co_tai_khoan(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users where lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.nen_tang_co_tai_khoan(text) from public;
revoke all on function public.nen_tang_co_tai_khoan(text) from anon, authenticated;

comment on function public.nen_tang_co_tai_khoan(text) is
  'Người này đã có tài khoản đăng nhập chưa. Dùng cho nút gửi lại mật khẩu ở /nhan-vien.';
