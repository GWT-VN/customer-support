-- ma_kh trở thành KHOÁ của hai bảng vệ tinh (SĐT phụ + địa chỉ phụ) — 22/08/2026
--
-- Vì sao: CEO yêu cầu màn tạo/sửa khách bên Sales giống hệt CSKH, kể cả SĐT phụ và địa chỉ phụ.
-- Nhưng `customer_contacts` / `customer_addresses` đang khoá cứng vào `cs_customers(id)`, mà chỉ
-- 127/421 khách Sales có hồ sơ CS ⇒ 294 khách Sales không có đường nào ghi SĐT phụ.
--
-- Phiên Sales đề xuất khoá đôi (`customer_id` HOẶC `ma_kh`, CHECK đúng một trong hai). KHÔNG dùng
-- CHECK đó: với 142 người có mặt ở CẢ hai bảng, CS sẽ ghi bằng `customer_id` còn Sales ghi bằng
-- `ma_kh` ⇒ cùng một người, hai kho, hai bên không thấy SĐT phụ của nhau. Đó đúng là thứ việc này
-- sinh ra để tránh.
--
-- Làm thay: MỘT khoá duy nhất là `ma_kh`. `customer_id` giữ lại nhưng thành di sản (nullable),
-- bỏ hẳn ở chặng B khi bảng khách hợp nhất.
--
-- ĐÂY LÀ LÚC RẺ NHẤT ĐỂ ĐỔI: đo prod 22/08, `customer_contacts` có **0 dòng**,
-- `customer_addresses` có **2 dòng**. Để tới lúc có vài nghìn dòng thì đổi khoá là việc khác hẳn.

-- ── 1. Thêm khoá mới, đổ dữ liệu, rồi mới siết ──────────────────────────────────────────────
alter table public.customer_contacts  add column if not exists ma_kh text;
alter table public.customer_addresses add column if not exists ma_kh text;

update public.customer_contacts c
   set ma_kh = k.ma_kh
  from public.cs_customers k
 where k.id = c.customer_id and c.ma_kh is null;

update public.customer_addresses a
   set ma_kh = k.ma_kh
  from public.cs_customers k
 where k.id = a.customer_id and a.ma_kh is null;

-- Không siết NOT NULL bằng niềm tin: nếu còn dòng nào chưa có mã thì DỪNG, để người xử lý.
-- (Bẫy đã trả giá ở repo này: lệnh chạy trót lọt, không báo lỗi, nhưng không làm gì.)
do $$
declare n_c int; n_a int;
begin
  select count(*) into n_c from public.customer_contacts  where ma_kh is null;
  select count(*) into n_a from public.customer_addresses where ma_kh is null;
  if n_c > 0 or n_a > 0 then
    raise exception 'Còn % liên hệ và % địa chỉ chưa có ma_kh — dừng, đừng siết NOT NULL khi chưa đủ.', n_c, n_a;
  end if;
end $$;

alter table public.customer_contacts  alter column ma_kh set not null;
alter table public.customer_addresses alter column ma_kh set not null;

-- `customer_id` xuống hàng di sản: Sales ghi bằng ma_kh nên không có id để điền.
alter table public.customer_contacts  alter column customer_id drop not null;
alter table public.customer_addresses alter column customer_id drop not null;

create index if not exists ix_customer_contacts_ma_kh  on public.customer_contacts  (ma_kh);
create index if not exists ix_customer_addresses_ma_kh on public.customer_addresses (ma_kh);

comment on column public.customer_contacts.ma_kh is
  'KHOÁ CHÍNH THỨC. Không đặt FK được vì customers.ma_kh không unique (5 người trùng hồ sơ, cố ý) — dòng vệ tinh hiện trên cả hai hồ sơ trùng, đúng vì cùng một người.';
comment on column public.customer_contacts.customer_id is
  'DI SẢN — chỉ có với hồ sơ CS. Đọc bằng ma_kh. Bỏ cột này ở chặng B.';
comment on column public.customer_addresses.ma_kh is
  'KHOÁ CHÍNH THỨC. Xem chú thích ở customer_contacts.ma_kh.';
comment on column public.customer_addresses.customer_id is
  'DI SẢN — chỉ có với hồ sơ CS. Đọc bằng ma_kh. Bỏ cột này ở chặng B.';

-- ── 2. `ma_kh` phải là danh tính NGƯỜI, không phải mã của DÒNG ───────────────────────────────
-- Trước sửa: cap_ma_kh() chỉ lấy số kế tiếp, không tra SĐT. Hậu quả đo được trên prod: 142 người
-- có mặt ở cả hai bảng, 138 trùng mã nhưng **4 cặp lệch** — cùng người, cùng SĐT, hai mã khác
-- nhau. Khoá dữ liệu vệ tinh vào một mã như thế là chia đôi hồ sơ ngay từ ngày đầu.
--
-- Sau sửa: chèn khách mới thì TRA SĐT (9 số cuối) sang bảng BÊN KIA trước; có rồi thì dùng lại
-- mã cũ, không cấp mã mới.
create or replace function public.tu_cap_ma_kh()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_phone text;
  v_p9    text;
  v_ma    text;
