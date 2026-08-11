-- 27_cs_channel.sql
-- D2 — Gắn khách CSKH vào KÊNH/đối tác (đại lý/KTS/KOL) dùng CHUNG dim_channel của
-- Sales (không tự đẻ bảng riêng — user chốt 2026-08-11). CS chỉ ĐỌC dim_channel +
-- gán khách; taxonomy do Sales quản.
--
-- Fresh-safe: nếu bảng doi_tac (bản nháp trước) còn tồn thì chuyển 4 nhãn cũ sang
-- channel_id rồi drop; DB mới không có doi_tac thì bỏ qua khối đó.

alter table public.cs_customers
  add column if not exists channel_id integer references public.dim_channel(id) on delete set null;

create index if not exists cs_customers_channel_id_idx on public.cs_customers(channel_id);

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'doi_tac') then
    update public.cs_customers c
    set channel_id = dc.id
    from public.doi_tac dt
    join public.dim_channel dc
      on (dt.ten = 'Hải Nam (24H)'               and dc.channel_l1 = 'Đại lý' and dc.channel_l2 = 'Hải Nam')
      or (dt.ten = 'Clean Water Solutions (CWS)' and dc.channel_l1 = 'Đại lý' and dc.channel_l2 = 'CWS')
    where c.doi_tac_id = dt.id and c.channel_id is null;

    alter table public.cs_customers drop column if exists doi_tac_id;
    drop table public.doi_tac;
  end if;
end $$;
