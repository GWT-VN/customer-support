-- cs — customer_code duy nhất + gộp khách TRẢ LẠI mã (22/08/2026)
--
-- Phiên Việc phát hiện, phiên Sales chuyển sang: `cs_customers.customer_code` CHƯA có ràng buộc
-- duy nhất. Hệ quả họ gặp: `link_json` LEFT JOIN bảng này theo mã, hai dòng cùng mã là nhân đôi
-- hàng ⇒ hai chip y hệt cho một khách, gỡ một cái vẫn còn cái kia.
--
-- Lý do đáng siết: `customer_code` là KHOÁ NỐI sang `customers` của Sales, mà bên đó cột này
-- vốn đã UNIQUE (bắt buộc, vì Apps Script upsert `on_conflict=customer_code`). Nối nhiều-về-một
-- vào một khoá vốn duy nhất thì hai hồ sơ CS cùng trỏ một khách Sheet gần như chắc chắn là LỖI
-- ánh xạ, không phải tình huống hợp lệ.
--
-- ⚠️ NHƯNG đặt ràng buộc thẳng là KHOÁ CHẾT CHÍNH NÚT GỘP. Đo đường code trước khi siết:
-- `gop_khach` chỉ đặt trang_thai='da_xoa' và xoá primary_phone, **giữ nguyên customer_code**;
-- trong khi hồ sơ giữ lại lấy `coalesce(giữ.customer_code, gộp.customer_code)`. Ca "hồ sơ giữ
-- chưa có mã, hồ sơ bị gộp có mã" ⇒ HAI DÒNG CÙNG MỘT MÃ ⇒ ràng buộc làm vỡ cả phép gộp.
-- Đã tái hiện thật trên local trước khi sửa.
--
-- Nên làm HAI việc cùng lúc:
--  1. `gop_khach` TRẢ LẠI mã (`customer_code = null`) cho hồ sơ bị gộp — hồ sơ đã khai tử thì
--     giữ mã cũng vô nghĩa, và đó chính là nguồn đụng độ.
--  2. Ràng buộc duy nhất dạng PARTIAL, chỉ áp cho hồ sơ CÒN SỐNG — lưới an toàn thứ hai cho
--     dữ liệu cũ hoặc đường ghi nào khác quên trả mã.
--
-- Đo prod trước khi đặt: 127 dòng có mã, 0 trùng kể cả tính dòng đã xoá.

