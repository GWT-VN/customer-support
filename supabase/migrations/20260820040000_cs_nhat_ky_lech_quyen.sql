-- Nhật ký LỆCH quyền — cơ chế dò sai của GĐ2 (chạy song song).
--
-- GĐ2 KHÔNG đổi quyền của ai: luật quyết định vẫn là laAdmin()/laQuanLy() cũ.
-- Ma trận chỉ được HỎI Ý KIẾN; khi nó nói khác luật cũ thì ghi một dòng vào đây.
-- CEO xem tab "Lệch", chỉnh ma trận cho tới khi im lặng, rồi mới bật thật ở GĐ3.
--
-- Gộp theo (người, quyền, cũ, mới) thay vì ghi mỗi lần một dòng: một nhân viên
-- kỹ thuật mở app là bắn ra hàng trăm lượt lệch giống hệt nhau, ghi thô thì bảng
-- phình và CEO không đọc nổi.

create table if not exists public.nhat_ky_lech_quyen (
  id        bigserial primary key,
  staff_id  uuid references public.staff(id) on delete cascade,
  email     text,
  ma_quyen  text not null,
  luat_cu   boolean not null,
  ma_tran   boolean not null,
  so_lan    integer not null default 1,
  lan_dau   timestamptz not null default now(),
  lan_cuoi  timestamptz not null default now(),
  unique (staff_id, ma_quyen, luat_cu, ma_tran)
);

alter table public.nhat_ky_lech_quyen enable row level security;
-- 0 policy: chỉ service_role (đã qua gác cổng tầng app) đọc/ghi được.

comment on table public.nhat_ky_lech_quyen is
  'GĐ2: ma trận quyền nói khác luật cũ ở đâu. Gộp theo (người, quyền, cũ, mới).';

/**
 * Ghi một lượt lệch, gộp vào dòng sẵn có nếu đã gặp.
 *
 * Làm bằng RPC chứ không phải upsert từ app: cần TĂNG so_lan, mà PostgREST upsert
 * chỉ ghi đè được chứ không cộng dồn.
 */
create or replace function public.nen_tang_ghi_lech_quyen(
  p_staff_id uuid,
  p_email    text,
  p_ma_quyen text,
  p_luat_cu  boolean,
  p_ma_tran  boolean
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.nhat_ky_lech_quyen (staff_id, email, ma_quyen, luat_cu, ma_tran)
  values (p_staff_id, p_email, p_ma_quyen, p_luat_cu, p_ma_tran)
  on conflict (staff_id, ma_quyen, luat_cu, ma_tran) do update
    set so_lan = public.nhat_ky_lech_quyen.so_lan + 1,
        lan_cuoi = now(),
        email = excluded.email;
$$;

revoke all on function public.nen_tang_ghi_lech_quyen(uuid, text, text, boolean, boolean) from public;
revoke all on function public.nen_tang_ghi_lech_quyen(uuid, text, text, boolean, boolean) from anon, authenticated;
