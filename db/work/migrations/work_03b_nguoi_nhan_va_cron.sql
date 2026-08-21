-- ============================================================================
-- work_03b_nguoi_nhan_va_cron.sql — hai chỗ work_03 còn thiếu (2026-08-19)
--
-- 1. NGƯỜI NHẬN CHỌN ĐƯỢC THEO TỪNG LUẬT.
--    Bản đầu lấy `cs_manager` có id nhỏ nhất — võ đoán. Chạy thật thì cả 20 việc
--    đổ hết vào một người (Thu Kho). Thêm cột `nguoi_nhan` để quản lý chỉ định
--    riêng cho từng luật; để trống mới rơi về mặc định cũ.
-- 2. LỊCH CHẠY. Câu `cron.schedule` bị rơi khi áp work_03 — bù ở đây.
--
-- Nội dung SQL đúng bằng migration đã áp cùng tên trên production.
-- Xem chi tiết luật + lý do chọn quét-định-kỳ thay trigger ở work_03.
-- ============================================================================

alter table work.auto_rule add column if not exists nguoi_nhan uuid references public.staff(id);

comment on column work.auto_rule.nguoi_nhan is
  'Ai nhận việc do luật này sinh ra. NULL = rơi về work.nguoi_nhan_mac_dinh() (cs_manager id nhỏ nhất).';

-- work.sinh_viec_tu_erp() — bản đầy đủ, chỉ khác work_03 ở dòng chọn v_nguoi:
--   v_nguoi := coalesce(r.nguoi_nhan, work.nguoi_nhan_mac_dinh());
-- (đặt TRONG vòng lặp từng luật, không còn tính một lần ngoài vòng)

-- RPC mới: public.work_doi_nguoi_nhan(p_email, p_key, p_staff_id) — chỉ quản lý.
-- public.work_luat_tu_sinh trả thêm: nguoi_nhan, nguoi_nhan_ten, nhan_su[].

-- Lịch: cron.schedule('work-tu-sinh-viec', '*/15 * * * *', 'select work.sinh_viec_tu_erp()')
--   15 phút đủ nhanh cho luật "ticket quá 4 giờ"; quét rỗng chỉ là 3 câu EXISTS trên index.

-- ĐÃ ÁP PRODUCTION 19/08/2026. Kiểm chứng: chạy lần 1 sinh 20 việc
-- (13 bảo hành + 4 bảo trì + 3 ticket), chạy lần 2 sinh 0 → chống trùng đúng.
