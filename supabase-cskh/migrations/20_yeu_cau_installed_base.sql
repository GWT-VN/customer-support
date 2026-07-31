-- ══════════════════════════════════════════════════════════════════════════
-- 20 — Mở yeu_cau_thay_doi cho MÁY ĐÃ LẮP (installed_base) + loại 'doi_serial'
-- Thao tác máy đã lắp (đều qua admin duyệt): xoá (về kho) / đổi khách / đổi serial.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.yeu_cau_thay_doi drop constraint if exists yeu_cau_thay_doi_doi_tuong_check;
alter table public.yeu_cau_thay_doi add constraint yeu_cau_thay_doi_doi_tuong_check
  check (doi_tuong in ('cs_customers','filter_replacement','customer_contacts','installed_base'));

alter table public.yeu_cau_thay_doi drop constraint if exists yeu_cau_thay_doi_loai_check;
alter table public.yeu_cau_thay_doi add constraint yeu_cau_thay_doi_loai_check
  check (loai in ('sua','xoa','doi_serial'));
