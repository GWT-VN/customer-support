-- 36 — Nền lịch bảo trì tự động (Đợt 1): ngày bắt đầu + vùng (quy tắc cuối tuần)
--
-- ngay_bat_dau: mốc bắt đầu tính lịch. Mặc định = ngày lắp máy, nhưng SỬA được vì khách
--   lắp xong 1-2 tháng sau mới vào ở. Null -> lúc sinh lịch fallback về ngày lắp.
-- vung: 'bac' (nghỉ T7+CN) | 'nam' (nghỉ CN). Null -> suy từ tỉnh của khách; cho ghi đè tay.
--
-- chu_ky_thang + tong_lan đã có sẵn (mặc định chu kỳ 3 tháng đặt ở tầng app).

alter table maintenance_plan
  add column if not exists ngay_bat_dau date,
  add column if not exists vung text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'maintenance_plan_vung_check') then
    alter table maintenance_plan
      add constraint maintenance_plan_vung_check check (vung is null or vung in ('bac', 'nam'));
  end if;
end $$;

comment on column maintenance_plan.ngay_bat_dau is 'Mốc bắt đầu tính lịch bảo trì (mặc định = ngày lắp, sửa được).';
comment on column maintenance_plan.vung is 'Vùng quy tắc cuối tuần: bac (nghỉ T7+CN) | nam (nghỉ CN). Null = suy từ tỉnh.';
