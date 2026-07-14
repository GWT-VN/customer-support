# GWT Customer Care — Thiết kế hệ thống

> Spec nền cho hệ thống quản lý chăm sóc khách hàng của GWT (máy lọc nước POU/POE).
> Ngày: 2026-07-12 · Trạng thái: đã brainstorm, chờ user duyệt trước khi viết plan.

## 1. Mục tiêu & bối cảnh

GWT bán và lắp máy lọc nước POU (điểm dùng) và POE (lọc tổng cả nhà), cần một hệ thống
quản lý toàn vòng đời chăm sóc khách hàng: kích hoạt bảo hành theo serial, ghi nhận và xử
lý ticket lỗi, nhắc thay lõi/đổ muối/bảo trì, báo cáo Water Profile, và báo cáo lãnh đạo.

Hiện có **3 nguồn dữ liệu chồng lấn**, gây rủi ro lệch số liệu:

- **Supabase `GWT-Masterdata`** (project `qynpywysgltspmgnhhga`, Tokyo) — nguồn sự thật sản
  phẩm: `products` (khóa `code`), `product_filters` (máy↔lõi + chu kỳ thay), `product_bundles`
  (BOM combo POE), số năm bảo hành. Mọi tool GWT đã đọc từ đây; RLS đã bật đủ.
- **Odoo (freelancer)** — module tùy biến: 1.594 serial, kích hoạt bảo hành theo serial
  (activated/expired date, `parent_serial` cho combo POE), 83 ticket (type/state/note). Là
  silo thứ 2, tự nhân bản products/serials, tách rời stack Supabase.
- **Excel "Theo Dõi Bảo Hành_Bảo Trì_Lắp đặt"** — vận hành thực tế: checklist lắp, lịch bảo
  trì POE (Lần 1–4), lịch muối, máy TQ (cụm Anh Tuấn Tita), xuất/nhập lõi. Thủ công, khó
  theo dõi, không tự động hoá được.

**Quyết định nền (đã chốt với user):**

| Trục | Quyết định |
|---|---|
| Nguồn sự thật | **Supabase-native** — mở rộng `GWT-Masterdata` thêm domain CSKH; Supabase là SoT duy nhất |
| Lớp vận hành | **Low-code** (Retool/Appsmith) đọc thẳng Supabase cho nhân viên CSKH |
| Kênh nhắc khách | **Zalo ZNS** (chuẩn giao dịch tại VN) |
| Kênh báo cáo lãnh đạo | **WhatsApp** (đổi kênh được) |
| Odoo | **Chạy song song**; hệ mới là chính, import định kỳ từ Odoo tới khi cutover |
| Tích hợp module | Sales module & Technician module **tích hợp qua bảng Supabase**, không API riêng |

## 2. Kiến trúc tổng thể

```
   Module ĐỘC LẬP (code riêng, đẩy dữ liệu lên Supabase):
     Sales module ──ghi──▶ customers, installed_base, warranty, + seed lịch
     Technician-scheduling module ──đọc lịch bảo trì / ghi kết quả + water_profile──▶

   ┌──────────────── SUPABASE = 1 NGUỒN SỰ THẬT ─────────────────┐
   │  Masterdata (đã có): products · product_filters · bundles    │
   │  Domain CSKH (mới):  customers · customer_contacts ·         │
   │    installed_base · warranty · tickets · ticket_issue_groups │
   │    filter_schedule · salt_schedule · maintenance_plan/visit  │
   │    water_profile · kb_articles                               │
   └──┬───────────┬────────────┬──────────────┬──────────────────┘
      │ ops        │ cron quét   │ đọc           │ đọc
      ▼            ▼            ▼              ▼
  Low-code app  Reminder      Knowledge      Leadership report
  (NV CSKH)     worker→Zalo   agent (RAG)    worker→WhatsApp
```

**Nguyên tắc:** mọi module giao tiếp qua bảng Supabase, không gọi thẳng nhau. Sales và
Technician chỉ đọc/ghi bảng — không cần hợp đồng API giữa các module.

## 3. Data model — domain CSKH (thêm vào GWT-Masterdata)

Tuân thủ quy ước repo: khóa sản phẩm = `code`; **bảng mới bật RLS ngay trong cùng migration
tạo bảng**; view mới `security_invoker = true`; mọi ghi qua `service_role`; anon không đọc
domain CSKH (dữ liệu khách hàng riêng tư).

### 3.1 Khách hàng & liên hệ (đa SĐT)

