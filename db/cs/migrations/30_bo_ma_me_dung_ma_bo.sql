-- 30_bo_ma_me_dung_ma_bo.sql  ⚠️ DRAFT — CHƯA ÁP (chờ user bổ sung data con rồi mới chạy)
-- Chuyển combo sang mô hình MỚI (user chốt 2026-08-11, phương án 1):
--   · BỎ dòng mẹ ảo. Mã bộ WH… thành cột installed_base.ma_bo trên TỪNG con.
--   · Backup CẢ mã cũ (ma_bo_cu = GTE…) LẪN mã mới (ma_bo = WH+YYYYMM+STT).
--   · Backup 38 dòng mẹ ra bảng riêng trước khi xoá.
-- Kèm: RPC lap_bo_combo phải sửa ĐỒNG THỜI (không tạo mẹ, set ma_bo cho con) — file
-- migration riêng khi áp thật.

-- 1) Cột mới
alter table public.installed_base add column if not exists ma_bo text;      -- mã bộ hiện hành (WH…)
alter table public.installed_base add column if not exists ma_bo_cu text;    -- mã bộ cũ (GTE…) backup

-- 2) Backup toàn bộ dòng mẹ (38) trước khi xoá
create table if not exists public.installed_base_bo_me_bak as
  select * from public.installed_base
  where serial in (select distinct parent_serial from public.installed_base where parent_serial is not null);

-- 3) Sinh mã mới + gán cho CON (ma_bo=mới, ma_bo_cu=mã mẹ cũ)
with me as (
  select ib.serial as ma_cu,
         ib.internal_code || to_char(ib.install_date, 'YYYYMM')
           || lpad(row_number() over (partition by ib.internal_code, to_char(ib.install_date, 'YYYYMM')
                                      order by ib.install_date, ib.serial)::text, 3, '0') as ma_moi
  from public.installed_base ib
  where ib.serial in (select serial from public.installed_base_bo_me_bak)
    and ib.install_date is not null
)
update public.installed_base c
set ma_bo = me.ma_moi, ma_bo_cu = me.ma_cu, updated_at = now()
from me
where c.parent_serial = me.ma_cu;

-- 4) 2 ticket đang trỏ mã mẹ -> trỏ về NULL serial (giữ source_serial), vì mẹ sắp bị xoá
--    (FK tickets.serial ON DELETE NO ACTION nên phải gỡ trước).
update public.tickets
set serial = null
where serial in (select serial from public.installed_base_bo_me_bak);

-- 5) Gỡ parent_serial của con (mẹ sắp xoá; FK parent_serial ON DELETE NO ACTION)
update public.installed_base
set parent_serial = null
where parent_serial in (select serial from public.installed_base_bo_me_bak);

-- 6) Xoá 38 dòng mẹ ảo
delete from public.installed_base
where serial in (select serial from public.installed_base_bo_me_bak);
