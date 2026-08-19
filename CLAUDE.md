# Customer Support (CS) — repo gốc

Repo CS. App ở `app-cskh/` (xem `app-cskh/CLAUDE.md` cho lưu ý Next.js).

## ⚠️ ĐỌC TRƯỚC khi làm việc đụng hệ thống dùng chung với Sales / Kỹ thuật

Hệ thống CS ⇄ Sales chạy trên **cùng 1 DB** và chia sẻ nhiều bảng. Trước khi đụng
bảng dùng chung (`staff`, `customers`, `dim_channel`, catalog), khoá nối
(`customer_code`, `internal_code`), hay tích hợp Sales↔CS — **đọc nguồn sự thật chung**:

```
/Users/medici/Library/Mobile Documents/com~apple~CloudDocs/GWT - Claude/GWT-SHARED/SYSTEM.md
```
(tương đối từ repo này: `../GWT-SHARED/SYSTEM.md`)

Quy tắc từ file đó:
- **Schema/dữ liệu = query DB Supabase `bwzmqfbcgouhvhoslmmm`** (Supabase MCP) — ĐỪNG tin mô tả cột cũ trong doc, code repo có thể đã đi xa hơn context của bạn.
- **Đổi bảng DÙNG CHUNG** → ghi 1 dòng vào Changelog trong `SYSTEM.md` + báo Sales TRƯỚC khi chạy migration.
- Không commit PII khách; git author = `ai@gwt.vn`.
