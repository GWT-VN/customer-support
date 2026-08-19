-- 01 — Bù 3 view Phase 2 (nhóm lỗi) bị thiếu khi dựng project mới.
-- Phát hiện lúc cutover apps/web (2026-07-27): trang /nhom-loi lỗi
-- "Could not find the table 'public.v_ticket_chua_phan_nhom'".
-- 3 view này được tạo ở Masterdata SAU khi introspect DDL nguồn (00_init), nên chưa có.
-- Khác biệt duy nhất so với bản Masterdata: customers -> cs_customers (đổi tên khi di trú).
-- Thứ tự: v_ticket_issue (gốc) -> v_ticket_chua_phan_nhom + v_issue_report (phụ thuộc).

create or replace view public.v_ticket_issue as
 WITH base AS (
         SELECT t.ticket_code, t.state, t.ticket_type, t.description, t.created_at, t.serial, t.province,
            ib.internal_code,
            COALESCE(ci."Tên ngắn gọn (đề xuất)", ib.model_freetext) AS product_name,
            COALESCE(t.customer_id, ib.customer_id) AS customer_id,
            (COALESCE(t.description, ''::text) || ' '::text) || COALESCE(t.ticket_type, ''::text) AS van_ban,
            (((((COALESCE(ib.internal_code, ''::text) || ' '::text) || COALESCE(ci."Tên ngắn gọn (đề xuất)", ''::text)) || ' '::text) || COALESCE(ib.model_freetext, ''::text)) || ' '::text) || COALESCE(t.description, ''::text) AS van_ban_may
           FROM tickets t
             LEFT JOIN installed_base ib ON ib.serial = t.serial
             LEFT JOIN catalog_item ci ON ci."Mã nội bộ" = ib.internal_code
        ), khop AS (
         SELECT b_1.ticket_code, g_1.code AS group_code, g_1.muc_do
           FROM base b_1
             JOIN issue_group g_1 ON b_1.van_ban ~* g_1.mau_mo_ta AND (g_1.mau_may IS NULL OR b_1.van_ban_may ~* g_1.mau_may)
        ), auto_loi AS (
         SELECT khop.ticket_code, khop.group_code FROM khop WHERE khop.muc_do <> 'khong_loi'::text
        ), auto_dv AS (
         SELECT k_1.ticket_code, k_1.group_code
           FROM khop k_1
          WHERE k_1.muc_do = 'khong_loi'::text AND NOT (EXISTS ( SELECT 1 FROM auto_loi al WHERE al.ticket_code = k_1.ticket_code))
        ), auto AS (
         SELECT auto_loi.ticket_code, auto_loi.group_code FROM auto_loi
        UNION
         SELECT auto_dv.ticket_code, auto_dv.group_code FROM auto_dv
        ), ket_hop AS (
         SELECT a.ticket_code, a.group_code, 'rule'::text AS nguon
           FROM auto a
          WHERE NOT (EXISTS ( SELECT 1 FROM issue_override o WHERE o.ticket_code = a.ticket_code AND o.group_code = a.group_code AND o.gan = false))
        UNION
         SELECT o.ticket_code, o.group_code, 'người'::text AS nguon
           FROM issue_override o WHERE o.gan = true
        )
 SELECT k.ticket_code, k.group_code, k.nguon,
    g.ten AS nhom_ten, g.muc_do, g.bao_hang, g.thu_tu,
    b.state, b.ticket_type, b.description, b.created_at, b.province, b.serial,
    b.internal_code, b.product_name, b.customer_id,
    c.full_name AS customer_name, c.primary_phone
   FROM ket_hop k
     JOIN issue_group g ON g.code = k.group_code
     JOIN base b ON b.ticket_code = k.ticket_code
     LEFT JOIN cs_customers c ON c.id = b.customer_id;

create or replace view public.v_ticket_chua_phan_nhom as
 SELECT ticket_code, state, ticket_type, description, created_at, serial,
        CASE WHEN description IS NULL OR btrim(description) = ''::text
             THEN 'thiếu mô tả lỗi — không có gì để gom'::text
             ELSE 'mô tả không khớp nhóm nào — cân nhắc tạo nhóm mới hoặc gán tay'::text END AS ly_do
   FROM tickets t
  WHERE NOT (EXISTS ( SELECT 1 FROM v_ticket_issue vi WHERE vi.ticket_code = t.ticket_code));

create or replace view public.v_issue_report as
 SELECT g.code, g.ten, g.muc_do, g.bao_hang, g.mo_ta, g.thu_tu,
    count(vi.ticket_code) AS so_ticket,
    count(*) FILTER (WHERE vi.state = 'Open'::text) AS dang_mo,
    count(*) FILTER (WHERE vi.state = 'Done'::text) AS da_xong,
    count(*) FILTER (WHERE vi.state = 'Cancel'::text) AS da_huy,
    count(DISTINCT vi.customer_id) AS so_khach,
    count(DISTINCT vi.serial) AS so_may,
    count(DISTINCT vi.internal_code) AS so_model,
    string_agg(DISTINCT vi.internal_code, ', '::text ORDER BY vi.internal_code) AS cac_model,
    min(vi.created_at)::date AS som_nhat,
    max(vi.created_at)::date AS gan_nhat,
    count(*) FILTER (WHERE vi.created_at >= (CURRENT_DATE - 90)) AS trong_90_ngay
   FROM issue_group g
     LEFT JOIN v_ticket_issue vi ON vi.group_code = g.code
  GROUP BY g.code, g.ten, g.muc_do, g.bao_hang, g.mo_ta, g.thu_tu;
