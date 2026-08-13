-- 39 — Lịch kỹ thuật: thêm trường Tỉnh/TP cho địa chỉ chuyến đi (chọn từ dropdown).

alter table lich_ky_thuat add column if not exists tinh text;
comment on column lich_ky_thuat.tinh is 'Tỉnh/TP của địa chỉ chuyến đi (chọn từ dropdown).';