Một khách có nhiều đơn *và* nhiều số điện thoại (chủ nhà, người nhà, giúp việc, quản gia).
Vì vậy tách khách khỏi số liên hệ.

**`customers`**

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| id | uuid (PK) | |
| full_name | text | Tên khách |
| primary_phone | text | SĐT chính (tiện tra cứu; KHÔNG unique — trùng/gộp thủ công) |
| source | text | Shopee / Direct / Website / 24Home / Anh Tuấn Tita… |
| partner_ref | text | Mã đối tác nếu qua kênh partner |
| province / address | text | |
| notes | text | |
| created_at / updated_at | timestamptz | trigger tự động |

**`customer_contacts`** — nhiều SĐT trên một khách

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| id | uuid (PK) | |
| customer_id | uuid (FK→customers) | |
| phone | text | SĐT (index để match đơn mới ↔ khách có sẵn) |
| contact_name | text | |
| role | text | owner / family / helper / manager / other |
| is_primary | bool | |
| zalo_ok | bool | Có nhận Zalo ZNS không |

> **Dedup:** match đơn mới theo `customer_contacts.phone`; trùng thì gộp thủ công trong ops app.

### 3.2 Máy đã lắp & bảo hành

**`installed_base`** — mỗi thiết bị vật lý tại nhà khách (= "serials" của Odoo)

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| serial | text (PK) | Khớp định dạng Odoo, vd `F00000156TCK00010001` |
| product_code | text (FK→products.code, **nullable**) | Null cho máy TQ chưa có code (bổ sung sau) |
| model_freetext | text | Model khi product_code null (máy TQ: GTUN-5800EN…) |
| customer_id | uuid (FK→customers) | |
| parent_serial | text (self-FK, nullable) | Combo POE: thiết bị con trỏ về serial combo cha |
| notify_contact_id | uuid (FK→customer_contacts) | SĐT nhận nhắc cho máy này (vd giúp việc nhận nhắc muối) |
| install_date | date | |
| install_address | text | |
| channel_source | text | Nguồn (Shopee/Direct/partner) |
| status | text | active / moved / removed |
| created_at / updated_at | timestamptz | |

**`warranty`** — bảo hành theo từng serial (combo POE: mỗi thiết bị con một dòng)

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| id | uuid (PK) | |
| serial | text (FK→installed_base) | |
| activated | bool | |
| start_date | date | |
| full_end | date | Suy ra từ `products.warranty_full_years` |
| core_end | date | Suy ra từ `products.warranty_core_years` |
| policy_note | text | |

### 3.3 Ticket & nhóm lỗi

**`tickets`** (khớp cấu trúc Odoo để di trú thẳng)

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| ticket_code | text (PK) | `GWT-260040`… (giữ tiếp chuỗi Odoo) |
| customer_id | uuid (FK) | |
| serial | text (FK→installed_base, nullable) | |
| product_code | text | Snapshot |
| province | text | |
| ticket_type | text | Yêu cầu bảo hành / thay lõi / bảo trì / máy có mùi / hỏng bơm / Khác… |
| state | text | open / done |
| description | text | Khách báo gì |
| last_note | text | Ghi chú xử lý mới nhất |
| resolution | text | Cách đã xử lý (nguồn nạp KB sau) |
| assigned_to | text | |
| issue_group_id | uuid (FK→ticket_issue_groups, nullable) | |
| created_at / updated_at | timestamptz | |

**`ticket_issue_groups`** — gom nhóm lỗi để trao đổi với hãng cải thiện SP

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| id | uuid (PK) | |
| group_code / name | text | |
| description | text | |
| vendor_status | text | Trạng thái làm việc với hãng |

### 3.4 Lịch thay lõi, muối, bảo trì, Water Profile

**`filter_schedule`** — sinh tự động khi lắp, từ `product_filters` (máy↔lõi + `recycle_*_months`)

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| id | uuid (PK) | |
| serial | text (FK→installed_base) | |
| filter_code | text (FK→products.code) | |
| interval_months | int | Từ `product_filters.recycle_min/max_months` |
| last_changed_date | date | |
| next_due_date | date | Nguồn nhắc khách + dự báo lõi/tháng |
| status | text | active / due / done |

**`salt_schedule`** — nhắc đổ muối POE

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| id | uuid (PK) | |
| serial | text (FK) | Thiết bị làm mềm POE |
| remind_day_of_month | int | Ngày cố định hằng tháng |
| qty_recommended | text | Vd bộ 30A: 7–9kg/lần |
| last_reminded_date | date | |

