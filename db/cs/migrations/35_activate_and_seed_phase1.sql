-- activate_and_seed (Phase 1): seed gói bảo trì từ dòng mua DVBT.
--
-- Phạm vi Phase 1 (đọc customer_purchases, CHƯA có sales_orders):
--  · MÁY (category_l2 POU/POE): KHÔNG seed ở đây — installed_base.serial là PK, máy
--    chưa có serial thì nằm ở luồng "chờ kích hoạt BH" (v_bh_cho_kich_hoat) sẵn có;
--    CS gắn serial lúc lắp rồi activate_warranty. Auto-seed máy = Phase 2 (có serial/đơn chuẩn).
--  · DVBT (đơn vị LẦN): -> maintenance_plan(loai_goi='hop_dong', tong_lan = quantity).
--  · CHỈ seed cho khách ĐÃ có trong cs_customers (khớp customer_code) — KHÔNG auto-tạo
--    khách Sales-only vào CS (giữ 2 tập khách riêng như đã chốt).
--
-- Idempotent theo source_folder = 'DVBT#'||purchase_line_id (mỗi dòng mua 1 gói, chạy lại không nhân đôi).
-- Mặc định p_dry_run=true: CHỈ liệt kê sẽ làm gì, KHÔNG ghi. Gọi p_dry_run=false mới ghi thật.
--
-- Ghi chú vận hành (2026-08-12): dry-run hiện trả 0 gói tạo — cả 7 dòng DVBT đều của
-- khách Sales-only chưa có trong cs_customers -> đúng thiết kế, không mutate gì.
create or replace function public.activate_and_seed(
  p_customer_code text default null,     -- null = mọi dòng DVBT; hoặc lọc 1 khách
  p_dry_run boolean default true
) returns table(customer_code text, order_code text, action text, chi_tiet text)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_lan int;
begin
  for r in
    select p.id, p.customer_code, p.order_code, p.quantity, cs.id as cs_id, cs.full_name
    from public.customer_purchases p
    left join public.cs_customers cs on cs.customer_code = p.customer_code
    where p.internal_code = 'DVBT'
      and (p_customer_code is null or p.customer_code = p_customer_code)
    order by p.customer_code, p.order_code, p.id
  loop
    customer_code := r.customer_code;
    order_code := r.order_code;
    v_lan := greatest(1, round(coalesce(r.quantity, 1))::int);

    if r.cs_id is null then
      action := 'bỏ qua';
      chi_tiet := 'khách chưa có trong CS (không auto-tạo)';
      return next; continue;
    end if;

    if exists (select 1 from public.maintenance_plan mp
               where mp.source_folder = 'DVBT#' || r.id::text) then
      action := 'bỏ qua';
      chi_tiet := 'đã seed trước đó (' || v_lan || ' lần)';
      return next; continue;
    end if;

    if not p_dry_run then
      insert into public.maintenance_plan
        (customer_id, source_folder, source_customer_name, loai_goi, tong_lan, ghi_chu, trang_thai)
      values
        (r.cs_id, 'DVBT#' || r.id::text, r.full_name, 'hop_dong', v_lan,
         'Seed tự động từ DVBT (đơn ' || coalesce(r.order_code, '?') || ')', 'dang_hoat_dong');
    end if;

    action := case when p_dry_run then 'SẼ TẠO' else 'ĐÃ TẠO' end;
    chi_tiet := 'gói bảo trì ' || v_lan || ' lần';
    return next;
  end loop;
end;
$$;

-- Khoá quyền gọi: chỉ service_role (app gate qua laAdmin trước khi gọi). Theo migration 16.
revoke all on function public.activate_and_seed(text, boolean) from public, anon, authenticated;
