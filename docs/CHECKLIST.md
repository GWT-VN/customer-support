# CHECKLIST tiến độ — GWT Customer Care

> **File theo dõi tiến độ DUY NHẤT của dự án.** Xong việc gì tick `[x]` kèm ngày.
> Lộ trình gốc: [specs/2026-07-12-gwt-customer-care-design.md](specs/2026-07-12-gwt-customer-care-design.md) · Plan chi tiết Phase 0: [plans/2026-07-12-gwt-customer-care-phase0.md](plans/2026-07-12-gwt-customer-care-phase0.md)

## Phase 0 — Nền + kích hoạt bảo hành ✅ XONG

- [x] Schema CSKH: customers / customer_contacts / installed_base / warranty + RLS, anon chặn (2026-07-15)
- [x] Bảng `product_warranty` — số năm BH từ master data, 18/58 máy có chính sách (2026-07-15)
- [x] RPC `activate_warranty` + view `v_installed_base` (2026-07-15)
- [x] Di trú Odoo: 293 khách · 379 máy · 374 kích hoạt BH (2026-07-15)
- [x] App CSKH (Next.js `app-cskh/`): tra máy, kích hoạt BH, quản lý khách đa-SĐT (2026-07-15)

## Phase 0.5 — Enrich dữ liệu khách ✅ XONG (2026-07-15)

- [x] SĐT chính 284/293 (từ export Odoo mới) · địa chỉ 277/293 (từ Contact res.partner)
- [x] Kết luận SĐT phụ KHÔNG nhập tự động được (4/11 là SĐT khách khác, 7/11 khách không có trong DB, vài số là kéo-fill Excel giả) — chứng minh ở `migrate/contacts.py::audit_lien_he`
- [x] Soát chất lượng dữ liệu khách → Excel có NOTE + ưu tiên (`migrate/quality.py`, 2026-07-15)

## Phase 1 — Ticket ✅ XONG (2026-07-15)

- [x] Bảng `tickets` + view `v_tickets`, nạp 83/83 ticket Odoo
- [x] App: /ticket (tra cứu + lọc) · /ticket/[code] (đổi trạng thái + ghi chú) · nhúng lịch sử vào trang máy/khách

## Serial mẹ/con — bộ lọc tổng ✅ XONG (2026-07-16)

- [x] Nhập 86 serial con (WH15A/WH30A) kế thừa khách + ngày lắp từ mẹ (`migrate/nap_serial_con.py`) → tổng 465 máy
- [x] View: con thừa hưởng BH của mẹ (`bh_theo_me`) — migration `20260716022000` GWT-Masterdata
- [x] Khử đếm trùng lõi mẹ/con trong `v_core_forecast` (verify 0 dòng trùng)
- [x] Gắn lại 10 ticket mồ côi trỏ serial con (mồ côi 37 → 27)

## Soát dữ liệu 3 bảng (Excel) 🔄 ĐANG CHỜ USER

- [x] Xuất `GWT_soat_3_bang_2026-07-16.xlsx` — 4 sheet: KHÁCH HÀNG 293 (156 cần sửa) · SERIAL-MÁY 465 (23 cần sửa) · TICKET 83 (44 cần sửa) · MÁY THIẾU LÕI 2 model (2026-07-16)
- [ ] **User sửa file Excel** (điền các cột "→") rồi gửi lại
- [x] Script nạp ngược Excel đã sửa: `migrate/nap_excel_sua.py` — CHỈ đẩy data hợp lệ, sai thì từ chối kèm lý do; dry-run mặc định, `--ghi` mới ghi; lõi mới chỉ sinh SQL đề xuất (2026-07-16)
- [x] Điền lõi `GTUN-8600VNHP` — dùng như USH10: LX-NF700-002G (24-48 th) + LX-PCFB-003-G (12-24 th), migration `20260716030500` (2026-07-16)
- [ ] Điền lõi cho model còn lại: `GCUN-02VNT01` (1 máy) → sheet MÁY THIẾU LÕI trong Excel
- [ ] Quyết định 5 serial mẹ chưa kích hoạt BH (Odoo cũng ghi False dù có ngày) — cột "→ Kích hoạt BH?" trong Excel
- [ ] 14 ticket trỏ serial tồn kho không mẹ + 13 ticket không ghi serial — xử lý tay (1 ca nghi gõ nhầm: GWT-260004 `...V9l...` → `...V9I...`?)

