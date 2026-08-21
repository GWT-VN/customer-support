-- Sửa chỗ ĐOÁN trong migration trước (CS bắt được, 21/08/2026).
--
-- `sales_vat_loai` mặc định MỌI mã chưa xếp loại thành VAT 8%. Đo lại thì 20 mã có
-- "Mức VAT" trống bên Masterdata đều là `cp.*` — DANH MỤC CHI PHÍ kế toán,
-- "Trạng thái" = 'Không KD' (không kinh doanh): cp.qc, cp.thuekho, cp.bank,
-- cp.tiepkhach, cp.vanphong… Không mã nào là hàng bán.
--
-- Gán 8% cho chúng không gây sai hoá đơn (chúng không nằm trên đơn bán), nhưng vẫn là
-- bịa ra một thuế suất cho thứ không có thuế suất. Trả về NULL: thà hiện ra là CHƯA
-- BIẾT còn hơn đoán thành 8%.
--
-- Dùng điều kiện theo "Trạng thái" chứ KHÔNG liệt kê 20 mã cứng, để mã chi phí thêm
-- sau này cũng tự đúng.
update public.catalog_item
   set vat_pct = null, vat_loai = null
 where coalesce("Trạng thái",'') = 'Không KD';
