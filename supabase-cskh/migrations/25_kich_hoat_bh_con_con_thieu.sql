-- 25_kich_hoat_bh_con_con_thieu.sql
-- Sau backfill (migration 24) còn 6 con của 2 bộ WH15A (GTE15A2025000{1,2},
-- khách Chị Ngọt / Anh Khoa, lắp 2025-01-10) CHƯA từng có BH ở đâu — mẹ cũng
-- không có nên không có gì để chuyển. User chốt "kích hoạt hết" (2026-08-11).
--
-- Kích hoạt BH cho MỌI con combo còn thiếu, dùng NGÀY LẮP của mẹ làm ngày bắt đầu.
-- (full 1 năm có thể đã hết, core 10 năm còn hiệu lực — activate_warranty tự tính.)

do $$
declare r record;
begin
  for r in
    select c.serial as con_serial, me.install_date as ngay
    from public.installed_base me
    join public.installed_base c on c.parent_serial = me.serial
    left join public.warranty cw on cw.serial = c.serial
    where me.internal_code in ('WH15A', 'WH30A')
      and me.serial in (select distinct parent_serial from public.installed_base where parent_serial is not null)
      and cw.serial is null
      and me.install_date is not null
  loop
    perform public.activate_warranty(r.con_serial, r.ngay);
  end loop;
end $$;
