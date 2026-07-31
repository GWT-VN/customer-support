-- ══════════════════════════════════════════════════════════════════════════
-- 18 — v_may_kho: danh sách MÁY (có serial trong kho) + số serial còn kích hoạt được
-- Cho ô "chọn máy" ở form đăng ký BH. Lọc bỏ lõi ("Bộ lọc%") và vỏ ("Bộ vỏ%"/…-SHELL)
-- — chỉ hiện máy thật (máy lọc POU + thiết bị trung tâm POE…). Heuristic theo tên,
-- dễ chỉnh nếu sót/thừa.
-- con_lai = serial CHƯA kích hoạt BH (còn đăng ký được).
-- ══════════════════════════════════════════════════════════════════════════

create or replace view public.v_may_kho as
select s.internal_code,
       max(s.ten_noi_bo) as ten_noi_bo,
       count(*) filter (where coalesce(w.activated, false) = false) as con_lai,
       count(*) as tong
from public.serial_registry s
left join public.warranty w on w.serial = s.serial
where s.internal_code is not null
  and s.ten_noi_bo not ilike 'Bộ lọc%'
  and s.ten_noi_bo not ilike 'Bộ vỏ%'
  and s.internal_code not ilike '%-SHELL'
group by s.internal_code;
