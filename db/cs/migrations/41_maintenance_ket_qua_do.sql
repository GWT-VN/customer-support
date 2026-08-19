-- 41 — Đợt 4: kết quả đo nước khi bảo trì (trước/sau lọc) + ghi chú.
-- TDS, pH, Độ cứng, Clo dư — mỗi chỉ tiêu 2 giá trị (trước lọc / sau lọc). Ảnh: làm sau (Storage).

alter table maintenance_visit
  add column if not exists tds_truoc numeric, add column if not exists tds_sau numeric,
  add column if not exists ph_truoc numeric, add column if not exists ph_sau numeric,
  add column if not exists do_cung_truoc numeric, add column if not exists do_cung_sau numeric,
  add column if not exists clo_truoc numeric, add column if not exists clo_sau numeric,
  add column if not exists ket_qua_ghi_chu text;

comment on column maintenance_visit.tds_truoc is 'TDS trước lọc (ppm) khi bảo trì.';
comment on column maintenance_visit.tds_sau is 'TDS sau lọc (ppm) khi bảo trì.';
