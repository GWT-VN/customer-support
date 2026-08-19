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
-- 3 điểm khác với bản nháp ban đầu, sau khi đối chiếu \d cs_customers thực tế:
--   * ten_kd, dia_chi_kd là GENERATED ALWAYS AS ... STORED (suy ra từ full_name/
--     address/province) -> không được phép UPDATE trực tiếp, Postgres sẽ báo lỗi.
--     Chúng tự tính lại đúng khi address/province của bản giữ đổi ở bước 2.
--   * address_truoc_sap_nhap, province_truoc_sap_nhap (thêm ở migration 14, giữ
--     vết địa chỉ trước đợt sáp nhập tỉnh/phường 2025) là dữ liệu thật, cùng dạng
--     text nullable như address/province -> áp cùng luật trộn, kẻo mất vết lịch sử.
--   * needs_phone là cờ "còn thiếu SĐT" (dùng để lọc danh sách cần bổ sung, xem
--     apps/web/app/actions.ts). Nếu SĐT cuối cùng đã có (từ bản giữ hoặc lấy được
--     từ bản gộp) mà vẫn để cờ true thì khách đã có SĐT nhưng vẫn hiện "thiếu" ->
--     tính lại cờ theo SĐT sau khi trộn.

create or replace function gop_khach(p_giu uuid, p_gop uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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

  select * into v_giu from cs_customers where id = p_giu for update;
  if not found then raise exception 'Không thấy khách giữ lại.'; end if;
  select * into v_gop from cs_customers where id = p_gop for update;
  if not found then raise exception 'Không thấy khách bị gộp.'; end if;
  if v_gop.trang_thai = 'da_xoa' then
    raise exception 'Khách bị gộp đã ở trạng thái đã xoá.';
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

  -- 2) Trộn trường: chỉ lấp chỗ TRỐNG của bản giữ, tuyệt đối không ghi đè.
  --    (ten_kd, dia_chi_kd là cột generated -> KHÔNG gán ở đây, tự suy lại từ
  --    full_name/address/province vừa cập nhật.)
  update cs_customers set
    primary_phone           = v_phone_cuoi,
    needs_phone             = (v_phone_cuoi is null),
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

  -- 3) Ẩn mềm bản bị gộp + để lại đường lần ngược.
  update cs_customers set
    trang_thai = 'da_xoa',
    notes = trim(both e'\n' from concat_ws(e'\n', nullif(notes, ''),
              '— Đã gộp vào hồ sơ ' || p_giu::text || ' lúc ' || now()::text)),
    updated_at = now()
  where id = p_gop;

  return jsonb_build_object('may', n_may, 'ticket', n_ticket, 'plan', n_plan,
                            'lien_he', n_lienhe, 'su_dung', n_sudung);
end $$;

comment on function gop_khach(uuid, uuid) is
  'Gộp khách trùng: dời máy/ticket/plan/liên hệ/sử dụng sang bản giữ, lấp trường trống, ẩn mềm bản bị gộp. Nguyên tử.';

revoke all on function gop_khach(uuid, uuid) from public, anon, authenticated;
grant execute on function gop_khach(uuid, uuid) to service_role;
