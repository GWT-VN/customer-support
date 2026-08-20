-- ============================================================================
-- work_03b_nguoi_nhan_va_cron.sql — hai chỗ work_03 còn thiếu (2026-08-19)
--
-- 1. NGƯỜI NHẬN CHỌN ĐƯỢC THEO TỪNG LUẬT. Bản đầu lấy `cs_manager` có id nhỏ
--    nhất — võ đoán. Chạy thật thì cả 20 việc đổ hết vào một người.
-- 2. LỊCH CHẠY pg_cron (câu schedule bị rơi khi áp work_03).
--
-- Thân hàm work.sinh_viec_tu_erp() bản CUỐI nằm ở work_05 (nó còn thêm bước
-- đồng bộ team_member). Dựng lại từ đầu thì chạy 03 -> 03b -> 04b -> 05 theo
-- thứ tự là ra đúng production.
-- ============================================================================

alter table work.auto_rule add column if not exists nguoi_nhan uuid references public.staff(id);

comment on column work.auto_rule.nguoi_nhan is
  'Ai nhận việc do luật này sinh ra. NULL = rơi về work.nguoi_nhan_mac_dinh() (cs_manager id nhỏ nhất).';

create or replace function public.work_doi_nguoi_nhan(p_email text, p_key text, p_staff_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v_quan_ly boolean;
begin
  v_me := work.staff_theo_email(p_email);
  if v_me is null then raise exception 'Nhân sự không hợp lệ'; end if;
  select vai_tro && array['admin','cs_manager','sales_manager']::text[]
    into v_quan_ly from public.staff where id = v_me;
  if not coalesce(v_quan_ly, false) then
    raise exception 'Chỉ cấp quản lý mới đổi được người nhận';
  end if;
  if p_staff_id is not null and not exists
     (select 1 from public.staff where id = p_staff_id and hoat_dong) then
    raise exception 'Người nhận không hoạt động';
  end if;
  update work.auto_rule set nguoi_nhan = p_staff_id where key = p_key;
  if not found then raise exception 'Không có luật: %', p_key; end if;
end $$;

revoke execute on function public.work_doi_nguoi_nhan(text,text,uuid) from public;
grant  execute on function public.work_doi_nguoi_nhan(text,text,uuid) to service_role;

-- Lịch chạy mỗi 15 phút. Bọc trong DO để file chạy được cả trên DB LOCAL
-- (thường không cài pg_cron) lẫn production.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('work-tu-sinh-viec')
      where exists (select 1 from cron.job where jobname = 'work-tu-sinh-viec');
    perform cron.schedule('work-tu-sinh-viec', '*/15 * * * *',
                          'select work.sinh_viec_tu_erp()');
  else
    raise notice 'Không có pg_cron (DB local?) — bỏ qua lịch chạy. Gọi tay: select work.sinh_viec_tu_erp();';
  end if;
end $$;

notify pgrst, 'reload schema';
