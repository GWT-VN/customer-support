-- 24_backfill_bh_combo.sql
-- E2 — Backfill 35 bộ combo cũ (WH15A/WH30A): chuyển bảo hành từ MẸ xuống CON để
-- đồng nhất convention mới "BH ở từng thiết bị con" (chốt với user 2026-08-11).
--
-- Trước: mẹ (internal_code=combo) giữ 1 phiếu BH; con không có.
-- Sau:   mỗi CON có BH riêng (theo chính sách linh kiện của nó, dùng NGÀY BẮT ĐẦU
--        của phiếu BH mẹ); phiếu BH ở mẹ bị xoá → mẹ hiện badge "Bộ (đầu hệ)".
--
-- An toàn:
--   · Backup TOÀN BỘ bảng warranty trước khi đụng.
--   · CHỈ kích hoạt con CHƯA có BH (giữ nguyên 10 con đã có BH — tránh ghi đè ngày
--     đang đúng, có bộ ngày con lệch mẹ 5 ngày).
--   · activate_warranty idempotent (on conflict do update) + không raise khi thiếu
--     chính sách; ở đây 0 con thiếu chính sách nên đều tính ra hạn.

-- 1) BACKUP
create table if not exists public.warranty_bak_combo_backfill_20260811 as
  select * from public.warranty;

-- 2) Kích hoạt BH cho CON còn thiếu, dùng ngày bắt đầu của phiếu BH mẹ
do $$
declare r record;
begin
  for r in
    select c.serial as con_serial, w.start_date as me_start
    from public.installed_base me
    join public.warranty w on w.serial = me.serial
    join public.installed_base c on c.parent_serial = me.serial
    left join public.warranty cw on cw.serial = c.serial
    where me.internal_code in ('WH15A', 'WH30A')
      and me.serial in (select distinct parent_serial from public.installed_base where parent_serial is not null)
      and cw.serial is null
  loop
    perform public.activate_warranty(r.con_serial, r.me_start);
  end loop;
end $$;

-- 3) Xoá phiếu BH ở MẸ (đã backup) — BH giờ nằm ở con
delete from public.warranty
where serial in (
  select me.serial
  from public.installed_base me
  where me.internal_code in ('WH15A', 'WH30A')
    and me.serial in (select distinct parent_serial from public.installed_base where parent_serial is not null)
);