## Kết quả khảo sát tài liệu mới (2026-07-16) — ĐÃ KIỂM CHỨNG BẰNG DỮ LIỆU

### ✅ Chốt: cách tính hạn thay lõi HIỆN TẠI LÀ ĐÚNG — không sửa
User chốt 2026-07-16: *"tính từ ngày lắp máy, còn nếu có lịch thay lõi thì ưu tiên theo lịch thay lõi"*
→ Đúng y hệt `v_core_forecast` đang làm: `coalesce(lần thay gần nhất, install_date)`. **Giữ nguyên.**
User cũng chốt: **lõi POE thay RIÊNG, hẹn riêng với khách** (không gộp vào buổi bảo trì 3 tháng) → `v_core_forecast` áp cho POE là đúng.

### ❌ `260624_Ticket lỗi.xlsx` KHÔNG vá được serial (khác kỳ vọng ban đầu)
Đối chiếu bằng độ giống mô tả: 3 ca khớp 100% (`Phượng Anh`→GWT-260028, `Chị Trang Gamuda`→GWT-260032, `Kim Anh`→GWT-260034) — **cả 3 đều ĐÃ có serial rồi**. Không ca nào vá được.
→ **Giá trị thật: 11 ticket MỚI chưa có trong hệ thống**, cần nhập:
- Lọc tổng (6): `Tạ Phú Vương` GTEC-30A02 lỗi main + rơ le · `(không tên)` GTEF-30A02 · `Anh Tuấn Tita` màn hình mờ sọc trắng · `Anh Cường` + `Chị Linh` **màn hình đốm đen** · `Nguyen Hai` CTS20 chảy nước đáy
- 🆕 **Bình gas (5): NHÓM LỖI MỚI chưa có trong 13 nhóm** — CTS20NG hết gas bất thường sau lắp (`Chị Maily` 2 tuần hết gas · `Chị Thanh`/`Chị Thuỳ Dương`/`Chị Hương`/`Chị Nhật` báo đỏ sau 1 ngày). GWT đang **tặng bình gas mới** để xử lý → tốn chi phí, cần báo hãng.
- 5 serial trong file KHÔNG có trong `installed_base` (máy lắp sau kỳ export Odoo?)

### ❌ Pancake CRM gần như KHÔNG map được khách thiếu dữ liệu
- **Địa chỉ: 0/15** — khách thiếu địa chỉ không nằm trong tập trùng
- **SĐT: 2/10** (`Lê Hường`, `Anh Minh`) — mà khớp bằng TÊN, tên phổ biến → **rủi ro nhầm người, không tự áp**
- Lý do: chỉ **103/283 (36%)** khách DB có SĐT trùng Pancake. Pancake là CRM lead Facebook (703 "chưa mua"), DB là khách đã mua từ Odoo — hai tập lệch nhau.

### 🚨 PHÁT HIỆN LỚN từ Pancake — cần user xác minh
**216 khách Pancake gắn tag "Đã mua" nhưng KHÔNG có trong DB CSKH**, trong đó **55 khách mua POE (lọc tổng)**.
Ví dụ POE: `Cô Hồng 0907999270` · `Anh Cảnh Hưng Yên 0913366968` · `Tra Phan 0909155859` · `Hiep Dang 0939777779`
⚠️ **Chưa kết luận được** — con số này CÓ THỂ sai vì: tag "Đã mua" do NV gắn tay · Pancake có bản ghi trùng (cùng SĐT, tên khác: `Vu Bui`/`Bùi Hoàng Vũ` = 0948878811) · `purchased_amount`=0 toàn bộ · có tên là tên page chat (`Lọc Nước GE x Chị Thanh`).
→ **Cần user trả lời: khách mua qua Facebook/Shopee/đại lý có được nhập vào Odoo không?** Nếu có mà thiếu → hệ thống đang sót khách POE giá trị cao.

## Phase 3 — Lịch lõi / bảo trì / muối / Water Profile ⏳ MỘT PHẦN

