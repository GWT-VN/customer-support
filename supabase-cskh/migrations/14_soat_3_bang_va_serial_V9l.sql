-- 14 — Áp bản soát tay 3 bảng + dọn sạch serial gõ nhầm V9l (2026-07-30)
--
-- Nguồn: `GWT_CAN_DUYET_2026-07-29-v2.xlsx` — user duyệt từng sheet, ghi chú ở
-- cột cuối là chỉ dẫn cuối cùng.
--
-- Phần dữ liệu (địa chỉ/tên/tỉnh/SĐT/ticket) chạy bằng script REST
-- `ap_duyet.py` theo từng dòng file duyệt; file này giữ phần SCHEMA + phần sửa
-- serial hàng loạt để tái lập được.

begin;

-- ── 1. Cho FK cascade khi UPDATE serial ────────────────────────────────────
-- Sửa 1 serial gõ nhầm trước đây phải sửa tay ở 4 bảng và rất dễ bỏ sót.
alter table public.warranty drop constraint warranty_serial_fkey;
alter table public.warranty add constraint warranty_serial_fkey
  foreign key (serial) references public.installed_base(serial) on update cascade on delete cascade;

alter table public.maintenance_plan drop constraint maintenance_plan_serial_fkey;
alter table public.maintenance_plan add constraint maintenance_plan_serial_fkey
  foreign key (serial) references public.installed_base(serial) on update cascade;

alter table public.installed_base drop constraint installed_base_parent_serial_fkey;
alter table public.installed_base add constraint installed_base_parent_serial_fkey
  foreign key (parent_serial) references public.installed_base(serial) on update cascade;

-- ── 2. Giữ vết địa chỉ trước sáp nhập phường/tỉnh 2025 ─────────────────────
alter table public.cs_customers
  add column if not exists address_truoc_sap_nhap  text,
  add column if not exists province_truoc_sap_nhap text;

comment on column public.cs_customers.address_truoc_sap_nhap is
  'Địa chỉ theo đơn vị hành chính TRƯỚC sáp nhập 2025. Cột address là bản HIỆN HÀNH.';
comment on column public.cs_customers.province_truoc_sap_nhap is
  'Tỉnh/TP TRƯỚC sáp nhập 2025. Cột province là bản HIỆN HÀNH.';

-- ── 3. Serial gõ nhầm V9l (chữ L thường) -> V9I (chữ I hoa) ────────────────
-- Kho serial nhà máy CHỈ có bản I hoa -> bản l thường luôn là lỗi gõ.
-- Chỉ đổi khi bản đúng CÓ trong kho và CHƯA tồn tại ở installed_base (tránh
-- đụng khoá). 15/18 dòng đổi được; 3 dòng còn lại là bản ghi trùng/dị dạng,
-- phải gộp tay vì xoá dữ liệu khách cần admin duyệt.
with can_sua as (
  select ib.serial cu, replace(ib.serial, 'V9l', 'V9I') moi
  from public.installed_base ib
  where ib.serial ~ 'V9l'
    and exists (select 1 from public.serial_registry r where r.serial = replace(ib.serial, 'V9l', 'V9I'))
    and not exists (select 1 from public.installed_base i2 where i2.serial = replace(ib.serial, 'V9l', 'V9I'))
)
update public.installed_base ib set serial = c.moi
from can_sua c where ib.serial = c.cu;   -- warranty/tickets/filter_replacement tự cascade

-- source_serial là text tự do (không FK) nên phải sửa riêng.
update public.tickets set source_serial = replace(source_serial, 'V9l', 'V9I')
where source_serial ~ 'V9l'
  and exists (select 1 from public.serial_registry r where r.serial = replace(tickets.source_serial, 'V9l', 'V9I'));

commit;
