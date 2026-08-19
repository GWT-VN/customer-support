-- 34 — Validator regex cho mẫu nhóm lỗi (mau_mo_ta / mau_may)
--
-- Vì sao cần: v_ticket_issue gom ticket bằng `van_ban ~* g.mau_mo_ta`. Nếu lưu một
-- mẫu regex SAI CÚ PHÁP vào issue_group, TOÀN BỘ view ném lỗi -> mọi nhân viên mất
-- trang Nhóm lỗi. Không thể validate bằng RegExp của JS: mẫu hiện dùng cú pháp POSIX
-- của Postgres (vd \m \M ranh giới từ) — JS coi là sai. Phải thử ngay trong Postgres.
--
-- Hàm trả TRUE nếu mẫu biên dịch được, FALSE nếu hỏng. taoNhomLoi/suaNhomLoi gọi trước
-- khi ghi; mẫu hỏng bị từ chối, view không bao giờ vỡ.

create or replace function kiem_tra_regex_pg(p text)
returns boolean
language plpgsql
immutable
as $$
begin
  -- ép Postgres biên dịch mẫu; mẫu rỗng coi như không hợp lệ (nhóm phải có mẫu để gom)
  if p is null or btrim(p) = '' then
    return false;
  end if;
  perform 'x' ~* p;
  return true;
exception when others then
  return false;
end
$$;

comment on function kiem_tra_regex_pg(text) is
  'TRUE nếu p là regex POSIX hợp lệ (thử biên dịch). Dùng để chặn mẫu hỏng làm vỡ v_ticket_issue.';
