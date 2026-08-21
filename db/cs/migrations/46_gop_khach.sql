-- 46 — gop_khach: gộp 2 hồ sơ khách trùng thành một, KHÔNG mất trường nào.
--
-- Vì sao là RPC chứ không phải vài lệnh update từ app: gộp phải chuyển 5 bảng
-- tham chiếu + trộn trường + ẩn bản bị gộp. Nếu đứt giữa chừng thì máy đã sang
-- khách mới mà hồ sơ cũ vẫn hiện -> dữ liệu khách hỏng, không tự phát hiện được.
-- Gói trong 1 hàm = 1 transaction, hỏng thì rollback sạch.
--
-- Luật trộn trường (không bao giờ ghi đè dữ liệu đang có):
--   * bản GIỮ có giá trị -> giữ nguyên.
--   * bản GIỮ trống, bản GỘP có -> lấy của bản GỘP.
--   * notes: nối thêm, không thay thế.
-- Ca thật thúc đẩy luật này: bản bị gộp rỗng về máy/ticket nhưng lại mang địa chỉ
-- công ty + channel_id + source + MST — xoá thẳng là mất sạch.
--
-- Bản bị gộp KHÔNG xoá cứng: đặt trang_thai='da_xoa' + ghi vết trỏ về bản giữ,
-- để còn lần ngược lại được khi gộp nhầm.
--
-- 3 điểm khác với bản nháp ban đầu, sau khi đối chiếu \d cs_customers thực tế
-- (đã review round 1, giữ nguyên):
--   * ten_kd, dia_chi_kd là GENERATED ALWAYS AS ... STORED (suy ra từ full_name/
--     address/province) -> không được phép UPDATE trực tiếp, Postgres sẽ báo lỗi.
--     Chúng tự tính lại đúng khi address/province của bản giữ đổi ở bước 2.
--   * address_truoc_sap_nhap, province_truoc_sap_nhap (thêm ở migration 14, giữ
--     vết địa chỉ trước đợt sáp nhập tỉnh/phường 2025) là dữ liệu thật, cùng dạng
--     text nullable như address/province -> áp cùng luật trộn, kẻo mất vết lịch sử.
--   * needs_phone là cờ "còn thiếu SĐT" (dùng để lọc danh sách cần bổ sung, xem
--     apps/web/app/actions.ts). Nếu SĐT cuối cùng đã có mà vẫn để cờ true thì
--     khách đã có SĐT nhưng vẫn hiện "thiếu" -> tính lại cờ theo SĐT sau khi trộn,
--     dùng ĐÚNG quy tắc "SĐT hợp lệ" mà app đang dùng (^0\d{9,10}$, xem
--     apps/web/app/actions.ts dòng ~253) chứ không phải "có ký tự là đủ" — một
--     chuỗi rác dạng SĐT không nên âm thầm tắt cờ "thiếu SĐT".
--
-- 4 điểm sửa ở round review thứ 2 (fix round 1/5):
--   1. (Critical) customers_primary_phone_key là UNIQUE CONSTRAINT trên
--      primary_phone. Bản nháp trước gán primary_phone cho bản giữ TRƯỚC khi
--      xoá SĐT khỏi bản bị gộp -> có lúc cả 2 dòng cùng giữ 1 SĐT -> vỡ ràng
--      buộc unique, cả giao dịch rollback, không gộp được gì — đúng ca mà hàm
--      này sinh ra để xử lý (khách thiếu SĐT hấp thụ SĐT từ bản trùng). Sửa:
--      ẩn mềm + GIẢI PHÓNG primary_phone của bản bị gộp TRƯỚC, rồi mới gán SĐT
--      đó cho bản giữ. Đã rà toàn bộ index/constraint qua \d cs_customers:
--      DUY NHẤT primary_phone có UNIQUE CONSTRAINT; customer_code chỉ có index
--      thường (idx_cs_customers_code), không unique -> không vướng ca này.
--   2. (Important) Trước đây chỉ chặn bản GỘP đã 'da_xoa', không chặn bản GIỮ.
--      Gộp vào một bản giữ đã 'da_xoa' sẽ âm thầm dời máy/ticket/plan/liên hệ/
--      sử dụng vào một hồ sơ vẫn ở trạng thái đã xoá -> biến mất khỏi các màn
--      hình khách bình thường mà không có lỗi nào báo. Thêm chặn tương tự cho
--      p_giu.
--   3. (Important) Khoá 2 dòng theo THỨ TỰ THAM SỐ (p_giu rồi p_gop) trước đây
--      có thể deadlock: gop_khach(A,B) chạy song song với gop_khach(B,A) sẽ
--      khoá ngược chiều nhau. Sửa: luôn khoá theo thứ tự CỐ ĐỊNH theo id
--      (least/greatest), bất kể id nào là "giữ" hay "gộp", rồi mới gán lại
--      đúng vai trò giữ/gộp theo tham số gọi hàm.
create or replace function gop_khach(p_giu uuid, p_gop uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_lo   uuid;
  v_id_hi   uuid;
  v_row_lo  cs_customers%rowtype;
  v_row_hi  cs_customers%rowtype;
  v_giu  cs_customers%rowtype;
  v_gop  cs_customers%rowtype;
  v_phone_cuoi text;
  n_may int; n_ticket int; n_plan int; n_lienhe int; n_sudung int;
begin
  if p_giu is null or p_gop is null then
    raise exception 'Thiếu khách nguồn hoặc khách đích.';
  end if;
  if p_giu = p_gop then
    raise exception 'Không thể gộp một khách với chính nó.';
  end if;

  -- Khoá 2 dòng theo thứ tự id CỐ ĐỊNH (không theo vai trò giữ/gộp) để 2 lệnh
  -- gọi ngược chiều nhau (A,B) và (B,A) luôn khoá cùng thứ tự -> không deadlock.
  v_id_lo := least(p_giu, p_gop);
  v_id_hi := greatest(p_giu, p_gop);

  select * into v_row_lo from cs_customers where id = v_id_lo for update;
  if not found then
    raise exception 'Không thấy khách %.', case when v_id_lo = p_giu then 'giữ lại' else 'bị gộp' end;
  end if;
  select * into v_row_hi from cs_customers where id = v_id_hi for update;
  if not found then
    raise exception 'Không thấy khách %.', case when v_id_hi = p_giu then 'giữ lại' else 'bị gộp' end;
  end if;

  -- Gán lại đúng vai trò giữ/gộp theo tham số gọi hàm (độc lập với thứ tự khoá ở trên).
  if v_id_lo = p_giu then
    v_giu := v_row_lo; v_gop := v_row_hi;
  else
    v_giu := v_row_hi; v_gop := v_row_lo;
  end if;

  if v_gop.trang_thai = 'da_xoa' then
    raise exception 'Khách bị gộp đã ở trạng thái đã xoá.';
  end if;
  if v_giu.trang_thai = 'da_xoa' then
    raise exception 'Khách giữ lại đang ở trạng thái đã xoá, không thể gộp vào.';
  end if;

  -- 1) Dời mọi tham chiếu sang bản giữ.
  update installed_base    set customer_id = p_giu where customer_id = p_gop;
  get diagnostics n_may    = row_count;
  update tickets           set customer_id = p_giu where customer_id = p_gop;
  get diagnostics n_ticket = row_count;
  update maintenance_plan  set customer_id = p_giu where customer_id = p_gop;
  get diagnostics n_plan   = row_count;
  update customer_contacts set customer_id = p_giu where customer_id = p_gop;
  get diagnostics n_lienhe = row_count;
  update serial_su_dung    set customer_id = p_giu where customer_id = p_gop;
  get diagnostics n_sudung = row_count;

  -- SĐT sau khi trộn, dùng lại cho cả cột primary_phone lẫn cờ needs_phone bên dưới.
  v_phone_cuoi := coalesce(nullif(v_giu.primary_phone, ''), nullif(v_gop.primary_phone, ''));

  -- 2) Ẩn mềm bản bị gộp TRƯỚC + GIẢI PHÓNG primary_phone của nó ngay tại đây.
  --    Bắt buộc làm trước bước 3: nếu gán SĐT cho bản giữ trước khi xoá SĐT ở
  --    bản bị gộp, 2 dòng cùng giữ 1 SĐT trong khoảnh khắc giữa 2 câu UPDATE ->
  --    vỡ customers_primary_phone_key (UNIQUE), rollback toàn bộ giao dịch.
  update cs_customers set
    trang_thai = 'da_xoa',
    primary_phone = null,
    notes = trim(both e'\n' from concat_ws(e'\n', nullif(notes, ''),
              '— Đã gộp vào hồ sơ ' || p_giu::text || ' lúc ' || now()::text)),
    updated_at = now()
  where id = p_gop;

  -- 3) Trộn trường vào bản giữ: chỉ lấp chỗ TRỐNG, tuyệt đối không ghi đè.
  --    (ten_kd, dia_chi_kd là cột generated -> KHÔNG gán ở đây, tự suy lại từ
  --    full_name/address/province vừa cập nhật.)
  update cs_customers set
    primary_phone           = v_phone_cuoi,
    needs_phone             = (v_phone_cuoi is null or v_phone_cuoi !~ '^0[0-9]{9,10}$'),
    address                 = coalesce(nullif(v_giu.address, ''),       nullif(v_gop.address, '')),
    province                = coalesce(nullif(v_giu.province, ''),      nullif(v_gop.province, '')),
    address_truoc_sap_nhap  = coalesce(nullif(v_giu.address_truoc_sap_nhap, ''),  nullif(v_gop.address_truoc_sap_nhap, '')),
    province_truoc_sap_nhap = coalesce(nullif(v_giu.province_truoc_sap_nhap, ''), nullif(v_gop.province_truoc_sap_nhap, '')),
    customer_code = coalesce(v_giu.customer_code, v_gop.customer_code),
    channel_id    = coalesce(v_giu.channel_id,    v_gop.channel_id),
    source        = coalesce(nullif(v_giu.source, ''),        nullif(v_gop.source, '')),
    partner_ref   = coalesce(nullif(v_giu.partner_ref, ''),   nullif(v_gop.partner_ref, '')),
    -- Ghi lại NGUYÊN VĂN bản bị gộp: tên khác, địa chỉ khác (vd địa chỉ công ty)
    -- và ghi chú (vd MST) đều là thông tin thật, không được rơi mất.
    notes = trim(both e'\n' from concat_ws(e'\n',
      nullif(v_giu.notes, ''),
      concat_ws(' · ',
        '— Đã gộp hồ sơ trùng: ' || v_gop.full_name,
        nullif(v_gop.primary_phone, ''),
        nullif(v_gop.address, ''),
        nullif(v_gop.notes, ''))
    )),
    updated_at = now()
  where id = p_giu;

  return jsonb_build_object('may', n_may, 'ticket', n_ticket, 'plan', n_plan,
                            'lien_he', n_lienhe, 'su_dung', n_sudung);
end $$;

comment on function gop_khach(uuid, uuid) is
  'Gộp khách trùng: dời máy/ticket/plan/liên hệ/sử dụng sang bản giữ, lấp trường trống, ẩn mềm bản bị gộp. Nguyên tử.';

revoke all on function gop_khach(uuid, uuid) from public, anon, authenticated;
grant execute on function gop_khach(uuid, uuid) to service_role;
