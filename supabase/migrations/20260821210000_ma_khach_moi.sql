-- cs+sales — MÃ KHÁCH MỚI `KH-YYMM-NNNN`, cấp cho MỌI khách (21/08/2026)
--
-- CEO chốt 21/08/2026: dùng MỘT hệ mã mới, trong mã có **2 số tháng + số chạy**, cấp cho **mọi
-- khách**, chỉ hiện ở **hồ sơ khách**.
--
-- Dạng `KH-YYMM-NNNN` bám đúng khuôn mã đang dùng trong nhà: ticket là `TK-2608-003`
-- (`TK-YYMM-NNN`, số chạy reset theo tháng). Nhân viên đọc hai loại mã theo cùng một cách.
-- Dùng 4 số chạy thay vì 3 vì đợt cấp bù này đổ hàng trăm khách vào cùng một tháng.
--
-- ⚠️ KHÔNG ĐỤNG `customer_code` CŨ. Đo prod 21/08: mã cũ (`KH0xxxx`, do Apps Script cấp) đang
-- nối **833 dòng `customer_purchases`** với khách, 0 dòng mồ côi, và `sales_orders` còn một
-- KHOÁ NGOẠI trỏ vào nó. Đổi/xoá mã cũ là **đứt lịch sử mua mà KHÔNG báo lỗi** (bảng đó không
-- có khoá ngoại nên chỉ lặng lẽ tra ra rỗng), rồi lần sync kế tiếp Apps Script ghi đè lại.
-- ⇒ Mã cũ giữ nguyên làm mã tham chiếu Sheet. Mã mới là cột RIÊNG, chạy song song.
--
-- Khoá NỐI giữa hai khu vẫn là **SĐT** (CEO chốt), không phải mã. Mã mới chỉ để người đọc/gọi tên.

alter table public.cs_customers add column if not exists ma_kh text;
alter table public.customers    add column if not exists ma_kh text;

comment on column public.cs_customers.ma_kh is
  'Mã khách KH-YYMM-NNNN (hệ mã mới, CEO chốt 21/08/2026). Chỉ để đọc/gọi tên; KHOÁ NỐI hai khu là SĐT. Khác customer_code (mã cũ Apps Script, dùng nối customer_purchases).';
comment on column public.customers.ma_kh is
  'Mã khách KH-YYMM-NNNN (hệ mã mới, CEO chốt 21/08/2026). Cùng một người ở hai bảng thì mang CÙNG mã này (khớp theo 9 số cuối SĐT).';

-- ── Bộ cấp mã: MỘT nguồn phát số cho cả hai khu ────────────────────────────
-- Đếm max theo tiền tố tháng trên CẢ HAI bảng rồi +1. Khoá tư vấn ở cấp giao dịch để hai
-- người bấm "Tạo khách" cùng lúc (một bên CS, một bên Sales) không cùng lấy một số.
create or replace function public.cap_ma_kh(p_ngay date default current_date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := 'KH-' || to_char(p_ngay, 'YYMM') || '-';
  v_stt    int;
begin
  perform pg_advisory_xact_lock(hashtext('cap_ma_kh'));
  select coalesce(max(nullif(regexp_replace(ma_kh, '^.*-', ''), '')::int), 0) + 1
    into v_stt
    from (
      select ma_kh from cs_customers where ma_kh like v_prefix || '%'
      union all
      select ma_kh from customers    where ma_kh like v_prefix || '%'
    ) t;
  return v_prefix || lpad(v_stt::text, 4, '0');
end $$;

comment on function public.cap_ma_kh(date) is
  'Cấp mã khách mới KH-YYMM-NNNN. Cả CSKH lẫn Sales gọi chung hàm này — một nguồn phát số duy nhất thì hai khu tạo khách cùng lúc cũng không đụng mã.';

-- ── Cấp bù cho khách đã có ─────────────────────────────────────────────────
-- Tháng trong mã lấy theo tháng khách VÀO hệ thống, không phải tháng chạy migration — để mã
-- đọc lên là biết khách có từ bao giờ. CS: `created_at`. Sales: `first_order_date` (không có
-- thì lùi về `synced_at`).
-- Cùng một người ở hai bảng (khớp 9 SỐ CUỐI SĐT) phải mang CÙNG một mã, nếu không thì mã mới
-- lại đẻ ra đúng vấn đề nó sinh ra để giải quyết.
do $$
declare
  r record;
  v_ma text;
begin
  for r in
    with nguoi as (
      select
        nullif(right(regexp_replace(coalesce(primary_phone,''), '\D', '', 'g'), 9), '') as cuoi9,
        'cs'::text as ben, id::text as khoa,
        coalesce(created_at::date, current_date) as ngay_vao
      from cs_customers where ma_kh is null
      union all
      select
        nullif(right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 9), ''),
        'sales', customer_code,
        coalesce(first_order_date::date, synced_at::date, current_date)
      from customers where ma_kh is null
    ),
    -- Gom theo SĐT; khách không có SĐT thì mỗi dòng là một người riêng.
    nhom as (
      select coalesce(cuoi9, ben || ':' || khoa) as nhom_khoa,
             min(ngay_vao) as ngay_vao
        from nguoi group by 1
    )
    select nhom_khoa, ngay_vao from nhom order by ngay_vao, nhom_khoa
  loop
    v_ma := cap_ma_kh(r.ngay_vao);

    update cs_customers set ma_kh = v_ma
     where ma_kh is null
       and coalesce(
             nullif(right(regexp_replace(coalesce(primary_phone,''), '\D','','g'), 9), ''),
             'cs:' || id::text
           ) = r.nhom_khoa;

    update customers set ma_kh = v_ma
     where ma_kh is null
       and coalesce(
             nullif(right(regexp_replace(coalesce(phone,''), '\D','','g'), 9), ''),
             'sales:' || customer_code
           ) = r.nhom_khoa;
  end loop;
