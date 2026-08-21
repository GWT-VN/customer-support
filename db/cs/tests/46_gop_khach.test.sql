-- Kiểm thử RPC gop_khach (migration 46) trên DB LOCAL.
--
-- Vì sao cần: "không mất trường nào khi gộp" là lời hứa quan trọng nhất của
-- nhánh này, nhưng chỉ nằm trong RPC — 138 test hiện có chỉ phủ 2 hàm thuần
-- (kiemTraGop/moTaGop ở apps/web/lib/gopKhach.ts), không hàm nào gọi RPC thật.
-- Cách xác minh duy nhất trước đây là 1 đoạn SQL tay chạy thủ công trên prod.
--
-- Script này KHÔNG phải pgTAP (repo chưa có harness đó) — chỉ là SQL thuần,
-- seed dữ liệu BỊA, gọi gop_khach(), rồi RAISE EXCEPTION nếu bất kỳ điều kiện
-- nào sai. Toàn bộ bọc trong BEGIN/ROLLBACK nên KHÔNG để lại dấu vết trong DB,
-- kể cả khi assert fail (EXCEPTION tự rollback transaction).
--
-- Chạy (từ máy có docker, container DB local tên supabase_db_gwt-platform):
--   docker exec -i supabase_db_gwt-platform psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f db/cs/tests/46_gop_khach.test.sql
-- Thoát mã 0 = mọi assert qua. Khác 0 (kể cả do RAISE EXCEPTION) = có trường bị mất.

begin;

do $$
declare
  v_kenh_id     int;
  v_id_giu      uuid;
  v_id_gop      uuid;
  v_ket_qua     jsonb;
  v_giu_sau     cs_customers%rowtype;
  v_gop_sau     cs_customers%rowtype;
begin
  -- Mượn tạm 1 channel_id có sẵn trong dim_channel (bảng catalog dùng chung,
  -- không phải dữ liệu khách) để test cột channel_id là FK hợp lệ.
  select id into v_kenh_id from dim_channel limit 1;
  if v_kenh_id is null then
    raise exception 'ĐIỀU KIỆN TIÊN QUYẾT SAI: dim_channel rỗng trên DB local, không seed được test.';
  end if;

  -- Khách GIỮ: bịa, thiếu SĐT + thiếu address/channel_id/source (mô phỏng đúng
  -- ca thật thúc đẩy migration 46 — hồ sơ "nghèo" đang cần khách bị gộp lấp vào).
  -- Cột full_name có SẴN giá trị -> dùng để test "không bị ghi đè".
  insert into cs_customers (full_name, primary_phone, address, channel_id, source)
  values ('Khách Test Giữ Lại', null, null, null, null)
  returning id into v_id_giu;

  -- Khách GỘP: bịa, có đủ SĐT/address/channel_id/source để lấp vào bản giữ,
  -- và full_name KHÁC bản giữ để xác nhận full_name bản giữ không bị đè.
  insert into cs_customers (full_name, primary_phone, address, channel_id, source)
  values ('Khách Test Bị Gộp', '0900000099', 'Số 99 Đường Test', v_kenh_id, 'facebook-test')
  returning id into v_id_gop;

  v_ket_qua := gop_khach(v_id_giu, v_id_gop);

  select * into v_giu_sau from cs_customers where id = v_id_giu;
  select * into v_gop_sau from cs_customers where id = v_id_gop;

  -- 1) Trường bản giữ THIẾU, bản gộp CÓ -> phải được chuyển sang.
  if v_giu_sau.address is distinct from 'Số 99 Đường Test' then
    raise exception 'FAIL: address không được chuyển từ bản gộp sang bản giữ (got %)', v_giu_sau.address;
  end if;
  if v_giu_sau.channel_id is distinct from v_kenh_id then
    raise exception 'FAIL: channel_id không được chuyển từ bản gộp sang bản giữ (got %)', v_giu_sau.channel_id;
  end if;
  if v_giu_sau.source is distinct from 'facebook-test' then
    raise exception 'FAIL: source không được chuyển từ bản gộp sang bản giữ (got %)', v_giu_sau.source;
  end if;

  -- 2) Trường bản giữ ĐÃ CÓ SẴN -> không được ghi đè bởi bản gộp.
  if v_giu_sau.full_name is distinct from 'Khách Test Giữ Lại' then
    raise exception 'FAIL: full_name của bản giữ bị ghi đè (got %)', v_giu_sau.full_name;
  end if;

  -- 3) Bản bị gộp phải chuyển sang trạng thái đã xoá (ẩn mềm, không xoá cứng).
  if v_gop_sau.trang_thai is distinct from 'da_xoa' then
    raise exception 'FAIL: bản bị gộp không được đặt trang_thai=da_xoa (got %)', v_gop_sau.trang_thai;
  end if;

  -- 4) Ca từng vỡ UNIQUE constraint: bản giữ KHÔNG có SĐT, hấp thụ SĐT của bản
  --    gộp -> phải thành công (không lỗi customers_primary_phone_key) và bản
  --    giữ phải mang đúng SĐT đó, needs_phone phải tắt vì SĐT hợp lệ.
  if v_giu_sau.primary_phone is distinct from '0900000099' then
    raise exception 'FAIL: primary_phone không được hấp thụ đúng (got %)', v_giu_sau.primary_phone;
  end if;
  if v_giu_sau.needs_phone is distinct from false then
    raise exception 'FAIL: needs_phone phải tắt khi đã có SĐT hợp lệ sau gộp (got %)', v_giu_sau.needs_phone;
  end if;
  -- Bản bị gộp phải được giải phóng SĐT (không thì đã vỡ UNIQUE và không chạy tới đây).
  if v_gop_sau.primary_phone is not null then
    raise exception 'FAIL: primary_phone của bản bị gộp phải được giải phóng (got %)', v_gop_sau.primary_phone;
  end if;

  raise notice 'PASS: mọi assert của gop_khach() đều đúng.';
end $$;

rollback;
