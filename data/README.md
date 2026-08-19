# data/ — data thô & kết quả rà soát (KHÔNG commit)

Mọi file Excel/CSV/md xuất ra từ Odoo, Pancake CRM, Google Sheet, hoặc kết quả rà
soát của script `tools/migrate/` đều nằm ở đây. **Chứa PII khách hàng** (tên, SĐT,
địa chỉ) nên `.gitignore` chặn toàn bộ — chỉ file README này được commit.

| Thư mục | Là gì |
|---|---|
| `File gốc/` | Data thô xuất từ hệ cũ, giữ nguyên không sửa |
| `File md/` | Bản .md của CRM Pancake, báo cáo CEO |
| `File kết quả cần kiểm tra/` | Output rà soát/đối chiếu chờ người xác nhận |

Cần chia sẻ ra ngoài → xuất bản mới đã che PII, đừng gửi thẳng file ở đây.
