/**
 * 🎨 TOÀN BỘ lớp CSS của bộ bảng nằm ở ĐÂY, không rải trong component.
 *
 * Mang sang project khác thì đây là file DUY NHẤT phải sửa để đổi giao diện.
 * Component không được viết className trực tiếp — viết thẳng vào component là
 * lần sau người ta phải đi lục 7 file mới đổi xong một màu.
 *
 * Đang viết bằng lớp Tailwind. Dùng CSS thường cũng được: thay bằng tên lớp của
 * bạn, cấu trúc thẻ không đổi.
 */
export type GiaoDienBang = {
  // Ô tìm kiếm
  oTimKiem_khung: string
  oTimKiem_input: string
  oTimKiem_nutXoa: string

  // Thanh "đang lọc"
  dangLoc_khung: string
  dangLoc_nhomChip: string
  dangLoc_chip: string
  dangLoc_chipCoNutGo: string     // đệm khi chip CÓ nút ×
  dangLoc_chipTron: string        // đệm khi chip KHÔNG có nút ×
  dangLoc_nutGoChip: string
  dangLoc_soDong: string
  dangLoc_nutXoaLoc: string

  // Chip "đang sắp xếp"
  sapXep_chip: string
  sapXep_chipCoNutGo: string
  sapXep_chipTron: string
  sapXep_muiTen: string
  sapXep_ghiChu: string
  sapXep_nutGo: string

  // Tiêu đề cột bấm được
  tieuDe_o: string
  tieuDe_oDangSap: string
  tieuDe_link: string
  tieuDe_linkDangSap: string
  tieuDe_muiTenDangSap: string
  tieuDe_muiTenThuong: string

  // Chuyển trang
  phanTrang_khung: string
  phanTrang_nut: string
  phanTrang_nutTat: string
  phanTrang_chuSo: string

  // Ô lọc dạng chọn
  boLoc_khung: string
  boLoc_select: string
  boLoc_muiTen: string

  // Chọn dòng
  chon_khung: string
  chon_oTh: string
  chon_oTd: string
  chon_checkbox: string
  chon_thanh: string
  chon_thanhPhuChu: string
  chon_thanhCanhBao: string
  chon_nutChonToanBo: string
  chon_nutBoChon: string
  chon_loi: string
  chon_khuHanhDong: string
  chon_chuaCoHanhDong: string
}

/** Bản mặc định — tông xám/slate của Tailwind. */
export const GIAO_DIEN_MAC_DINH: GiaoDienBang = {
  oTimKiem_khung: 'relative',
  oTimKiem_input: 'w-full rounded-lg border px-4 py-2.5 pr-10 text-slate-900 bg-white',
  oTimKiem_nutXoa: 'absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900',

  dangLoc_khung: 'flex items-center justify-between gap-3 flex-wrap text-sm',
  dangLoc_nhomChip: 'flex items-center gap-2 flex-wrap',
  dangLoc_chip: 'inline-flex items-center gap-1 py-1 rounded-full bg-slate-100 text-slate-700 text-xs',
  // Đệm hai bên phải CÂN MẮT: dấu × là ô 16px, nét chữ chỉ chiếm giữa nên lề
  // phải bóp còn pr-1.5 mới ra ~10.5px tới nét chữ, khớp pl-2.5 (10px) bên trái.
  dangLoc_chipCoNutGo: 'pl-2.5 pr-1.5',
  dangLoc_chipTron: 'px-2.5',
  dangLoc_nutGoChip:
    'flex-none grid place-items-center w-4 h-4 rounded-full leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-900',
  dangLoc_soDong: 'text-slate-500',
  dangLoc_nutXoaLoc: 'text-slate-600 underline hover:text-slate-900 flex-none',

  sapXep_chip: 'inline-flex items-center gap-1.5 py-1 rounded-full bg-sky-50 text-sky-900 text-xs',
  sapXep_chipCoNutGo: 'pl-2.5 pr-1.5',
  sapXep_chipTron: 'px-2.5',
  sapXep_muiTen: 'text-sky-500',
  sapXep_ghiChu: 'text-sky-700',
  sapXep_nutGo:
    'flex-none grid place-items-center w-4 h-4 rounded-full leading-none text-sky-400 hover:bg-sky-200 hover:text-sky-900',

  tieuDe_o: 'text-left px-4 py-3 font-medium',
  tieuDe_oDangSap: 'bg-white text-slate-900',
  tieuDe_link: 'inline-flex items-center gap-1 hover:text-slate-900',
  tieuDe_linkDangSap: 'font-semibold text-slate-900',
  tieuDe_muiTenDangSap: 'text-slate-900',
  tieuDe_muiTenThuong: 'text-slate-300',

  phanTrang_khung: 'flex items-center justify-center gap-3 text-sm',
  phanTrang_nut: 'rounded-lg border bg-white text-slate-700 px-3 py-1.5 hover:bg-slate-50',
  phanTrang_nutTat: 'rounded-lg border bg-white text-slate-300 px-3 py-1.5',
  phanTrang_chuSo: 'text-slate-500',

  boLoc_khung: 'relative inline-flex max-w-full',
  // appearance-none + tự vẽ mũi tên: mũi tên mặc định của trình duyệt nằm ngoài
  // tầm CSS, đặt padding-right bao nhiêu nó vẫn bám mép phải theo cách riêng.
  boLoc_select:
    'w-48 max-w-full truncate appearance-none rounded-lg border bg-white pl-3 pr-8 py-1.5 text-sm text-slate-700',
  boLoc_muiTen: 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400',

  chon_khung: 'space-y-4',
  chon_oTh: 'w-10 px-4 py-3',
  chon_oTd: 'w-10 px-4 py-3',
  chon_checkbox: 'align-middle accent-slate-900',
  chon_thanh:
    'flex items-center gap-x-3 gap-y-1 flex-wrap rounded-lg border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white',
  chon_thanhPhuChu: 'text-slate-300',
  chon_thanhCanhBao: 'text-amber-300',
  chon_nutChonToanBo:
    'underline decoration-dotted underline-offset-2 text-sky-300 hover:text-white disabled:opacity-50',
  chon_nutBoChon: 'text-slate-300 underline hover:text-white',
  chon_loi: 'text-red-300',
  chon_khuHanhDong: 'flex items-center gap-2 flex-wrap ml-auto',
  chon_chuaCoHanhDong: 'ml-auto text-xs text-slate-400',
}
