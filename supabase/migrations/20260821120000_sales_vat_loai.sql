-- VAT theo mã nội bộ + tách KCT / KAD — CEO chốt 21/08/2026.
--
-- Vì sao cần `vat_loai` riêng: `vat_pct` là SỐ nên không chứa được chữ. Ba trạng thái
--   0%  = chịu thuế, thuế suất 0
--   KCT = KHÔNG CHỊU THUẾ  (muối — theo luật)
--   KAD = KHÔNG ÁP DỤNG    (bình gas sparkling / "bình gas đen")
-- cùng ra tiền thuế = 0 nhưng in hoá đơn và gom báo cáo là BA nhóm khác nhau.
-- Apps Script hiện gộp KCT với "Không áp dụng" làm một — CEO sẽ sửa riêng.
--
-- Nguồn: `catalog_item."Mức VAT"` bên Masterdata (qynpywysgltspmgnhhga):
--   8% -> 300 mã · trống -> 20 mã · "Không áp dụng" -> 5 mã · "KCT" -> 3 mã.
-- Mã trống lấy mặc định 8%, đúng như `defaultVatFor_` của Apps Script.
--
-- Bảng gương `catalog_item` bên Sales KHÔNG bị Apps Script ghi (nó chỉ ĐỌC masterdata
-- để dựng REF_MASP), nên giá trị điền ở đây không bị sync xoá.

alter table public.catalog_item add column if not exists vat_pct  numeric;
alter table public.catalog_item add column if not exists vat_loai text;

do $$ begin
  alter table public.catalog_item add constraint chk_catalog_vat_loai
    check (vat_loai is null or vat_loai in ('VAT','KCT','KAD'));
exception when duplicate_object then null; end $$;

update public.catalog_item set vat_loai = 'VAT', vat_pct = 0.08 where vat_loai is null;
update public.catalog_item set vat_loai = 'KCT', vat_pct = 0
  where "Mã nội bộ" in ('MUOIAD','MUOIDUC','MUOIRE');
update public.catalog_item set vat_loai = 'KAD', vat_pct = 0
  where "Mã nội bộ" in ('GASDEN','GASDEN-G','GASDEN-R','GASXANH','GASXANH-R');

comment on column public.catalog_item.vat_pct  is 'Thuế suất theo mã, dạng PHÂN SỐ (0.08 = 8%). Nguồn: catalog_item."Mức VAT" bên Masterdata.';
comment on column public.catalog_item.vat_loai is 'VAT = chịu thuế · KCT = không chịu thuế (muối) · KAD = không áp dụng (bình gas sparkling). Ba thứ KHÁC NHAU dù cùng ra tiền thuế 0.';

-- Dòng đơn: cùng bộ ba trạng thái.
alter table public.sales_order_items add column if not exists vat_loai text;
alter table public.sales_order_lines add column if not exists vat_loai text;

do $$ begin
  alter table public.sales_order_items add constraint chk_soi_vat_loai
    check (vat_loai is null or vat_loai in ('VAT','KCT','KAD'));
exception when duplicate_object then null; end $$;

-- Backfill dòng đơn CŨ từ bảng gương. 22 dòng `sales_order_lines` có vat_pct NULL chính
-- là 15 dòng bình gas + 5 dòng muối + 2 mã lẻ: Apps Script đẩy chuỗi 'Không VAT' vào cột
-- số nên thành NULL. Nay dựng lại đúng ý nghĩa.
update public.sales_order_lines l set vat_loai = c.vat_loai
  from public.catalog_item c where c."Mã nội bộ" = l.internal_code and l.vat_loai is null;
update public.sales_order_items i set vat_loai = c.vat_loai
  from public.catalog_item c where c."Mã nội bộ" = i.internal_code and i.vat_loai is null;
