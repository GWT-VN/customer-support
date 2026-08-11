-- ══════════════════════════════════════════════════════════════════════════
-- 22 — bang_view: lưu cấu hình CỘT hiển thị của bảng (Đợt C — tuỳ chỉnh cột)
-- chu = email NV (view cá nhân) HOẶC 'chung' (mọi người thấy; chỉ admin lưu 'chung').
-- cot = mảng key cột theo thứ tự hiện. App ghi bằng service_role (RLS bật, 0 policy).
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.bang_view (
  id         uuid primary key default gen_random_uuid(),
  bang       text not null,
  ten        text not null,
  chu        text not null,          -- email | 'chung'
  cot        jsonb not null,         -- ["full_name","primary_phone",...]
  tao_boi    text,
  created_at timestamptz not null default now()
);
create index if not exists bang_view_idx on public.bang_view (bang, chu);
alter table public.bang_view enable row level security;
