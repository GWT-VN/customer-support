/**
 * Danh sách tỉnh/thành để chọn địa chỉ.
 *
 * CEO chốt 21/08/2026: **KHÔNG đổi sang bộ 34 tỉnh — cho phép điền CẢ tên cũ LẪN tên mới.**
 * Không chuẩn hoá lúc ghi, không backfill dữ liệu cũ.
 *
 * Nền: bộ 63 tên CŨ, vì phần lớn dữ liệu khách đang ghi theo tên cũ. Đối chiếu với bảng
 * 30 cặp sáp nhập (nguồn: `PROVINCE_PAIRS` trong Apps Script của Sales, `Code.gs:170`) thì
 * **33/34 tên mới đã nằm sẵn trong danh sách này** — sáp nhập phần lớn giữ lại tên một tỉnh
 * cũ. Nên "cho phép cả hai bộ" chỉ cần THÊM ĐÚNG MỘT tên: `Huế`.
 *
 * Hai cái bẫy đã đo, đừng chép bảng của Sales vào đây:
 *  · Bảng cặp ghi `TP. Hồ Chí Minh`, danh sách này ghi `Hồ Chí Minh` — CÙNG một tỉnh, hai
 *    cách viết. Thêm vào là danh mục có hai dòng HCM, nhân viên chọn hú hoạ mỗi lúc một kiểu.
 *  · Bảng cặp ghi `Thừa Thiên Huế`, danh sách này ghi `Thừa Thiên - Huế` (có gạch nối).
 *    Vì lệch dấu gạch nên đối chiếu máy móc sẽ tưởng nó là tỉnh "sống sót" — thực ra nó là
 *    tên CŨ của `Huế`. Giữ cả hai: tên cũ để đọc dữ liệu cũ, tên mới để nhập mới.
 *
 * `ChonTinh.tsx` vẫn cho giữ giá trị ngoài danh mục (nhãn "giá trị lạ") nên hồ sơ mang cách
 * viết khác (vd `HCM` — đang có 1 ở `cs_customers`, 226 dòng bên Sales) không bị mất khi sửa.
 */
export const TINH_VN: string[] = [
  'An Giang', 'Bà Rịa - Vũng Tàu', 'Bạc Liêu', 'Bắc Giang', 'Bắc Kạn', 'Bắc Ninh',
  'Bến Tre', 'Bình Dương', 'Bình Định', 'Bình Phước', 'Bình Thuận', 'Cà Mau',
  'Cao Bằng', 'Cần Thơ', 'Đà Nẵng', 'Đắk Lắk', 'Đắk Nông', 'Điện Biên', 'Đồng Nai',
  'Đồng Tháp', 'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Nội', 'Hà Tĩnh', 'Hải Dương',
  'Hải Phòng', 'Hậu Giang', 'Hòa Bình', 'Hưng Yên', 'Hồ Chí Minh',
  'Huế',   // tên MỚI của 'Thừa Thiên - Huế' — tên mới DUY NHẤT chưa có ở bộ 63 cũ
  'Khánh Hòa',
  'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lạng Sơn', 'Lào Cai', 'Lâm Đồng', 'Long An',
  'Nam Định', 'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên', 'Quảng Bình',
  'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sóc Trăng', 'Sơn La', 'Tây Ninh',
  'Thái Bình', 'Thái Nguyên', 'Thanh Hóa', 'Thừa Thiên - Huế', 'Tiền Giang', 'Trà Vinh',
  'Tuyên Quang', 'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái',
]