end $$;

-- Ràng buộc duy nhất: CHỈ đặt ở `cs_customers`, KHÔNG đặt ở `customers`.
--
-- Lần chạy prod đầu tiên đổ ở đúng chỗ này (`KH-2608-0087 is duplicated`) và nó chỉ ra một sự
-- thật của dữ liệu chứ không phải lỗi thiết kế: `ma_kh` cấp theo NGƯỜI (gom theo 9 số cuối SĐT),
-- mà bảng `customers` đang có **5 người bị tạo TRÙNG hồ sơ — 10 dòng** (cùng tên, cùng SĐT, cùng
-- tỉnh, mỗi hồ sơ 1 đơn; đo prod 22/08/2026). Năm người đó dùng chung 1 mã cho 2 dòng là ĐÚNG.
-- Ép duy nhất trong bảng thì buộc phải cấp cho cùng một người HAI mã khác nhau — đúng cái sai mà
-- hệ mã này sinh ra để dẹp.
-- `cs_customers` không có ca trùng nào (0/356) và đã có màn Gộp khách trùng canh, nên giữ ràng buộc.
-- Khi 5 hồ sơ trùng bên Sales được gộp thì thêm ràng buộc cho `customers` sau.
create unique index if not exists uq_cs_customers_ma_kh on public.cs_customers (ma_kh) where ma_kh is not null;
create        index if not exists ix_customers_ma_kh    on public.customers    (ma_kh) where ma_kh is not null;

-- ── Tự cấp mã cho khách MỚI ────────────────────────────────────────────────
-- Không có phần này thì khách mới lặng lẽ thiếu mã, và mỗi ngày một nhiều:
--  · Sync từ Google Sheet CHÈN dòng mới cho khách mới, mà Apps Script không biết cột `ma_kh`;
--  · Unique index bên dưới là partial `where ma_kh is not null` — Postgres KHÔNG coi nhiều NULL
--    là trùng, nên không ràng buộc nào kêu lên.
-- Đặt ở TRIGGER chứ không ở tầng app: mọi đường ghi đều đi qua, kể cả sync và cả import tay,
-- không ai phải nhớ gọi hàm.
create or replace function public.tu_cap_ma_kh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ma_kh is null then
    new.ma_kh := cap_ma_kh(current_date);
  end if;
  return new;
end $$;

comment on function public.tu_cap_ma_kh() is
  'Trigger BEFORE INSERT: khách mới chưa có ma_kh thì tự cấp. Bịt lỗ khách vào qua sync Google Sheet (Apps Script không biết cột này) hoặc qua import tay.';

drop trigger if exists trg_tu_cap_ma_kh on public.cs_customers;
create trigger trg_tu_cap_ma_kh before insert on public.cs_customers
  for each row execute function public.tu_cap_ma_kh();

drop trigger if exists trg_tu_cap_ma_kh on public.customers;
create trigger trg_tu_cap_ma_kh before insert on public.customers
  for each row execute function public.tu_cap_ma_kh();
