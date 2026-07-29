-- ─────────────────────────────────────────────────────────────────────────────
-- Tìm kiếm tiếng Việt KHÔNG DẤU — phần dưới database.
--
-- Nguyên tắc: chuẩn hoá ở CẢ HAI ĐẦU. Cột trong DB có bản bỏ dấu sinh sẵn, và
-- từ khoá người dùng gõ cũng bỏ dấu bằng boDau() trong bang/timkiem.ts.
--
-- ⚠️ boDau() (TypeScript) và khong_dau() (SQL) PHẢI cho ra cùng một kết quả.
-- Lệch nhau là gõ ra rỗng mà không ai hiểu vì sao.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- unaccent() KHÔNG immutable (phụ thuộc dictionary hiện hành) nên không dùng
-- thẳng trong cột sinh sẵn/index được. Bọc lại với dictionary chỉ định rõ.
--
-- ⚠️ Chữ 'đ'/'Đ' (U+0111/U+0110) KHÔNG bỏ dấu được bằng unaccent, cũng KHÔNG
-- tách được bằng NFD ở phía JavaScript — phải thay tay ở cả hai nơi.
create or replace function public.khong_dau(t text)
returns text
language sql
immutable strict parallel safe
as $$
  select lower(replace(replace(public.unaccent('public.unaccent', t), 'đ', 'd'), 'Đ', 'D'))
$$;

comment on function public.khong_dau(text) is
  'Bo dau tieng Viet + ve chu thuong. IMMUTABLE de dung duoc trong cot sinh san va index.';


-- ── Mẫu áp cho từng bảng ─────────────────────────────────────────────────────
-- Thay <bang> / <cot> cho đúng dự án. Cột SINH SẴN tự tính lại mỗi khi dòng
-- đổi nên không bao giờ lệch pha với cột gốc; bỏ cột đi thì dữ liệu gốc vẫn nguyên.
--
--   alter table public.<bang>
--     add column if not exists <cot>_kd text
--       generated always as (public.khong_dau(<cot>)) stored;
--
--   create index if not exists idx_<bang>_<cot>_kd
--     on public.<bang> using gin (<cot>_kd gin_trgm_ops);
--
-- Ghép nhiều cột vào một cột tìm kiếm thì coalesce cho khỏi null nuốt cả dòng:
--
--   generated always as (
--     public.khong_dau(coalesce(dia_chi, '') || ' ' || coalesce(tinh, ''))
--   ) stored
--
-- Nếu tra qua VIEW, nhớ lộ cột _kd ra và coalesce ĐÚNG KHUÔN cột gốc. Sai chỗ
-- này thì có dòng hiện trên màn hình mà tìm không ra — rất khó phát hiện.


-- ── Vì sao index GIN trigram ─────────────────────────────────────────────────
-- gin_trgm_ops phục vụ được CẢ ilike LẪN regex (~, ~*), nên cùng một index dùng
-- cho khớp chuỗi con (serial, SĐT) lẫn khớp đầu từ (tên người) — xem mauDauTu().
