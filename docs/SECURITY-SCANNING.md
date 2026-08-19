# Quét Secret / PII (chống lọt dữ liệu nhạy cảm vào Git)

Hai lớp bảo vệ dùng chung 1 script: `scripts/scan_pii_secrets.py` (chỉ stdlib Python, không cần cài gì).

## 1. Pre-commit hook (chặn tại máy, trước khi commit)

Cài 1 lần sau khi clone:

```bash
bash scripts/setup-hooks.sh
```

Lệnh này đặt `core.hooksPath=.githooks`. Từ đó mỗi `git commit` sẽ quét **các file đang staged**.
Nếu phát hiện secret/PII → commit bị chặn, in rõ file:dòng.

## 2. CI (GitHub Actions — chặn tại PR/push)

`.github/workflows/ci.yml` chạy 2 job:
- **secret-pii-scan** — quét các file **thay đổi** (diff PR `base...head`, hoặc commit hiện tại khi push).
  Chỉ soi thay đổi mới → không fail vì PII cũ đã tồn tại trong repo (xem "Nợ cũ" bên dưới).
- **quality** — `tsc --noEmit` + `npm run lint` + `npm run test` trong `apps/web/`.

## Script bắt gì

| Loại | Mẫu |
|---|---|
| **BLOCKED PATH** | `docs/CHECKLIST.md` (có PII), mọi `.env*` trừ `.env.example`, `*.env.migrate` |
| **SECRET** | Supabase **service_role** JWT (giải mã payload, chỉ chặn `role=service_role` — **không** chặn anon), `SUPABASE_SERVICE_ROLE_KEY=<giá trị giống key>`, `sb_secret_*`, khối `PRIVATE KEY` |
| **PII** | Số điện thoại VN `0[35789]xxxxxxxx` (số giả `0900000000` được bỏ qua) |

Bỏ qua false-positive:
- Thêm chú thích **`pii-ok`** hoặc **`allowlist-secret`** vào cuối dòng đó.
- Ext nhị phân / lockfile / `.svg` / `.map` và thư mục `node_modules` `.next` `.venv` tự động bỏ qua.
- Bỏ qua 1 lần (tự chịu trách nhiệm): `git commit --no-verify`.

Chạy tay:
```bash
python3 scripts/scan_pii_secrets.py --staged            # file staged
python3 scripts/scan_pii_secrets.py $(git ls-files)     # toàn bộ repo (audit đầy đủ)
python3 scripts/scan_pii_secrets.py path/to/file        # file cụ thể
```

## Nợ cũ (PII đã nằm sẵn trong repo)

Các file sau **đã commit** kèm PII/ví dụ thật (được "grandfather" — CI chỉ soi thay đổi mới nên không fail):
`docs/CHECKLIST.md`, `migrate/contacts.py` (comment), `migrate/parse.py`,
`migrate/tests/*` (fixtures), `docs/plans/2026-07-12-…phase0.md`.

Muốn dọn sạch cần **sửa các file tracked** (và cân nhắc rewrite history nếu phải xoá triệt để) —
việc này đụng nhiều file nên làm riêng, phối hợp để tránh xung đột với phiên phát triển song song.
Chạy `python3 scripts/scan_pii_secrets.py $(git ls-files)` để xem danh sách đầy đủ khi bắt tay dọn.
