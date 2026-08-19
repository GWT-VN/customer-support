# Test SQL cho module CS (không phải migration)

Repo chưa có harness pgTAP nên các file ở đây là SQL thuần, tự bọc
`begin; … rollback;` và `raise exception` khi assert sai — chạy xong không để
lại dấu vết trong DB, thoát mã khác 0 khi có lỗi (dùng được cho CI hoặc kiểm
tra tay trước khi đổi RPC).

Chạy trên DB local (container `supabase_db_gwt-platform`):

```bash
docker exec -i supabase_db_gwt-platform psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f db/cs/tests/46_gop_khach.test.sql
```
