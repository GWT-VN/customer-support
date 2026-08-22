-- Vá hai lỗ ở hai bảng vệ tinh (22/08/2026) — cả hai đều là kiểu "gãy mà không ai biết"
--
-- ── Lỗ 1: TÔI GÂY RA, migration ngay trước đó ───────────────────────────────────────────────
-- `20260822130000` siết `ma_kh` NOT NULL, nhưng bản code đang chạy trên PRODUCTION (nhánh main)
-- vẫn chèn không có `ma_kh` — phần TypeScript biết điền mã còn nằm ở nhánh chưa merge. Kết quả:
-- nút "thêm SĐT phụ" / "thêm địa chỉ phụ" GÃY NGAY trên prod. Đã tái hiện đúng câu chèn của
-- production: `null value in column "ma_kh" violates not-null constraint`.
--
-- Bài học: **đừng siết NOT NULL một cột mà bản code đang chạy trên prod chưa biết điền.**
-- App và DB không bao giờ lên cùng lúc — schema phải tự lo được cho cả bản cũ lẫn bản mới.
--
-- ── Lỗ 2: CÓ TỪ TRƯỚC, chưa ai phát hiện ────────────────────────────────────────────────────
-- `customer_contacts_role_check` chỉ nhận 5 vai trò TIẾNG ANH (owner/family/helper/manager/other),
-- trong khi app gửi `'khac'` — tiếng Việt, giống cột `loai` của bảng địa chỉ. Hai bảng hai thứ
-- tiếng, rất dễ nhầm, và đã nhầm ở CẢ BỐN đường ghi: màn tạo khách, màn gộp khách, đường gán
-- lịch bảo trì, và mặc định trong chính `gop_khach`.
--
-- Đo prod 22/08: `customer_contacts` **0 dòng**, nhật ký `them_sdt_phu` **0 lượt** — dù nút đã
-- có trên màn hình từ lâu và đã có 3 lượt gộp khách. Không ai báo vì lỗi nằm ở tầng DB.

-- ── Vá 1: trigger tự điền ma_kh từ customer_id ──────────────────────────────────────────────
create or replace function public.ve_tinh_tu_dien_ma_kh()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.ma_kh is null and new.customer_id is not null then
    select k.ma_kh into new.ma_kh from public.cs_customers k where k.id = new.customer_id;
  end if;
  return new;
end $function$;

comment on function public.ve_tinh_tu_dien_ma_kh() is
  'Điền ma_kh từ customer_id khi bản code cũ chèn mà không biết về cột mới. Giữ cho schema chạy được với cả hai bản code, vì app và DB không bao giờ lên cùng lúc.';

drop trigger if exists trg_ve_tinh_ma_kh on public.customer_contacts;
create trigger trg_ve_tinh_ma_kh
  before insert or update on public.customer_contacts
  for each row execute function public.ve_tinh_tu_dien_ma_kh();

drop trigger if exists trg_ve_tinh_ma_kh on public.customer_addresses;
create trigger trg_ve_tinh_ma_kh
  before insert or update on public.customer_addresses
  for each row execute function public.ve_tinh_tu_dien_ma_kh();

-- ── Vá 2: mặc định vai trò trong gop_khach phải là 'other', không phải 'khac' ────────────────
-- Sửa tại chỗ trên định nghĩa hiện có thay vì chép lại cả hàm 150 dòng: chép lại là mời thêm
-- một bản nữa lệch với bản đang chạy.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('gop_khach(uuid,uuid,jsonb)'::regprocedure);
  if position('nullif(v_muc ->> ''role'', ''''), ''khac''' in v_def) = 0 then
    raise notice 'gop_khach khong con mac dinh ''khac'' — bo qua, khong sua gi.';
  else
    execute replace(v_def,
      'nullif(v_muc ->> ''role'', ''''), ''khac''',
      'nullif(v_muc ->> ''role'', ''''), ''other''');
    raise notice 'gop_khach: da doi mac dinh vai tro sang other.';
  end if;
end $$;

notify pgrst, 'reload schema';
