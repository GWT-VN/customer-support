/**
 * SHIM — nội dung thật đã dời sang lib/nen-tang/ (dùng chung mọi module):
 *   db.ts       — authClient / dataClient
 *   phien.ts    — requireStaff / requireNhanSu / layNhanVien
 *   gac-cong.ts — laAdmin / laQuanLy / chanNeuKhongPhai…
 *
 * Giữ file này vì requireStaff() được gọi ở 172 chỗ — đổi hết trong một commit là
 * rủi ro sót một chỗ, mà chỗ sót nghĩa là một trang KHÔNG GÁC CỔNG.
 * Code MỚI hãy import thẳng từ '@/lib/nen-tang/…'.
 */
export * from './nen-tang/db'
export * from './nen-tang/phien'
export * from './nen-tang/gac-cong'
