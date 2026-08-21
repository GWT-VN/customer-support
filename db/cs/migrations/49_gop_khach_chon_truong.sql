-- 49 — gop_khach nhận lựa chọn của CS: không vứt SĐT/địa chỉ nữa.
--
-- Migration 46 quyết định ngầm: trường nào cả hai hồ sơ đều có thì BẢN GIỮ thắng,
-- giá trị bên kia nằm lại hồ sơ đã ẩn. Đo trên production: 12/14 nhóm khách trùng
-- tên có cả hai đều có SĐT, 12/14 có hai địa chỉ khác nhau — nên luật "bản giữ
-- thắng" vứt mất một SĐT và một địa chỉ trong hầu hết lần gộp thật.
--
-- CEO chỉ ra bản chất: hai SĐT của một người KHÔNG phải xung đột, đó là số chính +
-- số phụ (số công ty, số giúp việc). Hai địa chỉ cũng vậy: địa chỉ nhà + địa chỉ
-- công ty. Chỗ chứa vốn đã có (`customer_contacts` cho SĐT, `customer_addresses`
-- thêm ở migration 48) — chỉ thiếu đường đưa dữ liệu vào đó lúc gộp.
--
-- p_chon (jsonb, để null = chạy Y HỆT bản 46):
--   {
--     "truong":       { "full_name": "…", "address": "…", "channel_id": 3, … },
--     "sdt_phu":      [ { "phone": "…", "contact_name": "…", "role": "khac" } ],
--     "dia_chi_them": [ { "dia_chi": "…", "loai": "cty", "ghi_chu": "…" } ]
--   }
-- Khoá nào vắng trong "truong" thì rơi về đúng luật coalesce cũ, nên hàng chờ duyệt
-- tạo trước migration này (payload chỉ có gop_id) vẫn duyệt được bình thường.
--
-- BẮT BUỘC DROP TRƯỚC: thêm tham số có DEFAULT không phải "sửa hàm cũ" mà là tạo
-- hàm NẠP CHỒNG. Để cả gop_khach(uuid,uuid) lẫn gop_khach(uuid,uuid,jsonb) thì lệnh
-- gọi 2 tham số của app thành nhập nhằng -> lỗi ngay. Drop làm mất GRANT nên phải
-- cấp lại ở cuối file (cả hai nằm trong 1 transaction, hỏng thì rollback sạch).

-- Hàm dưới đây trộn cả 5 cột thông tin công ty (migration 50 mới thêm). Khai báo
-- lại ở đây bằng `if not exists` để file 49 tự đủ: chạy 49 trước 50 trên một môi
-- trường mới cũng không lỗi "column does not exist", và chạy sau 50 thì không làm
-- gì. Không đặt comment/index ở đây — đó là việc của file 50.
alter table cs_customers
  add column if not exists ten_cty     text,
  add column if not exists mst         text,
  add column if not exists dia_chi_cty text,
  add column if not exists sdt_cty     text,
  add column if not exists email_cty   text;

drop function if exists gop_khach(uuid, uuid);

