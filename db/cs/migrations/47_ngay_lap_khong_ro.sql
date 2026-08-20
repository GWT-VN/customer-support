-- 47 — ghi nhận ca "khách không nhớ ngày lắp".
--
-- Ca thật (CEO báo 19/08/2026): nhiều khách chỉ liên hệ khi máy hỏng, hỏi ngày lắp
-- thì người nhớ người không. CS vẫn buộc phải điền một ngày để tính bảo hành, nên
-- ngày đoán và ngày thật nằm lẫn nhau trong cùng một cột — nhìn vào không phân biệt
-- được, mà hạn bảo hành lại suy ra từ đúng cột đó.
--
-- Vì sao KHÔNG để install_date = null cho ca "không rõ": toàn bộ bảo hành, lịch bảo
-- trì và lịch thay lõi đều tính từ install_date. Cho null là phải rải xử lý null
-- khắp nơi và khách mất luôn bảo hành. Giữ nguyên: CS vẫn điền ngày ĐOÁN TỐT NHẤT,
-- nhưng đánh dấu rõ đó là đoán.
--
--   ngay_lap_do_chac : 'chinh_xac' (mặc định, giữ nguyên hành vi cũ)
--                      'uoc_luong' (khách áng chừng: "khoảng giữa 2024")
--                      'khong_ro'  (khách không nhớ gì, CS lấy ngày mua/ngày tạo)
--   ghi_chu          : chỗ note tự do cho đúng những ca này — "khách chỉ nhớ mùa hè
--                      năm ngoái", "lấy theo ngày hoá đơn đại lý"…
--
-- Mặc định 'chinh_xac' nên 2.418 máy cũ không đổi nghĩa: trước giờ mọi ngày đều được
-- coi là chính xác, giữ nguyên như vậy.

alter table installed_base
  add column if not exists ngay_lap_do_chac text not null default 'chinh_xac',
  add column if not exists ghi_chu text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'installed_base_ngay_lap_do_chac_check'
  ) then
    alter table installed_base
      add constraint installed_base_ngay_lap_do_chac_check
      check (ngay_lap_do_chac in ('chinh_xac', 'uoc_luong', 'khong_ro'));
  end if;
end $$;

comment on column installed_base.ngay_lap_do_chac is
  'Ngày lắp đáng tin tới đâu: chinh_xac | uoc_luong | khong_ro. Hạn bảo hành vẫn tính từ install_date, cột này chỉ để cảnh báo người đọc.';
comment on column installed_base.ghi_chu is
  'Ghi chú tự do về máy — chủ yếu cho ca không rõ ngày lắp.';

-- View phải trả thêm 2 cột, nếu không app không đọc được.
-- Chỉ THÊM cột vào cuối nên `create or replace view` chạy được, không phải drop.
create or replace view v_installed_base as
 SELECT ib.serial,
    ib.internal_code,
    COALESCE(ci."Tên ngắn gọn (đề xuất)", ib.model_freetext) AS product_name,
    ci."Danh mục cấp 1" AS category_l1,
    ci."Danh mục cấp 2" AS category_l2,
    ib.source_product_code,
    ib.customer_id,
    c.full_name AS customer_name,
    c.primary_phone,
    c.needs_phone,
    ib.parent_serial,
    ib.install_date,
    ib.install_address,
    ib.status,
    COALESCE(
        CASE
            WHEN w.id IS NOT NULL THEN w.activated
            ELSE wp.activated
        END, false) AS warranty_activated,
        CASE
            WHEN w.id IS NOT NULL THEN w.start_date
            ELSE wp.start_date
        END AS warranty_start,
        CASE
            WHEN w.id IS NOT NULL THEN w.full_end
            ELSE wp.full_end
        END AS warranty_full_end,
        CASE
            WHEN w.id IS NOT NULL THEN w.core_end
            ELSE wp.core_end
        END AS warranty_core_end,
        CASE
            WHEN
            CASE
                WHEN w.id IS NOT NULL THEN w.full_end
                ELSE wp.full_end
            END IS NULL THEN NULL::boolean
            ELSE
            CASE
                WHEN w.id IS NOT NULL THEN w.full_end
                ELSE wp.full_end
            END >= CURRENT_DATE
        END AS con_han_may,
        CASE
            WHEN
            CASE
                WHEN w.id IS NOT NULL THEN w.core_end
                ELSE wp.core_end
            END IS NULL THEN NULL::boolean
            ELSE
            CASE
                WHEN w.id IS NOT NULL THEN w.core_end
                ELSE wp.core_end
            END >= CURRENT_DATE
        END AS con_han_loi,
    pw.internal_code IS NOT NULL AS co_chinh_sach_bh,
    w.id IS NULL AND wp.id IS NOT NULL AS bh_theo_me,
    c.ten_kd,
    c.dia_chi_kd,
    ib.ngay_lap_do_chac,
    ib.ghi_chu
   FROM installed_base ib
     LEFT JOIN catalog_item ci ON ci."Mã nội bộ" = ib.internal_code
     LEFT JOIN cs_customers c ON c.id = ib.customer_id
     LEFT JOIN warranty w ON w.serial = ib.serial
     LEFT JOIN warranty wp ON wp.serial = ib.parent_serial
     LEFT JOIN product_warranty pw ON pw.internal_code = ib.internal_code;