CREATE OR REPLACE FUNCTION public.gop_khach(p_giu uuid, p_gop uuid, p_chon jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id_lo   uuid;
  v_id_hi   uuid;
  v_row_lo  cs_customers%rowtype;
  v_row_hi  cs_customers%rowtype;
  v_giu  cs_customers%rowtype;
  v_gop  cs_customers%rowtype;
  v_truong jsonb := coalesce(p_chon -> 'truong', '{}'::jsonb);
  v_phone_cuoi text;
  v_muc jsonb;
  n_may int; n_ticket int; n_plan int; n_lienhe int; n_sudung int;
  n_sdt_phu int := 0; n_dia_chi int := 0;
begin
  if p_giu is null or p_gop is null then
    raise exception 'Thiếu khách nguồn hoặc khách đích.';
  end if;
  if p_giu = p_gop then
    raise exception 'Không thể gộp một khách với chính nó.';
  end if;

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
  update customer_addresses set customer_id = p_giu where customer_id = p_gop;

  v_phone_cuoi := coalesce(
    nullif(v_truong ->> 'primary_phone', ''),
    nullif(v_giu.primary_phone, ''),
    nullif(v_gop.primary_phone, '')
  );

  update cs_customers set
    trang_thai = 'da_xoa',
    primary_phone = null,
    customer_code = null,
    notes = trim(both e'\n' from concat_ws(e'\n', nullif(notes, ''),
              '— Đã gộp vào hồ sơ ' || p_giu::text || ' lúc ' || now()::text)),
    updated_at = now()
  where id = p_gop;

  update cs_customers set
    primary_phone           = v_phone_cuoi,
    needs_phone             = (v_phone_cuoi is null or v_phone_cuoi !~ '^0[0-9]{9,10}$'),
    full_name               = coalesce(nullif(v_truong ->> 'full_name', ''), v_giu.full_name),
    address                 = coalesce(nullif(v_truong ->> 'address', ''),  nullif(v_giu.address, ''),  nullif(v_gop.address, '')),
    province                = coalesce(nullif(v_truong ->> 'province', ''), nullif(v_giu.province, ''), nullif(v_gop.province, '')),
    address_truoc_sap_nhap  = coalesce(nullif(v_giu.address_truoc_sap_nhap, ''),  nullif(v_gop.address_truoc_sap_nhap, '')),
    province_truoc_sap_nhap = coalesce(nullif(v_giu.province_truoc_sap_nhap, ''), nullif(v_gop.province_truoc_sap_nhap, '')),
    customer_code = coalesce(nullif(v_truong ->> 'customer_code', ''), v_giu.customer_code, v_gop.customer_code),
    channel_id    = coalesce((v_truong ->> 'channel_id')::int, v_giu.channel_id, v_gop.channel_id),
    source        = coalesce(nullif(v_truong ->> 'source', ''),      nullif(v_giu.source, ''),      nullif(v_gop.source, '')),
    partner_ref   = coalesce(nullif(v_truong ->> 'partner_ref', ''), nullif(v_giu.partner_ref, ''), nullif(v_gop.partner_ref, '')),
    ten_cty       = coalesce(nullif(v_truong ->> 'ten_cty', ''),     nullif(v_giu.ten_cty, ''),     nullif(v_gop.ten_cty, '')),
    mst           = coalesce(nullif(v_truong ->> 'mst', ''),         nullif(v_giu.mst, ''),         nullif(v_gop.mst, '')),
    dia_chi_cty   = coalesce(nullif(v_truong ->> 'dia_chi_cty', ''), nullif(v_giu.dia_chi_cty, ''), nullif(v_gop.dia_chi_cty, '')),
    sdt_cty       = coalesce(nullif(v_truong ->> 'sdt_cty', ''),     nullif(v_giu.sdt_cty, ''),     nullif(v_gop.sdt_cty, '')),
    email_cty     = coalesce(nullif(v_truong ->> 'email_cty', ''),   nullif(v_giu.email_cty, ''),   nullif(v_gop.email_cty, '')),
    -- ĐỔI Ở ĐÂY: bỏ `v_gop.primary_phone` khỏi câu ghi chú. Số dư nay nằm ở
    -- customer_contacts (SĐT phụ) — chỗ tra cứu được, không phải chuỗi chữ.
    notes = trim(both e'\n' from concat_ws(e'\n',
      coalesce(nullif(v_truong ->> 'notes', ''), nullif(v_giu.notes, '')),
      concat_ws(' · ',
        '— Đã gộp hồ sơ trùng: ' || v_gop.full_name,
        nullif(v_gop.address, ''),
        nullif(v_gop.notes, ''))
    )),
    updated_at = now()
  where id = p_giu;

  for v_muc in select * from jsonb_array_elements(coalesce(p_chon -> 'sdt_phu', '[]'::jsonb))
  loop
    if nullif(v_muc ->> 'phone', '') is not null
       and not exists (
         select 1 from customer_contacts
         where customer_id = p_giu and phone = v_muc ->> 'phone'
       )
       and coalesce(nullif(v_muc ->> 'phone', ''), '') <> coalesce(v_phone_cuoi, '')
    then
      insert into customer_contacts (customer_id, phone, contact_name, role, is_primary, zalo_ok, ghi_chu)
      values (
        p_giu, v_muc ->> 'phone', nullif(v_muc ->> 'contact_name', ''),
        coalesce(nullif(v_muc ->> 'role', ''), 'khac'), false, true,
        nullif(v_muc ->> 'ghi_chu', '')
      );
      n_sdt_phu := n_sdt_phu + 1;
    end if;
  end loop;

  for v_muc in select * from jsonb_array_elements(coalesce(p_chon -> 'dia_chi_them', '[]'::jsonb))
  loop
    if nullif(v_muc ->> 'dia_chi', '') is not null
       and not exists (
         select 1 from customer_addresses
         where customer_id = p_giu and dia_chi = v_muc ->> 'dia_chi'
       )
    then
      insert into customer_addresses (customer_id, dia_chi, loai, ghi_chu, tinh)
      values (
        p_giu, v_muc ->> 'dia_chi',
        coalesce(nullif(v_muc ->> 'loai', ''), 'khac'),
        nullif(v_muc ->> 'ghi_chu', ''),
        nullif(v_muc ->> 'tinh', '')
      );
      n_dia_chi := n_dia_chi + 1;
    end if;
  end loop;

  return jsonb_build_object('may', n_may, 'ticket', n_ticket, 'plan', n_plan,
                            'lien_he', n_lienhe, 'su_dung', n_sudung,
                            'sdt_phu_them', n_sdt_phu, 'dia_chi_them', n_dia_chi);
end $function$;

-- PARTIAL: chỉ hồ sơ còn sống. Hồ sơ đã khai tử nay luôn được trả mã về null nên không đụng,
-- nhưng để partial thì dữ liệu cũ hay đường ghi quên trả mã cũng không khoá chết bảng.
create unique index if not exists uq_cs_customers_customer_code
  on public.cs_customers (customer_code)
  where customer_code is not null and coalesce(trang_thai, '') <> 'da_xoa';

revoke all on function gop_khach(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function gop_khach(uuid, uuid, jsonb) to service_role;
