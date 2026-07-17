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

## Phase 3 — Lịch lõi / bảo trì / muối / Water Profile ⏳ MỘT PHẦN

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
