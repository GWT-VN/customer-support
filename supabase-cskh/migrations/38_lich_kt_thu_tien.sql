-- 38 — Lịch kỹ thuật: thêm loại việc "Cần thu tiền" (+ số tiền) và cột số tiền.
-- (Mã QR chuyển khoản kèm code job -> làm sau.)

alter table lich_ky_thuat_viec add column if not exists so_tien bigint;

alter table lich_ky_thuat_viec drop constraint if exists lich_ky_thuat_viec_loai_viec_check;
alter table lich_ky_thuat_viec add constraint lich_ky_thuat_viec_loai_viec_check
  check (loai_viec in ('lap_may', 'bao_tri', 'ticket', 'thay_loi', 'khao_sat', 'thu_tien', 'khac'));

comment on column lich_ky_thuat_viec.so_tien is 'Số tiền cần thu (VND) khi loai_viec=thu_tien.';