**`maintenance_plan`** — gói bảo trì POE

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| id | uuid (PK) | |
| customer_id / serial | | Bộ POE áp gói |
| plan_name | text | |
| origin | text | gift (tặng khi mua) / paid (mua thêm năm sau) |
| total_visits | int | Vd 4 lần |
| coverage_years | int | |
| start_date | date | |

**`maintenance_visit`** — từng lần bảo trì

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| id | uuid (PK) | |
| plan_id | uuid (FK→maintenance_plan) | |
| visit_no | int | Lần 1–4 |
| scheduled_date / actual_date | date | |
| status | text | due / scheduled / done |
| technician_ref | text | Trỏ sang module kỹ thuật |
| water_profile_id | uuid (FK→water_profile, nullable) | |
| notes | text | |

**`water_profile`** — báo cáo chất lượng nước; tạo lần đầu khi bàn giao, cập nhật mỗi lần

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| id | uuid (PK) | |
| customer_id / serial | | |
| measured_at | timestamptz | |
| visit_id | uuid (FK→maintenance_visit, nullable) | |
| metrics | jsonb | **Bộ chuẩn GWT — 4 chỉ tiêu:** `do_cung` (độ cứng, mg/L CaCO₃), `clo_du` (clo dư, mg/L), `tds` (ppm), `ph`. Mỗi chỉ tiêu có thể lưu giá trị trước/sau lọc |
| report_url | text | Bản render gửi khách |

### 3.5 Knowledge base

**`kb_articles`** — câu trả lời & cách xử lý cho nhân viên CSKH

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| id | uuid (PK) | |
| title | text | |
| symptom | text | Triệu chứng/hiện tượng khách mô tả |
| answer_customer | text | Câu trả lời gửi thẳng khách |
| fix_steps | text | Quy trình xử lý kỹ thuật |
| product_scope | text | category/sub_category/model áp dụng |
| source_ticket_ids | text[] | Ticket gốc rút ra |
| tags | text[] | |
| created_by / updated_at | | |

### 3.6 View phục vụ

- `v_installed_base` — khách + máy + trạng thái bảo hành (join customers/installed_base/warranty).
- `v_filter_due` — lõi sắp đến hạn (từ `filter_schedule`), cho reminder + dashboard.
- `v_core_forecast` — **số lõi dự kiến bán ra theo tháng** (gộp `filter_schedule.next_due_date`).
- `v_maintenance_due` — lịch bảo trì/muối sắp đến hạn.
- `v_ticket_dashboard` — ticket theo state/type/nhóm lỗi cho báo cáo.

## 4. Hợp đồng tích hợp (module độc lập)

- **Sales module** → khi chốt đơn: tạo/khớp `customers` + `customer_contacts`, tạo
  `installed_base` (serials; POE: serial combo cha + thiết bị con `parent_serial`), tạo
  `warranty`, và **auto-seed** `filter_schedule` (từ `product_filters`), `salt_schedule` +
  `maintenance_plan` (nếu POE).
- **Technician-scheduling module** → đọc `v_maintenance_due`; sau bảo trì ghi
  `maintenance_visit.actual_date`/`status` + tạo/cập nhật `water_profile`.
- Kích hoạt bảo hành nên đóng gói thành **Postgres function/RPC** để cả Sales module lẫn ops
  app gọi chung. Phase 0: `activate_warranty(serial)` (chỉ sinh `warranty`). Phase 3 mở rộng
  thành `activate_and_seed(serial)` — bổ sung sinh `filter_schedule`/`salt_schedule`/
  `maintenance_plan` khi các bảng lịch đã tồn tại — giữ logic sinh lịch nhất quán một chỗ.

## 5. Automation workers

- **Reminder worker** (cron hằng ngày): quét `v_filter_due`, `salt_schedule`,
  `maintenance_visit` sắp hạn → gửi **Zalo ZNS** tới `notify_contact_id` → ghi log gửi.
- **Leadership report worker** (định kỳ): tổng hợp lắp mới + ca/vấn đề + đọc folder
  "Báo cáo CEO" → gửi **WhatsApp**; báo cáo nhóm lỗi cho công ty mẹ.
- **Knowledge agent**: endpoint LLM/RAG trên `kb_articles` để NV hỏi và nhận câu trả lời gửi khách.
- **Water Profile render**: sinh báo cáo (HTML/PDF) từ `water_profile` → gửi khách.

Chi tiết cron/Edge Function xác định ở plan từng phase.

## 6. Lộ trình (mỗi phase = 1 spec→plan riêng)

