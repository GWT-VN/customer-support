-- Sửa lỗi CHÍNH TÔI gây ra ở migration trước (CS bắt được, 21/08/2026).
--
-- `sales_vat_loai_bo_doan_cho_muc_chi_phi` trả VAT về null theo điều kiện
-- `"Trạng thái" = 'Không KD'`, vì tôi ngỡ 'Không KD' nghĩa là "mục chi phí kế toán".
-- SAI: điều kiện đó khớp 45 mã — 20 mã `cp.*` (đúng là mục chi phí) VÀ **25 MÃ HÀNG THẬT**
-- (LLK20, LLK35, PIN18V, FSD20-FILTER-SHELL, UPF10-GIATREO…). 'Không KD' nhiều khả năng
-- nghĩa là "hiện KHÔNG KINH DOANH" (ngừng bán), không phải "là khoản chi phí" —
-- hàng ngừng bán vẫn là hàng và vẫn có thuế suất.
--
-- Đã kiểm nguồn trước khi sửa: cả 25 mã đó đều mang "Mức VAT" = '8%' bên Masterdata.
-- Nên đây là KHÔI PHỤC giá trị thật, không phải đoán lần hai.
--
-- Điều kiện mới bám vào MÃ (`cp.%`) — dấu hiệu rõ ràng của mục chi phí — chứ không bám
-- vào "Trạng thái", vốn nói về tình trạng kinh doanh chứ không nói bản chất mục.
--
-- Bài học ghi lại: đừng suy nghĩa của một cột từ TÊN của nó. `"Trạng thái" = 'Không KD'`
-- nghe như "không kinh doanh = không phải hàng", thực tế là "hàng ngừng bán".
-- Kiểm bằng cách ĐẾM xem điều kiện quét trúng bao nhiêu dòng TRƯỚC khi chạy update.
update public.catalog_item
   set vat_loai = 'VAT', vat_pct = 0.08
 where vat_loai is null
   and "Mã nội bộ" not like 'cp.%';