begin
  if new.ma_kh is not null then
    return new;
  end if;

  -- Hàm này gắn cho CẢ hai bảng, mà tên cột SĐT khác nhau (primary_phone vs phone).
  -- Đi qua jsonb để không phải viết hai nhánh đọc cột.
  v_phone := coalesce(to_jsonb(new) ->> 'primary_phone', to_jsonb(new) ->> 'phone', '');
  v_p9    := right(regexp_replace(v_phone, '\D', '', 'g'), 9);

  if length(v_p9) = 9 then
    if TG_TABLE_NAME = 'cs_customers' then
      select c.ma_kh into v_ma from public.customers c
       where c.ma_kh is not null
         and right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 9) = v_p9
       limit 1;
      -- cs_customers.ma_kh CÓ unique index. Nếu mã bên kia đã có người ở bảng này giữ thì
      -- dùng lại là vi phạm khoá — thà cấp mã mới còn hơn chèn hỏng.
      if v_ma is not null and exists (select 1 from public.cs_customers k where k.ma_kh = v_ma) then
        v_ma := null;
      end if;
    else
      select k.ma_kh into v_ma from public.cs_customers k
       where k.ma_kh is not null
         and k.trang_thai <> 'da_xoa'
         and right(regexp_replace(coalesce(k.primary_phone, ''), '\D', '', 'g'), 9) = v_p9
       limit 1;
    end if;
  end if;

  new.ma_kh := coalesce(v_ma, cap_ma_kh(current_date));
  return new;
end $function$;

comment on function public.tu_cap_ma_kh() is
  'Cấp ma_kh khi chèn khách. TRA SĐT sang bảng bên kia trước — cùng một người ở hai bảng phải cùng một mã, nếu không dữ liệu vệ tinh (SĐT phụ, địa chỉ phụ) tách làm đôi.';

-- ── 3. gop_khach: gộp hồ sơ phải kéo theo cả dòng vệ tinh khoá bằng ma_kh ────────────────────
-- Bản cũ chỉ re-point theo `customer_id`. Dòng do Sales ghi KHÔNG có customer_id, chỉ có ma_kh,
-- nên gộp xong chúng vẫn dính mã của hồ sơ đã bị xoá — tra ra rỗng, không lỗi, không ai biết.
-- Phần dedupe trong hai vòng lặp cũng phải đi bằng ma_kh, nếu không sẽ chèn trùng.

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
  -- ĐỔI 22/08: re-point theo CẢ customer_id lẫn ma_kh. Dòng do Sales ghi không có customer_id
  -- (khách Sales không có hồ sơ CS), chỉ có ma_kh — bản cũ bỏ sót hẳn nhóm đó: gộp xong SĐT phụ
  -- vẫn dính mã của hồ sơ đã chết ⇒ BIẾN MẤT khỏi màn hình mà không báo lỗi nào.
  update customer_contacts set customer_id = p_giu, ma_kh = v_giu.ma_kh
   where customer_id = p_gop or ma_kh = v_gop.ma_kh;
  get diagnostics n_lienhe = row_count;
  update serial_su_dung    set customer_id = p_giu where customer_id = p_gop;
  get diagnostics n_sudung = row_count;
  update customer_addresses set customer_id = p_giu, ma_kh = v_giu.ma_kh
   where customer_id = p_gop or ma_kh = v_gop.ma_kh;

  v_phone_cuoi := coalesce(
    nullif(v_truong ->> 'primary_phone', ''),
    nullif(v_giu.primary_phone, ''),
    nullif(v_gop.primary_phone, '')
  );

  update cs_customers set
    trang_thai = 'da_xoa',
    primary_phone = null,
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
         where ma_kh = v_giu.ma_kh and phone = v_muc ->> 'phone'
       )
       and coalesce(nullif(v_muc ->> 'phone', ''), '') <> coalesce(v_phone_cuoi, '')
    then
      insert into customer_contacts (customer_id, ma_kh, phone, contact_name, role, is_primary, zalo_ok, ghi_chu)
      values (
        p_giu, v_giu.ma_kh, v_muc ->> 'phone', nullif(v_muc ->> 'contact_name', ''),
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
         where ma_kh = v_giu.ma_kh and dia_chi = v_muc ->> 'dia_chi'
       )
    then
      insert into customer_addresses (customer_id, ma_kh, dia_chi, loai, ghi_chu, tinh)
      values (
        p_giu, v_giu.ma_kh, v_muc ->> 'dia_chi',
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
end $$;

revoke all on function gop_khach(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function gop_khach(uuid, uuid, jsonb) to service_role;