Thứ tự theo ưu tiên user: có data khách trước → ghi nhận lỗi kịp thời → báo cáo sếp →
automation vòng đời → kịch bản trả lời.

| Phase | Nội dung | Kết quả dùng được |
|---|---|---|
| **0 · Nền + kích hoạt bảo hành** | Schema khách/liên hệ/installed_base/warranty + RLS · di trú 1.594 serial + 83 ticket từ Odoo · RPC `activate_warranty(serial)` (Phase 3 mở rộng thành `activate_and_seed` khi có bảng lịch) · ops app MVP (khách/liên hệ/installed_base/kích hoạt bảo hành) | Có data khách + bảo hành; NV làm trên hệ mới |
| **1 · Ghi nhận ticket** | Bảng `tickets` + ops app tạo/xử ticket + gán type/serial/khách. **Ưu tiên cao nhất** — theo dõi chăm sóc kịp thời | CSKH ghi & theo dõi lỗi tập trung |
| **2 · Báo cáo sếp + nhóm lỗi** | `ticket_issue_groups` + gom nhóm + leadership report worker (WhatsApp) + báo cáo công ty mẹ | Lãnh đạo & công ty mẹ nhận báo cáo |
| **3 · Lịch lõi/bảo trì/muối/Water Profile** | `filter_schedule` + `salt_schedule` + `maintenance_plan/visit` + `water_profile` + reminder worker Zalo ZNS + `v_core_forecast` + bàn giao module kỹ thuật | Tự nhắc + dự báo lõi + vòng đời POE |
| **4 · Kịch bản trả lời (KB)** | `kb_articles` + nạp từ ticket đã Done + knowledge agent | CSKH tự chủ trả lời, giảm hỏi kỹ thuật |
| **5 · Cutover** | Gỡ Odoo sau khi hệ mới ổn | Một hệ duy nhất |

## 7. Chiến lược di trú & chạy song song

- **Di trú một lần** từ Odoo export (`GWT Serial`, `Tickets`, `Product Variant`) → map:
  serial→`installed_base`, parent_serial→quan hệ combo, activated/expired→`warranty`,
  ticket→`tickets` (giữ `ticket_code` để nối tiếp chuỗi).
- **Số liệu POE từ Excel** (sheet Lọc tổng / Bảo trì / Thay mua muối / Khác) → `maintenance_plan`,
  `salt_schedule`, và các cụm đặc biệt (Anh Tuấn Tita — máy TQ, `product_code` null).
- **Chạy song song:** hệ mới là chính; import định kỳ từ Odoo tới cutover. **Đường lui khi
  hệ mới lỗi:** nhập tạm vào Odoo **hoặc** dùng **Excel template import/export** — ops app cần
  hỗ trợ import CSV/Excel để nhập bù và export để đối soát.

## 8. Bảo mật

- Toàn bộ bảng domain CSKH: **RLS bật, anon KHÔNG đọc** (dữ liệu khách hàng riêng tư). Ghi/đọc
  qua `service_role` (ops app + workers server-side). Khác với domain sản phẩm (anon read cho website).
- Không commit `.env`/key. Zalo ZNS & WhatsApp token chỉ dùng server-side.

## 9. Việc còn mở (quyết định ở plan từng phase)

- Hạ tầng worker: Supabase Edge Functions + `pg_cron` vs worker Node riêng.
- Template Zalo ZNS (nội dung + duyệt) cho từng loại nhắc.
- Định dạng & template báo cáo lãnh đạo (WhatsApp) và layout in Water Profile gửi khách.
- Quy tắc dedup/gộp khách khi trùng SĐT.

**Đã chốt:** low-code = **Retool** (Phase 0; Appsmith là phương án thay thế nếu cần
self-host). Water Profile `metrics` = 4 chỉ tiêu chuẩn (độ cứng, clo dư, TDS, pH), lưu
trước/sau lọc. `ticket_code` giữ tiếp chuỗi `GWT-2600xx`.

## 10. Tiêu chí thành công

- Một nguồn sự thật duy nhất (Supabase); hết cảnh lệch số liệu giữa 3 hệ.
- NV CSKH ghi nhận & xử lý ticket tập trung, tra cứu được khách + bảo hành + lịch sử.
- Nhắc lõi/muối/bảo trì tự động qua Zalo ZNS; dự báo được số lõi bán ra theo tháng.
- Lãnh đạo & công ty mẹ nhận báo cáo tự động; nhóm lỗi phản hồi được cho hãng.
- CSKH tự trả lời khách từ KB, giảm phụ thuộc hỏi kỹ thuật/quản lý.
