-- ============================================================================
-- work_09_chip_khong_nhan_doi.sql — chặn chip nhân đôi (2026-08-22)
--
-- Lỗi NGẦM trong work_07/08, chưa lộ nên chưa ai thấy: `work.link_json` nối
-- `public.cs_customers` bằng `customer_code`. Nếu bảng đó có hai dòng cùng mã
-- thì LEFT JOIN nhân đôi hàng, và `jsonb_agg` đẻ ra HAI chip y hệt cho cùng một
-- khách. Người dùng gỡ một cái thì cái kia vẫn còn — nhìn như phần mềm hỏng.
--
-- Đo trên production 22/08, bốn khoá mà link_json nối:
--   public.customers.customer_code   UNIQUE  ✅ (customers_customer_code_key —
--                                     bắt buộc phải có, Apps Script sync bằng
--                                     upsert on_conflict nên PostgREST đòi)
--   public.tickets.ticket_code       UNIQUE  ✅
--   public.sales_orders.order_code   UNIQUE  ✅
--   public.cs_customers.customer_code  KHÔNG có unique constraint lẫn index ❌
--
-- Hôm nay `cs_customers` đang 0 trùng, nhưng KHÔNG AI CANH — không ràng buộc thì
-- một lần nạp lỗi là có trùng, và khu Việc hỏng theo mà không ai nối được nhân quả.
--
-- KHÔNG tự đặt unique index lên `cs_customers`: bảng đó của khu CSKH, và đặt
-- ràng buộc lên bảng người khác mà không hỏi đúng là thứ SYSTEM.md §7.1 cấm.
-- Nên khu Việc tự phòng thân trong hàm của mình.
--
-- Chỉ đổi ĐÚNG một join thành lateral limit 1. Ba join kia giữ nguyên vì chúng
-- đã có ràng buộc thật — bọc thêm chỉ làm câu truy vấn khó đọc mà không mua thêm
-- gì. `order by id` để nếu có trùng thì ít ra chọn ổn định, không nhảy qua lại
-- giữa hai lần đọc.
-- ============================================================================

create or replace function work.link_json(p_task_id bigint)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(j order by j->>'loai', j->>'ma'), '[]'::jsonb)
  from (
    select case
      when l.customer_code is not null or l.customer_id is not null then jsonb_build_object(
        'id', l.id, 'loai', 'khach',
        'ma', coalesce(l.customer_code, l.customer_id::text),
        'nhan', coalesce(sc.name, cc.full_name, ci.full_name),
        'nhan_luc_gan', l.nhan_luc_gan,
        'phu',  coalesce(sc.phone, cc.primary_phone, ci.primary_phone),
        'dich', case when sc.customer_code is not null then 'sales'
                     when coalesce(cc.id, ci.id) is not null then 'cs' end,
        'khach_id', coalesce(cc.id, ci.id))
      when l.ticket_code is not null then jsonb_build_object(
        'id', l.id, 'loai', 'ticket', 'ma', l.ticket_code,
        'nhan', nullif(btrim(coalesce(tk.ticket_type, '')), ''),
        'nhan_luc_gan', l.nhan_luc_gan,
        'phu',  left(coalesce(nullif(btrim(tk.description),''), tk.state), 60),
        'dich', null, 'khach_id', null)
      else jsonb_build_object(
        'id', l.id, 'loai', 'don', 'ma', l.order_code,
        'nhan', so.customer_name,
        'nhan_luc_gan', l.nhan_luc_gan,
        'phu',  nullif(to_char(so.order_date, 'DD/MM/YYYY'), ''),
        'dich', null, 'khach_id', null)
    end as j
    from work.task_link l
    left join public.customers sc on sc.customer_code = l.customer_code
    -- Chỉ join này cần bọc: cs_customers.customer_code không có ràng buộc unique.
    left join lateral (
      select c.id, c.full_name, c.primary_phone
      from public.cs_customers c
      where l.customer_code is not null and c.customer_code = l.customer_code
      order by c.id
      limit 1
    ) cc on true
    left join public.cs_customers ci on ci.id          = l.customer_id
    left join public.tickets      tk on tk.ticket_code = l.ticket_code
    left join public.sales_orders so on so.order_code  = l.order_code
    where l.task_id = p_task_id
      and l.link_type in ('khach','ticket','don')
  ) x;
$$;

-- work_gan_erp cũng đọc cs_customers theo mã, nhưng ở đó là `select … into` —
-- plpgsql lấy dòng đầu, không ném lỗi. Không nhân đôi được, nên để nguyên.

notify pgrst, 'reload schema';
