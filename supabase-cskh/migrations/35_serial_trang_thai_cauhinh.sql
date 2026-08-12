-- 35 — Cấu hình trạng thái máy (thay hằng số hardcode) + trạng thái "Thu hồi bảo hành"
--
-- Vì sao: 1 máy đi qua nhiều trạng thái; user cần TỰ cấu hình danh mục trạng thái
-- (thêm/sửa/đổi màu/thứ tự) thay vì sửa code. Ngoài ra tách rõ:
--   · bao_tri            = "Thu hồi bảo trì"  (thu hồi đơn thuần để bảo dưỡng)
--   · thu_hoi_bao_hanh   = "Thu hồi bảo hành" (đổi máy cho khách do lỗi BH)  <-- MỚI
--
-- ton_kho + da_lap là trạng thái HỆ THỐNG (he_thong=true): code phụ thuộc ngữ nghĩa
-- (tồn kho = sẵn lắp, đã lắp = đang ở khách) nên KHÔNG cho xoá/đổi mã, chỉ đổi nhãn/màu.
-- cho_dat_tay = có hiện trong ô "đặt trạng thái tay" cho máy chưa gắn khách hay không.

create table if not exists serial_trang_thai (
  code        text primary key,
  nhan        text not null,
  mau         text not null default 'slate',   -- token màu (map ra class ở app)
  thu_tu      int  not null default 100,
  he_thong    boolean not null default false,   -- true = khoá mã, không xoá được
  cho_dat_tay boolean not null default true,    -- hiện trong dropdown đặt tay
  hoat_dong   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table serial_trang_thai enable row level security;  -- 0 policy: chỉ service_role (dataClient)

insert into serial_trang_thai (code, nhan, mau, thu_tu, he_thong, cho_dat_tay) values
  ('ton_kho',          'Tồn kho',               'slate',   10, true,  true),
  ('da_lap',           'Đã lắp (khách)',        'emerald', 20, true,  false),
  ('trung_bay',        'Trưng bày',             'sky',     30, false, true),
  ('mkt',              'Marketing / Quay phim', 'violet',  40, false, true),
  ('kiem_dinh_nuoc',   'Kiểm định nước',        'cyan',    50, false, true),
  ('lap_test',         'Lắp test thử',          'indigo',  60, false, true),
  ('bao_tri',          'Thu hồi bảo trì',       'amber',   70, false, true),
  ('thu_hoi_bao_hanh', 'Thu hồi bảo hành',      'orange',  75, false, true),
  ('thanh_ly',         'Thanh lý',              'red',     80, false, true)
on conflict (code) do nothing;

comment on table serial_trang_thai is
  'Danh mục trạng thái máy (cấu hình được). he_thong=khoá mã; cho_dat_tay=hiện trong đặt-tay.';
