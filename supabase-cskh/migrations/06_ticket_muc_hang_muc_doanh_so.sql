-- 06 — Phần 1 (2026-07-29): gộp Thu phí + Vật tư -> "hạng mục" (bắt buộc chọn từ
-- catalog_item, đã có sẵn DVSC/DVLD/DVBT/DVVC) + view doanh số CSKH.
-- ticket_muc đang trống nên đổi ràng buộc không mất dữ liệu.

alter table public.ticket_muc add column if not exists catalog_code text;
alter table public.ticket_muc add column if not exists so_luong integer not null default 1;
comment on column public.ticket_muc.catalog_code is
  'Mã nội bộ catalog_item (hạng mục thu phí/vật tư) — không FK vì catalog là bảng gương truncate+reload.';

update public.ticket_muc set loai='hang_muc' where loai in ('thu_phi','vat_tu');
alter table public.ticket_muc drop constraint if exists ticket_muc_loai_check;
alter table public.ticket_muc add constraint ticket_muc_loai_check check (loai in ('hang_muc','doi_may'));

create or replace view public.v_doanh_so_cskh as
select date_trunc('month', tm.created_at)::date as thang,
       tm.catalog_code,
       ci."Tên ngắn gọn (đề xuất)" as ten_hang_muc,
       ci."Danh mục cấp 1" as danh_muc,
       count(*) as so_luot,
       sum(tm.so_luong) as tong_so_luong,
       sum(tm.so_tien) as tong_tien
from public.ticket_muc tm
left join public.catalog_item ci on ci."Mã nội bộ" = tm.catalog_code
where tm.tinh_phi = true and tm.loai = 'hang_muc'
group by 1, 2, 3, 4
order by 1 desc, 7 desc nulls last;
