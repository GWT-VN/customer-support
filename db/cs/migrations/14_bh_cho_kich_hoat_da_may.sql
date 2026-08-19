-- ══════════════════════════════════════════════════════════════════════════
-- 14 — Sửa v_bh_cho_kich_hoat: đơn bán mua NHIỀU máy không biến mất sớm
-- Trước: NOT EXISTS(installed_base cùng khách+mã) → lắp 1/2 máy là cả dòng biến mất.
-- Nay: gộp theo (khách × mã), so_luong = tổng đã mua − đã lắp = "CÒN THIẾU N máy";
--      chỉ ẩn khi đã lắp đủ. Đánh đổi (theo ghi chú): mỗi dòng là 1 cặp khách×mã,
--      mất chi tiết theo từng mã đơn (ma_don lấy 1 đơn đại diện).
-- Branch 1 (da_lap_chua_kich_hoat) giữ nguyên. Giữ security_invoker=true (có PII).
-- ══════════════════════════════════════════════════════════════════════════

create or replace view public.v_bh_cho_kich_hoat
with (security_invoker = true) as
 SELECT 'da_lap_chua_kich_hoat'::text AS nguon,
    ib.serial,
    ib.internal_code AS ma_noi_bo,
    sr.ten_noi_bo,
    k.id AS customer_id,
    k.full_name AS ten_khach,
    k.primary_phone AS sdt_khach,
    k.address AS dia_chi,
    ib.install_date AS ngay_lap,
    NULL::date AS ngay_dat_hang,
    NULL::text AS ma_don,
    1 AS so_luong,
    ib.created_at AS tao_luc
   FROM installed_base ib
     LEFT JOIN warranty w ON w.serial = ib.serial
     LEFT JOIN serial_registry sr ON sr.serial = ib.serial
     LEFT JOIN cs_customers k ON k.id = ib.customer_id
  WHERE w.activated IS NOT TRUE
UNION ALL
 SELECT 'don_sales_chua_gan_may'::text AS nguon,
    NULL::text AS serial,
    cp.internal_code AS ma_noi_bo,
    max(cp.product_name) AS ten_noi_bo,
    k.id AS customer_id,
    COALESCE(k.full_name, c.name) AS ten_khach,
    COALESCE(k.primary_phone, c.phone_chuan) AS sdt_khach,
    COALESCE(k.address, c.address) AS dia_chi,
    NULL::date AS ngay_lap,
    max(cp.order_date) AS ngay_dat_hang,
    max(cp.order_code) AS ma_don,
    (sum(cp.quantity)::integer - (
        SELECT count(*) FROM installed_base ib
         WHERE ib.customer_id = k.id AND ib.internal_code = cp.internal_code
    ))::integer AS so_luong,
    max(cp.synced_at) AS tao_luc
   FROM customer_purchases cp
     JOIN customers c ON c.customer_code = cp.customer_code
     LEFT JOIN cs_customers k ON k.primary_phone = c.phone_chuan
  WHERE cp.category_l1 = 'Machines'::text
  GROUP BY cp.internal_code, c.id, k.id
  HAVING sum(cp.quantity)::integer > (
        SELECT count(*) FROM installed_base ib
         WHERE ib.customer_id = k.id AND ib.internal_code = cp.internal_code
  );
