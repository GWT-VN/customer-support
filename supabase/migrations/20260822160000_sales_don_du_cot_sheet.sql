-- CEO chốt 22/08/2026: ưu tiên làm cho NHẬP ĐƯỢC ĐƠN THẬT TRÊN APP.
-- Đây là chặng A của docs/sales/LO-TRINH-BO-APPSCRIPT.md — muốn tắt Sheet thì trước
-- hết app phải có đủ chỗ điền mọi cột Sheet đang dùng.
--
-- Đối chiếu với `Code.gs`: CORE 22 cột + EXTRA.E (POE) + EXTRA.U (POU) + EXTRA.O.
-- Bỏ 'Đơn Eshop' theo CEO. 'Tháng báo cáo' không thêm — suy được từ ngày đơn.
--
-- ⚠️ Nhóm nhân khẩu của POE (nghề nghiệp, ngày sinh, giới tính, độ tuổi, loại nhà,
-- tình trạng nhà) đặt Ở ĐƠN, giống Sheet, KHÔNG đẩy sang bảng khách. Lý do: đây là
-- thứ khảo sát TẠI THỜI ĐIỂM lắp, một khách lắp hai lần có thể khai khác nhau; đẩy
-- sang khách là bản sau đè bản trước và mất dữ liệu khảo sát. Chặng B tính lại sau.

alter table public.sales_orders
  -- Chung mọi tab
  add column if not exists channel_detail        text,
  add column if not exists qua_tang              text,
  add column if not exists su_dung_qua_tang      text,
  add column if not exists tracking_url          text,
  add column if not exists kich_hoat_bh          boolean not null default false,
  add column if not exists email                 text,
  add column if not exists tien_coc              bigint,

  -- POU
  add column if not exists gui_hdsd              boolean not null default false,
  add column if not exists xuat_hoa_don          boolean not null default false,
  add column if not exists da_doi_soat           boolean not null default false,
  add column if not exists ngay_doi_soat         date,

  -- POE
  add column if not exists so_hd                 text,
  add column if not exists ten_goi_khach         text,
  add column if not exists ten_folder            text,
  add column if not exists ten_khach_theo_doi    text,
  add column if not exists tien_se_thu           bigint,
  add column if not exists bien_ban_xac_nhan     boolean not null default false,
  add column if not exists bao_cao_lap_dat       boolean not null default false,
  add column if not exists tien_do_lap_dat       text,
  add column if not exists ngay_hoan_thanh_lap   date,
  add column if not exists tu_dien               text,
  add column if not exists version               text,
  add column if not exists nghe_nghiep           text,
  add column if not exists ngay_sinh             date,
  add column if not exists gioi_tinh             text,
  add column if not exists do_tuoi               text,
  add column if not exists loai_nha              text,
  add column if not exists tinh_trang_nha        text,
  add column if not exists cong_ty_xuat_hd       text,
  add column if not exists mst                   text,
  add column if not exists dia_chi_xuat_hd       text;

-- 'Còn cần thu' — Sheet để công thức, ở đây để cột SINH, không cho nhập tay.
-- Nhập tay là sớm muộn lệch với tổng đơn mà không ai biết.
alter table public.sales_orders
  add column if not exists con_can_thu bigint
    generated always as (coalesce(total_vat, 0) - coalesce(tien_coc, 0)) stored;

comment on column public.sales_orders.tien_coc is
  'So tien khach da coc. Sheet POE goi "Tien coc da thu", POU goi "So tien da coc" — cung mot thu.';
comment on column public.sales_orders.con_can_thu is
  'Cot SINH = total_vat - tien_coc. KHONG nhap tay.';
comment on column public.sales_orders.kich_hoat_bh is
  'Da kich hoat bao hanh chua. Ho so bao hanh nam ben CSKH; day chi la co danh dau tren don.';
comment on column public.sales_orders.ngay_sinh is
  'Khao sat TAI THOI DIEM lap (POE). Khac customers.ngay_sinh — do la ho so khach.';