> 📥 **Đã nhận tài liệu 2026-07-16** (đã khảo sát, chưa code). Nguồn:
> | File | Nội dung | Dùng được gì |
> |---|---|---|
> | `Lịch bảo trì - Lịch kĩ thuật/GWT-Lịch bảo trì - Theo dõi quản lý.xlsx` | **Export Asana thật, 469 task** — Task ID · Name `Khách_Bộ_TP_BTn` · Section (`Mr. Dino Vũ Estella - 15A`) · Due Date · Completed At | **NGUỒN CHÍNH cho lịch bảo trì** → không cần API Asana |
> | `.../GWT - Lịch bảo trì - Asana.xlsx` | Thống kê tay: Tổng hợp 74 · Bảo trì 35 · **Bảo trì-Tặng 9** · 9 tab lịch theo tháng (có SĐT/địa chỉ/máy/checklist/water profile) | Gói bảo trì đã mua/tặng + lịch từng tháng |
> | `.../GWT - Lịch làm việc kỹ thuật HN.xlsx` + `HCM.xlsx` | Template **calendar Excel** 25 sheet (Year 2025/2026 + từng tháng) — dạng lịch nhìn, không phải bảng | ⚠️ khó parse, cần bàn cách |
> | `GWT - Chi phí dịch vụ.xlsx` | Bảng giá: Lắp POU 500k / POE 5tr · **Bảo trì POU 300k / POE chung cư 660k, nhà đất 1.1tr** · Thay lõi 300k · Đổ muối 250k · Bình gas 200k | Giá cho gói bảo trì |
> | `Danh sách khách hàng từ Pancake CRM.xlsx` | **1.570 lead × 74 cột** — Name/Phone/Address/province/district/Status/`ngay_thang_lap_dat`/`bt3`/`bt4`/`bao_tri`/`purchased_amount` | **Map khách thiếu SĐT/địa chỉ** |
> | `260624_Ticket lỗi.xlsx` | CS tự theo dõi: Ticket lọc tổng 11 · bình gas 6 — **CÓ Serial ID** | **Vá serial cho ticket thiếu** + xác nhận nhóm POE-MAIN-DO |
> | `Các khách lọc tổng POE/` | **100 thư mục hợp đồng** (2025 + 2026), có hợp đồng/báo giá/chi phí | Thông tin bộ đã bán + khách |
>
> **🐛 LỖI DỮ LIỆU ĐÃ XÁC MINH — file `GWT - Lịch bảo trì - Asana.xlsx`, cột `SỐ LẦN BẢO TRÌ`:**
> Excel **tự đổi `"3/4"` → ngày `03/04/2026`**. 35/70 dòng bị hỏng kiểu này.
> Bằng chứng: 35 dòng còn nguyên text đều bắt đầu bằng `0/` (`0/4`×23, `0/2`×7, `0/8`×3, `0/12`, `0/10 năm`) — vì **không có ngày 0** nên Excel không đổi được; mọi giá trị `n/m` với n≥1 đều thành ngày.
> ✅ **Khôi phục được 100%**: `date(2026, m, d)` → `"d/m"` (đã xong d lần / tổng m lần). Mẫu số 2,4,8,10,12 khớp đúng các gói.
> → **Cần user sửa file gốc**: định dạng cột thành **Text** trước khi nhập, không thì lần sau lại hỏng.
>
> **📊 Đã phân tích 467 task Asana (2026-07-16) — dữ liệu tự trả lời:**
> - **Chu kỳ bảo trì thật = 3 tháng/lần** (283/368 khoảng cách = 77%)
> - **Gói phổ biến = 4 lần** (49/81 khách) → 4 lần × 3 tháng = **1 năm**. Gói 8 lần (10 khách) = 2 năm · 12 lần (5 khách) = 3 năm · 2 lần (7 khách)
> - 81 section = 1 khách + 1 bộ máy · 178 đã xong / 289 chưa · 257 việc đã lên lịch sẵn tới tương lai
> - ⚠️ **Quy ước tên KHÔNG nhất quán**: 160/467 task lệch mẫu — `_BT4` vs `- BT5` vs `BT 4` vs không có BT (`Ms. Trang Bella - Nội bộ`) → parse phải linh hoạt
>
> **🚨 19 LỊCH BẢO TRÌ QUÁ HẠN CHƯA LÀM** (tính tới 16/07/2026) — cũ nhất quá hạn ~18 tháng:
> `Mrs.Linh - 65 Chế Lan Viên` (hạn 09/01/2025) · `Mrs. Mai - Trung Phụng - 24home` (18/03/2025) · `Anh Tới_30A_Hạ Long` (BT1 hạn 28/12/2025 chưa làm, BT2 28/03/2026 cũng quá hạn) · `Chị Trang Suki_15A ECO_Đồng Nai_BT1` (09/04/2026)
>
> **Lịch kỹ thuật HN/HCM — user chốt 2026-07-16: chỉ ĐỌC THAM KHẢO, không nạp.**
> Sẽ build app mới quản lý phân bổ lịch kỹ thuật, **lấy việc từ 3 nguồn: lịch bảo trì · đơn lắp máy · ticket lỗi**.
> Rút ra từ file hiện tại: đơn vị lịch = **buổi (Sáng/Chiều)** không phải giờ · mỗi việc cần *loại việc + khách + máy + địa chỉ + SĐT* · **chưa ghi tên thợ** (mỗi TP 1 lịch chung) · HN/HCM có thợ hãng, tỉnh khác dùng **freelancer** · cần đánh dấu ngày nghỉ lễ.
>
> **📜 Đã quét 217 file .docx trong `Các khách lọc tổng POE/` (2026-07-16) — hợp đồng ĐỌC ĐƯỢC, là nguồn gốc đáng tin:**
> - **81 hợp đồng** có điều khoản bảo trì. Mẫu chuẩn: `"01 năm dịch vụ bảo trì định kỳ 5 sao (3 tháng/lần)"` + `"Bảo trì bảo dưỡng 4 lần/năm"` → **gói 4 lần** (50 HĐ + 14 HĐ = 64/81)
> - ✅ Kiểm chứng khớp: `54. Chị Trang Bùi - Park City` HĐ ghi **"03 năm … (3 tháng/lần)"** = 3×4 = **12 lần** — đúng y `0/12` trong file thống kê
> - ✅ **Tìm ra HĐ 10 năm** = `"10 năm dịch vụ bảo trì định kỳ 5 sao (3 tháng/lần)"` = **40 lần**, khớp user chốt. **NHƯNG hợp đồng đứng tên `86. Sixdo`, KHÔNG phải "Anh Huy Cân"** như file thống kê ghi → cần user xác nhận có phải cùng một khách.
> - 🆕 **Mẫu hợp đồng MỚI** (`88. Chị Liên`, WH30A **ECO`): `"02 năm dịch vụ bảo trì định kỳ 5 sao (6 tháng/lần)"` → chu kỳ **6 tháng**, khác hẳn mẫu cũ 3 tháng
> - ⚠️ **Hợp đồng MÂU THUẪN NỘI BỘ**: cùng 1 file vừa ghi `"Bảo trì bảo dưỡng 4 lần/năm"` vừa ghi `"(6 tháng/lần)"` (= 2 lần/năm). Điều khoản bảo hành và chính sách bán hàng đá nhau → máy không tự quyết được.
> - ❌ **BẾ TẮC: 7/8 khách gói `/2` KHÔNG có file hợp đồng trong folder** (Hoài Ngân, Nhung Ecopark, My Zeit, Trang Suki, Hiền Metropolis, Hà Lan Ciputra, Trang Gamuda — chỉ có biên bản/báo giá, không có HĐMB) → không check được như user chỉ dẫn.
> - ❌ Giả thuyết "ECO → gói 2" **SAI**: `Chị Linh Thảo Điền` bộ 15A ECO nhưng gói **4**. Cũng không có quy luật theo thời gian (gói 4 có khách bắt đầu 2026-08, muộn hơn gói 2 tháng 2026-01).
>
### ✅ ĐÃ CHỐT — công thức gói bảo trì (user xác nhận 2026-07-16)
> **Tổng lần bảo trì = số năm × (12 ÷ chu kỳ tháng)** — lấy từ dòng hợp đồng
> `"NN năm dịch vụ bảo trì định kỳ 5 sao (M tháng/lần)"`. Kiểm chứng đúng 5/5 ca đã biết đáp án.
> - `1 năm × 3 th` → **4 lần** (49 khách — mẫu chuẩn) · `1 năm × 6 th` → **2 lần** (3 khách — gói `/2`)
> - `2 năm × 3 th` → **8** (6 khách) · `2 năm × 6 th` → **4** (Chị Liên) · `3 năm × 3 th` → **12** (Chị Trang Bùi)
> - `10 năm × 3 th` → **40** = `86. Sixdo` = **Anh Huy Cận** (user xác nhận) → file thống kê phải sửa `0/10 năm` → **`0/40`**
> ⚠️ KHÔNG dùng dòng `"Bảo trì bảo dưỡng 4 lần/năm"` để tính — đó là template bảo hành copy cứng, mâu thuẫn với chu kỳ thật.

- [x] **Quét 100 hợp đồng POE** (`migrate/quet_hop_dong.py`) → Excel `GWT_goi_bao_tri_tu_hop_dong_2026-07-16.xlsx` (2026-07-16)
  - **63/98 khách đọc ra gói** · 35 không rõ (thiếu HĐMB, chỉ có biên bản/báo giá) · 1 hợp đồng kẹt định dạng `.doc`/`.pdf`
  - User chốt thứ tự tra: **hợp đồng → biên bản xác nhận → báo giá**
- [x] **Ca lệch Zeit đã giải thích** (user 2026-07-16): `Anh Minh chị My - Zeit` ban đầu mua **15A → 4 lần**, sau **đổi sang 15A ECO → còn 2 lần**. ⇒ **File thống kê ĐÚNG (2)**, hợp đồng trong folder là **bản ban đầu trước khi đổi máy**.
  > ⚠️ **Bài học cho schema**: hợp đồng có thể bị **thay thế khi khách đổi sản phẩm** → gói bảo trì phải theo **hợp đồng HIỆN HÀNH**, không phải file HĐ cũ nhất trong thư mục. Cần cột `ghi_chu`/`nguon` để truy vết ca đổi máy.
- [ ] **32 khách chưa rõ gói → user điền tay** (sheet `THIẾU GÓI - ĐIỀN TAY` trong Excel): 29 "không thấy điều khoản" · 2 "chỉ có số năm" · 1 "chỉ có chu kỳ". Đa số thư mục **không có hợp đồng mua bán** (chỉ Quotation/PXK/ĐNTT/Biên bản giao hàng), hoặc hợp đồng cũ 2024 **chưa có điều khoản dịch vụ bảo trì** (chỉ có điều khoản bảo hành).
- [ ] 1 hợp đồng kẹt `.doc`/`.pdf` (sheet `KẸT ĐỊNH DẠNG`) — mở ra lưu lại thành `.docx` là đọc được

> **🐛 3 BUG của script đã bắt được khi tự kiểm chứng** (nếu không sẽ đưa bảng SAI cho user):
> 1. **Regex nuốt số thứ tự dòng**: `"1 ⇥ 03 năm dịch vụ bảo trì"` → bắt `1` thay vì `03` → Trang Bùi ra 4 thay vì 12. Phần đệm `[^)\n]{0,10}` quá tham lam.
> 2. **Chữ `đ` không bỏ dấu được bằng NFD** (U+0111 không decompose) → `"hợp đồng"` → `"hop ong"` → mọi ưu tiên tìm file hợp đồng đều trượt, script đọc nhầm biên bản.
> 3. **Khớp tên quá lỏng** (chỉ cần 2 từ chung) → `"Anh Hiếu Park City"` khớp nhầm `"Chị Trang Bùi Park City"`.
> → Trước khi sửa: báo **15 ca lệch**. Sau khi sửa: **1 ca**. 14 ca kia là bug, không phải data sai.

- [x] `v_machine_filter` giải mã product_filter (376/379 máy tra được lõi) + `filter_replacement` + `v_core_forecast` (2026-07-15)
- [x] App: /loi (tab sắp đến hạn / quá hạn có cảnh báo) + nút "Đã thay hôm nay" + nhúng vào trang máy (2026-07-15)
- [ ] `salt_schedule` + `maintenance_plan/visit` (dữ liệu POE từ Excel "Theo Dõi" sheet Bảo trì / Thay mua muối)
- [ ] `water_profile` (độ cứng, clo dư, TDS, pH — trước/sau lọc) + render báo cáo gửi khách
- [ ] Reminder worker Zalo ZNS (cron quét lịch đến hạn → nhắn notify_contact)
- [ ] Mở rộng RPC `activate_warranty` → `activate_and_seed` (kích hoạt BH + sinh lịch lõi/muối/bảo trì)
- [ ] Vận hành: nhân viên ghi log thay lõi để làm sạch ~267 dòng "quá hạn do chưa có log"

## Phase 2 — Báo cáo sếp + nhóm lỗi ⏳ ĐANG LÀM

- [x] Bảng `issue_group` (13 nhóm, luật regex ở DB → ticket mới tự vào nhóm) + `issue_override` (người sửa tay) — migration `20260716040000` (2026-07-16)
- [x] View `v_ticket_issue` (n-n) · `v_issue_report` (báo cáo) · `v_ticket_chua_phan_nhom` — gom **73/83 ticket**
- [x] Fix bug: nhóm "không lỗi" là phần bù, không thì `ticket_type` "Yêu cầu bảo trì" nuốt cả ticket lỗi thật (7 ca nhiễu) — migration `20260716041500`
- [x] Thêm nhóm `BAN-MANHINH` (màn hình máy để bàn ≠ main POE) + DV nhận "thắc mắc" — migration `20260716043000`
- [x] App `/nhom-loi` (báo cáo + lọc "báo hãng") · `/nhom-loi/[code]` (soi từng ticket + model dính) · nhúng nhóm vào trang ticket (2026-07-16)
- [ ] **Bổ sung mô tả cho 9 ticket trống** (Odoo để trống → không gom mù được) + gắn máy cho GWT-250033
- [ ] Duyệt lại 13 nhóm + mức độ (`muc_do`, `bao_hang`) — hiện do tôi suy từ dữ liệu, cần nghiệp vụ xác nhận
- [x] **Xuất báo cáo nhóm lỗi** (`migrate/bao_cao_nhom_loi.py`) — 3 file: bản NỘI BỘ (có khách) · bản GỬI HÃNG (**ẩn danh khách**, verify 0 tên/0 SĐT lọt) · bản TÓM TẮT .md dán WhatsApp được (2026-07-16)
- [x] Thêm chỉ số **tỷ lệ lỗi theo model** (ticket lỗi / máy đã lắp) — nêu rõ là cận dưới vì 27 ticket chưa gắn serial
- [ ] Leadership report worker → tự động gửi WhatsApp (cần token; hiện gửi tay bằng file TÓM TẮT)
- [ ] Đọc folder "Báo cáo CEO" để ghép vào báo cáo định kỳ

### 🚨 Phát hiện cần xử lý ngay (từ gom nhóm 2026-07-16)

- [ ] **RỦI RO AN TOÀN — 6 ticket máy để bàn quá nhiệt**: GWT-260004 "máy tự động bốc khói khi không lấy nước", GWT-260011 "lỗi E3, E1, đun nóng liên tục" + 4 ca E3/E7. **5/6 chưa gắn serial** → không biết model nào lỗi, báo hãng sẽ thiếu bằng chứng. 3 ticket còn Open.
- [ ] **POE main màn hình — 11 ticket / 9 khách / 8 máy** (GTEF-15A01, GTEF-30A01, GTEC-30A01, WH15A), đa số phải thay main → nghi lỗi lô hàng, đáng báo hãng
- [ ] **CTD50 bình 2L/lỗi E4 — 8 ticket, cả 8 trong 90 ngày qua** (xu hướng tăng), 1 ca xác định "tắc van một chiều"

## Phase 4 — Knowledge base ❌ CHƯA BẮT ĐẦU

- [ ] `kb_articles` + nạp từ ticket Done + knowledge agent

## Phase 5 — Cutover ❌ CHƯA BẮT ĐẦU

- [ ] Chạy song song ổn định → gỡ Odoo

## Nợ kỹ thuật / việc lặt vặt

- [x] Dọn 2 cảnh báo Next 16 khi `npm run dev`: ghim `turbopack.root` (next.config.ts) + đổi `middleware.ts` → `proxy.ts` (hàm `middleware` → `proxy`) (2026-07-16)
- [x] Hợp thức hoá snapshot `schema/current_schema.sql` + `docs/schema-description.md`: bổ sung 4 bảng thiếu (tickets, filter_replacement, issue_group, issue_override) + mô tả 6 view CSKH — verify cột khớp DB live 4/4, commit `41cf454` GWT-Masterdata (2026-07-16)
- [ ] ⚠️ Preview server không chạy được trong Claude Code: `npm EPERM uv_cwd` vì repo nằm trong iCloud Drive → không bấm được UI để verify (đã thử 3 cách cấu hình). Cách khắc phục bền: chuyển repo ra ngoài iCloud (vd `~/code/customer-support`). App vẫn chạy bình thường bằng Terminal `npm run dev`.
- [ ] Sửa tay 16 khách thiếu địa chỉ + 11 khách thiếu/lỗi SĐT qua app /khach (không có nguồn tự động)
- [ ] App: cân nhắc hiện badge "BH theo bộ (mẹ)" ở trang máy/ticket (view đã có cột `bh_theo_me`)
- [ ] DB role least-privilege cho lớp vận hành (MVP đang dùng service_role)
