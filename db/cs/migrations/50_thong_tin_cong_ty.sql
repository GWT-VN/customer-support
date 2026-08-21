-- 50 — thông tin công ty của khách: tên, MST, địa chỉ, SĐT, email.
--
-- CEO 20/08/2026: "Tách trường Tên công ty riêng để lưu tên cty chứ ko cho vào ghi
-- chú (để còn dễ xuất hoá đơn, làm hợp đồng với trường này, thêm cả SĐT cty, MST
-- cũng cần giữ lại, Email công ty)".
--
-- Đây KHÔNG phải nhu cầu tương lai — dữ liệu đã có sẵn và đang nằm sai chỗ. Đếm
-- trên production trước khi viết migration này: 73 khách có tên công ty và 71 có
-- MST nằm trong ô `notes`, dạng
--     'Công ty: CÔNG TY TNHH TẬP ĐOÀN Y KHOA BÁC TOẢN · MST: 3002296799 · nguồn DM_KHACH_CTY'
-- vào từ một đợt import DM_KHACH_CTY. MST nằm trong chuỗi chữ tự do thì không lọc,
-- không xuất hoá đơn, không đối chiếu được — nên phần 2 của file này gỡ chúng ra
-- đúng cột.
--
-- Vì sao địa chỉ công ty là CỘT ở đây chứ không phải một dòng trong customer_addresses
-- (mig 48): hoá đơn cần bộ ba tên + MST + địa chỉ đăng ký thuế đi LIỀN với nhau và
-- duy nhất. Để trong bảng nhiều dòng thì lúc xuất hoá đơn phải đoán "dòng cty nào
-- mới đúng" khi khách có 2 địa chỉ cùng loại. customer_addresses vẫn giữ nguyên vai
-- trò cho các địa chỉ khác (nhà thứ hai, kho, nơi lắp đặt).

alter table cs_customers
  add column if not exists ten_cty    text,
  add column if not exists mst        text,
  add column if not exists dia_chi_cty text,
  add column if not exists sdt_cty    text,
  add column if not exists email_cty  text;

comment on column cs_customers.ten_cty     is 'Tên công ty trên hoá đơn/hợp đồng.';
comment on column cs_customers.mst         is 'Mã số thuế — chuỗi, KHÔNG phải số: có mã 13 ký tự dạng 0123456789-001.';
comment on column cs_customers.dia_chi_cty is 'Địa chỉ đăng ký thuế của công ty (khác địa chỉ nhà ở cột address).';
comment on column cs_customers.sdt_cty     is 'SĐT công ty.';
comment on column cs_customers.email_cty   is 'Email công ty — nhận hoá đơn điện tử.';

-- Lọc theo MST khi đối chiếu hoá đơn; chỉ đánh index phần có dữ liệu.
create index if not exists idx_cs_customers_mst on cs_customers(mst) where mst is not null;

-- ── Phần 2: gỡ tên công ty + MST khỏi ô ghi chú ─────────────────────────────
-- Chỉ đụng dòng có ĐÚNG dấu vết của đợt import (`nguồn DM_KHACH_CTY`) và CHƯA có
-- ten_cty — chạy lại lần hai không làm gì thêm, cũng không đè lên số liệu người
-- dùng đã tự nhập.
update cs_customers set
  ten_cty = nullif(btrim(substring(notes from 'Công ty:\s*([^·]+)')), ''),
  mst     = nullif(btrim(substring(notes from 'MST:\s*([0-9][0-9-]*)')), '')
where notes like '%nguồn DM_KHACH_CTY%'
  and ten_cty is null;

-- Xoá mẩu vừa gỡ khỏi notes để không còn hai nguồn sự thật. Giữ nguyên phần ghi
-- chú thật người dùng gõ thêm (nếu có) ở trước/sau mẩu đó.
update cs_customers set
  notes = nullif(
            trim(both e' ·\n' from
              regexp_replace(
                notes,
                'Công ty:[^·]*(·\s*MST:[^·]*)?(·\s*nguồn DM_KHACH_CTY)?',
                '', 'g')), '')
where notes like '%nguồn DM_KHACH_CTY%'
  and ten_cty is not null;