create or replace function gop_khach(p_giu uuid, p_gop uuid, p_chon jsonb default null)
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

  -- Khoá 2 dòng theo thứ tự id CỐ ĐỊNH để 2 lệnh gọi ngược chiều nhau không deadlock.
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
  -- Địa chỉ phụ (migration 48) cũng phải theo chủ mới.
  update customer_addresses set customer_id = p_giu where customer_id = p_gop;

  -- SĐT cuối: CS chọn gì dùng nấy; không chọn thì giữ luật cũ (bản giữ thắng).
  v_phone_cuoi := coalesce(
    nullif(v_truong ->> 'primary_phone', ''),
    nullif(v_giu.primary_phone, ''),
    nullif(v_gop.primary_phone, '')
  );

  -- 2) Ẩn mềm bản bị gộp + GIẢI PHÓNG primary_phone TRƯỚC khi gán cho bản giữ,
  --    nếu không hai dòng cùng giữ một SĐT -> vỡ ràng buộc UNIQUE, rollback tất.
  update cs_customers set
    trang_thai = 'da_xoa',
    primary_phone = null,
    notes = trim(both e'\n' from concat_ws(e'\n', nullif(notes, ''),
              '— Đã gộp vào hồ sơ ' || p_giu::text || ' lúc ' || now()::text)),
    updated_at = now()
  where id = p_gop;

  -- 3) Trộn trường vào bản giữ. Có p_chon thì lấy giá trị CS chọn; khoá nào vắng
  --    thì rơi về luật cũ "lấp chỗ trống, không ghi đè".
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
    -- Thông tin công ty — cột do migration 50 thêm; khối `alter table` ở đầu file
    -- này bảo đảm chúng tồn tại kể cả khi chạy 49 trước 50 trên môi trường mới.
    ten_cty       = coalesce(nullif(v_truong ->> 'ten_cty', ''),     nullif(v_giu.ten_cty, ''),     nullif(v_gop.ten_cty, '')),
    mst           = coalesce(nullif(v_truong ->> 'mst', ''),         nullif(v_giu.mst, ''),         nullif(v_gop.mst, '')),
    dia_chi_cty   = coalesce(nullif(v_truong ->> 'dia_chi_cty', ''), nullif(v_giu.dia_chi_cty, ''), nullif(v_gop.dia_chi_cty, '')),
    sdt_cty       = coalesce(nullif(v_truong ->> 'sdt_cty', ''),     nullif(v_giu.sdt_cty, ''),     nullif(v_gop.sdt_cty, '')),
    email_cty     = coalesce(nullif(v_truong ->> 'email_cty', ''),   nullif(v_giu.email_cty, ''),   nullif(v_gop.email_cty, '')),
    notes = trim(both e'\n' from concat_ws(e'\n',
      coalesce(nullif(v_truong ->> 'notes', ''), nullif(v_giu.notes, '')),
      concat_ws(' · ',
        '— Đã gộp hồ sơ trùng: ' || v_gop.full_name,
        nullif(v_gop.primary_phone, ''),
        nullif(v_gop.address, ''),
        nullif(v_gop.notes, ''))
    )),
    updated_at = now()
  where id = p_giu;

  -- 4) SĐT không được chọn làm số chính -> lưu thành SĐT PHỤ thay vì vứt.
  --    Bỏ qua số khách đã có (kể cả số vừa dời từ bản bị gộp ở bước 1).
  for v_muc in select * from jsonb_array_elements(coalesce(p_chon -> 'sdt_phu', '[]'::jsonb))
  loop
    if nullif(v_muc ->> 'phone', '') is not null
       and not exists (
         select 1 from customer_contacts
         where customer_id = p_giu and phone = v_muc ->> 'phone'
       )
       and coalesce(nullif(v_muc ->> 'phone', ''), '') <> coalesce(v_phone_cuoi, '')
    then
      insert into customer_contacts (customer_id, phone, contact_name, role, is_primary, zalo_ok)
      values (
        p_giu,
        v_muc ->> 'phone',
        nullif(v_muc ->> 'contact_name', ''),
        coalesce(nullif(v_muc ->> 'role', ''), 'khac'),
        false,
        true
      );
      n_sdt_phu := n_sdt_phu + 1;
    end if;
  end loop;

  -- 5) Địa chỉ không được chọn làm địa chỉ chính -> lưu thành địa chỉ phụ có phân loại.
  for v_muc in select * from jsonb_array_elements(coalesce(p_chon -> 'dia_chi_them', '[]'::jsonb))
  loop
    if nullif(v_muc ->> 'dia_chi', '') is not null
       and not exists (
         select 1 from customer_addresses
         where customer_id = p_giu and dia_chi = v_muc ->> 'dia_chi'
       )
    then
      insert into customer_addresses (customer_id, dia_chi, loai, ghi_chu)
      values (
        p_giu,
        v_muc ->> 'dia_chi',
        coalesce(nullif(v_muc ->> 'loai', ''), 'khac'),
        nullif(v_muc ->> 'ghi_chu', '')
      );
      n_dia_chi := n_dia_chi + 1;
    end if;
  end loop;

  return jsonb_build_object('may', n_may, 'ticket', n_ticket, 'plan', n_plan,
                            'lien_he', n_lienhe, 'su_dung', n_sudung,
                            'sdt_phu_them', n_sdt_phu, 'dia_chi_them', n_dia_chi);
end $$;

comment on function gop_khach(uuid, uuid, jsonb) is
  'Gộp khách trùng: dời máy/ticket/plan/liên hệ/địa chỉ sang bản giữ, trộn trường theo lựa chọn của CS (p_chon), SĐT/địa chỉ thừa lưu thành phụ, ẩn mềm bản bị gộp. Nguyên tử.';

-- Cấp lại quyền: DROP ở đầu file đã xoá sạch GRANT của bản cũ.
revoke all on function gop_khach(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function gop_khach(uuid, uuid, jsonb) to service_role;
