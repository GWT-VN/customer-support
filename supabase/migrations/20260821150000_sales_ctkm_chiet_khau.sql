-- Module KHUYẾN MÃI & CHIẾT KHẤU — CEO duyệt bản vẽ 21/08/2026.
--
-- Vì sao KHÔNG để ở Masterdata: CEO chốt "chiết khấu thay đổi cập nhật và cần quản lý
-- version, ngày tháng có hiệu lực" -> quản lý hẳn trong app, có bản nháp / ban hành /
-- thay thế, tra lại được bản cũ.
--
-- Toàn bộ bảng dưới đây là bảng MỚI của khu Sales. Không đụng bảng dùng chung nào.

-- ══ 1. Bậc của đối tác ══════════════════════════════════════════════════════════
-- Chỉ đối tác đại lý mới có dòng ở đây. KHÔNG có dòng = khách lẻ (CEO chốt 21/08),
-- nên không phải nhập gì cho hàng trăm khách lẻ.
create table if not exists public.sales_bac_khach (
  id            uuid primary key default gen_random_uuid(),
  customer_code text not null,
  bac           text not null check (bac in ('NPP','DAI_LY','GIOI_THIEU')),
  hieu_luc_tu   date not null default current_date,
  hieu_luc_den  date,
  ghi_chu       text,
  tao_luc       timestamptz not null default now(),
  tao_boi       text
);
create index if not exists sales_bac_khach_ma_idx on public.sales_bac_khach(customer_code);
comment on table public.sales_bac_khach is 'Bậc đại lý của đối tác. KHÔNG có dòng = khách lẻ. Cấp 1 NPP · Cấp 2 Đại lý · Cấp 3 Giới thiệu.';

-- ══ 2. Chính sách giá theo bậc ══════════════════════════════════════════════════
-- Lưu CẢ `giam_pct` LẪN `gia_ban`, kèm `nhap_theo` ghi người dùng đã gõ ô nào.
-- Vì sao giữ cả hai: CEO nhập 1 ô, ô kia tự tính. Nếu chỉ lưu % rồi tính lại giá thì
-- làm tròn có thể lệch vài đồng so với con số CEO thấy lúc nhập; giữ cả hai thì con số
-- hiển thị luôn đúng thứ đã duyệt, còn `nhap_theo` cho biết ô nào là gốc.
create table if not exists public.sales_chinh_sach_gia (
  id            uuid primary key default gen_random_uuid(),
  bac           text not null check (bac in ('NPP','DAI_LY','GIOI_THIEU')),
  internal_code text not null,
  giam_pct      numeric,
  gia_ban       bigint,
  nhap_theo     text not null default 'PCT' check (nhap_theo in ('PCT','GIA')),
  hieu_luc_tu   date not null,
  hieu_luc_den  date,
  trang_thai    text not null default 'nhap' check (trang_thai in ('nhap','ban_hanh','thay_the')),
  ghi_chu       text,
  cap_nhat_luc  timestamptz not null default now(),
  check (giam_pct is not null or gia_ban is not null)
);
create index if not exists sales_csg_tra_idx on public.sales_chinh_sach_gia(bac, internal_code, hieu_luc_tu desc);
comment on table public.sales_chinh_sach_gia is 'Giá theo bậc đại lý, có hiệu lực theo thời gian. Bản cũ chuyển trang_thai = thay_the, KHÔNG xoá.';

-- ══ 3. Chương trình khuyến mãi (khách lẻ) ═══════════════════════════════════════
-- MỘT chương trình mang CẢ giảm giá LẪN quà — quà nằm ở bảng 6 vì một chương trình
-- có thể kèm nhiều món. Không phải tạo hai chương trình.
create table if not exists public.sales_ctkm (
  id             uuid primary key default gen_random_uuid(),
  ma             text unique,
  ten            text not null,
  mo_ta_khach    text,
  luu_y_noi_bo   text,
  tu_ngay        date not null,
  den_ngay       date,
  nhom_khach     text not null default 'TAT_CA' check (nhom_khach in ('TAT_CA','MOI','DA_MUA','CHI_DINH')),
  -- PCT = giảm %, TIEN = giảm số tiền, CON = chốt thẳng giá bán ("giảm còn ...")
  kieu_giam      text not null check (kieu_giam in ('PCT','TIEN','CON')),
  muc_chung      numeric,
  giam_toi_da    bigint,          -- chỉ có nghĩa với kieu_giam = 'PCT'
  don_toi_thieu  bigint not null default 0,
  sl_toi_thieu   integer not null default 1,
  trang_thai     text not null default 'nhap' check (trang_thai in ('nhap','ban_hanh','ket_thuc')),
  tao_luc        timestamptz not null default now(),
  tao_boi        text,
  cap_nhat_luc   timestamptz not null default now()
);
create index if not exists sales_ctkm_ngay_idx on public.sales_ctkm(tu_ngay, den_ngay) where trang_thai = 'ban_hanh';
comment on column public.sales_ctkm.kieu_giam is 'PCT = giảm % · TIEN = giảm số tiền · CON = chốt thẳng giá bán ("giảm còn"). CEO chốt 21/08/2026.';

-- ══ 4. Kênh áp dụng ═════════════════════════════════════════════════════════════
create table if not exists public.sales_ctkm_kenh (
  ctkm_id    uuid not null references public.sales_ctkm(id) on delete cascade,
  channel_id integer not null references public.dim_channel(id) on delete cascade,
  primary key (ctkm_id, channel_id)
);
comment on table public.sales_ctkm_kenh is 'Kênh được hưởng chương trình. Chọn 2 cấp trên giao diện, lưu channel_id của dim_channel.';

-- ══ 5. Sản phẩm trong chương trình ══════════════════════════════════════════════
-- `muc` để trống = dùng `sales_ctkm.muc_chung`. Có giá trị = mức riêng cho mã đó.
create table if not exists public.sales_ctkm_sp (
  ctkm_id       uuid not null references public.sales_ctkm(id) on delete cascade,
  internal_code text not null,
  muc           numeric,
  primary key (ctkm_id, internal_code)
);

-- ══ 6. Quà tặng kèm ═════════════════════════════════════════════════════════════
create table if not exists public.sales_ctkm_qua (
  id                uuid primary key default gen_random_uuid(),
  ctkm_id           uuid not null references public.sales_ctkm(id) on delete cascade,
  internal_code_qua text not null,
  so_luong          numeric not null default 1,
  gia_tri_quy_doi   bigint,
  dieu_kien         text
);
create index if not exists sales_ctkm_qua_ct_idx on public.sales_ctkm_qua(ctkm_id);
comment on column public.sales_ctkm_qua.gia_tri_quy_doi is 'Chỉ để tính chi phí chương trình. KHÔNG cộng vào tiền khách trả — dòng quà trên đơn tính 0 đ.';
