-- Xoá hẳn một nhân sự — CHỈ cho ca "mời nhầm email, người đó chưa làm gì".
--
-- Vì sao phải có hàm đếm chứ không xoá thẳng: staff.id đang bị 12 bảng khác trỏ
-- vào (tickets, work.task, work.comment…), trong đó 5 khoá ngoại là ON DELETE
-- CASCADE. `delete from staff` là âm thầm cuốn theo phân công việc mà không ai
-- biết. Nên tầng app phải ĐẾM TRƯỚC, còn dòng nào thì từ chối và bảo admin KHOÁ.
--
-- Hàm đọc thẳng pg_constraint thay vì liệt kê 12 bảng bằng tay: module sau này
-- thêm bảng trỏ vào staff thì nút xoá tự biết, không cần ai nhớ sửa lại chỗ này.
-- Đây chính là loại lỗ hổng đã dính ở /doanh-so — rào viết tay thì quên là hở.

create or replace function public.nen_tang_dem_tham_chieu_staff(p_staff_id uuid)
returns table (bang text, cot text, so_dong bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  n bigint;
begin
  for r in
    select c.conrelid::regclass::text as tbl, a.attname::text as col
    from pg_constraint c
    join unnest(c.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f'
      and c.confrelid = 'public.staff'::regclass
    order by 1, 2
  loop
    execute format('select count(*) from %s where %I = $1', r.tbl, r.col)
      into n using p_staff_id;
    if n > 0 then
      bang := r.tbl;
      cot := r.col;
      so_dong := n;
      return next;
    end if;
  end loop;
end;
$$;

revoke all on function public.nen_tang_dem_tham_chieu_staff(uuid) from public;
revoke all on function public.nen_tang_dem_tham_chieu_staff(uuid) from anon, authenticated;

comment on function public.nen_tang_dem_tham_chieu_staff(uuid) is
  'Đếm chỗ còn trỏ vào staff.id, đọc từ pg_constraint. Dùng cho nút xoá nhân sự ở /nhan-vien.';


-- Lấy id tài khoản đăng nhập theo email — để xoá nốt tài khoản khi xoá nhân sự.
--
-- Không có hàm này thì email mời nhầm vẫn còn đường vào: dòng staff mất đi nhưng
-- auth.users còn nguyên, người @gwt.vn lại tự tạo được hồ sơ chờ duyệt lần sau.
-- Cùng lý do với nen_tang_co_tai_khoan: PostgREST chỉ expose schema `public`.

create or replace function public.nen_tang_id_tai_khoan(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

revoke all on function public.nen_tang_id_tai_khoan(text) from public;
revoke all on function public.nen_tang_id_tai_khoan(text) from anon, authenticated;

comment on function public.nen_tang_id_tai_khoan(text) is
  'id tài khoản đăng nhập theo email, hoặc NULL. Dùng khi xoá nhân sự ở /nhan-vien.';


-- Quyền thứ 51: xoá nhân sự.
--
-- Tách khỏi he_thong.nhan_su.sua có chủ đích — sửa vai trò thì sai còn sửa lại
-- được, xoá thì không. Mặc định chỉ hai vai trò hệ thống có; các vai trò khác
-- muốn có thì CEO tick tay ở /nhan-vien/phan-quyen.
insert into public.quyen_vai_tro (vai_tro, ma_quyen) values
  ('admin', 'he_thong.nhan_su.xoa'),
  ('quan_tri_ht', 'he_thong.nhan_su.xoa')
on conflict do nothing;
