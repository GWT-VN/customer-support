-- ⚠️ CHƯA ÁP — Đợt 2 của kho media (docs/plans/2026-08-13-kho-anh-google-drive.md).
-- Chỉ áp SAU KHI user đã:
--   1. Điền env Google Drive + MEDIA_CLEANUP_SECRET trên Vercel (app chạy được).
--   2. Lưu secret vào Vault:  select vault.create_secret('<secret>', 'media_cleanup_secret');
--   3. Cho biết domain production -> thay <DOMAIN-PRODUCTION> bên dưới rồi mới áp.
-- Xem docs/huong-dan-kho-anh-google-drive.md (Bước 5).
--
-- Mẫu tái dùng từ migration 13 (pg_cron + extensions.http + Vault-secret).

create extension if not exists http    with schema extensions;
create extension if not exists pg_cron;

create or replace function public.don_media()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  v_resp   extensions.http_response;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'media_cleanup_secret';
  if v_secret is null then
    raise exception 'Vault secret media_cleanup_secret chưa tồn tại';
  end if;

  v_resp := extensions.http((
    'POST',
    'https://<DOMAIN-PRODUCTION>/api/media/cleanup',
    array[ extensions.http_header('x-media-cleanup-secret', v_secret) ],
    null, null
  )::extensions.http_request);

  -- Route tự ghi audit_log chi tiết; ở đây chỉ trả kết quả cho lần gọi tay.
  return jsonb_build_object('status', v_resp.status, 'body', v_resp.content::jsonb);
end $$;

-- Tuần một lần là đủ (dữ liệu chỉ "quá 12 tháng" dần theo ngày):
-- 03:00 giờ VN thứ hai = 20:00 UTC chủ nhật.
select cron.schedule('media-cleanup-weekly', '0 20 * * 0', $$select public.don_media()$$);
