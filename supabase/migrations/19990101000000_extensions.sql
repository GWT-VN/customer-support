-- Extensions phải cài TRƯỚC baseline (dump db pull không kèm CREATE EXTENSION).
-- Prod đặt chúng ở schema public (functions/index tham chiếu "public".unaccent / "public".gin_trgm_ops).
create extension if not exists pg_trgm with schema public;
create extension if not exists unaccent with schema public;

-- Role tuỳ chỉnh của prod (FDW sang Masterdata) — baseline có GRANT tới nó.
-- Local không có FDW thật, chỉ cần role tồn tại để GRANT không lỗi.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'fdw_masterdata') then
    create role fdw_masterdata nologin;
  end if;
end $$;
