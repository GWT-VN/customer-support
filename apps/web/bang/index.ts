/**
 * Bộ bảng dữ liệu dùng chung: tìm kiếm không dấu · lọc · sắp xếp · phân trang ·
 * chọn nhiều dòng. Xem README.md để biết cách mang sang project khác.
 */

// Cấu hình — nơi đổi giao diện và nhãn cột
export { CauHinhBang, useCauHinh, useGiaoDien, useTenCot, type CauHinh, type NghiaChieu } from './CauHinh'
export { GIAO_DIEN_MAC_DINH, type GiaoDienBang } from './giaoDien'

// Kiểu dùng chung
export type { KetQuaTrang, TuyChonDanhSach, ThamSoLoc, SapXep } from './kieu'

// Hàm thuần — không đụng DB, không đụng React
export { boDau, chuanHoaTuKhoa, antoanChoOr, mauDauTu, sapXepHopLe } from './timkiem'
export { isoNgay, khoangPreset, PRESETS, type MaPreset } from './ngay'

// Lấy toàn bộ khoá khớp bộ lọc (chọn tất cả)
export { gomKhoa, MOI_LO, TOI_DA_CHON_MAC_DINH } from './gomKhoa'

// Thành phần giao diện
export { OTimKiem } from './OTimKiem'
export { ThanhDangLoc } from './ThanhDangLoc'
export { ChipSapXep } from './ChipSapXep'
export { TieuDeCotSapXep } from './TieuDeCotSapXep'
export { PhanTrang } from './PhanTrang'
export { BoLocChon } from './BoLocChon'
export { BoLocGoiY } from './BoLocGoiY'
export { OChonGoiY, type MucChon } from './OChonGoiY'
export { OChonTimXa, TOI_THIEU_KY_TU } from './OChonTimXa'
export { LocNgay } from './LocNgay'
export { KhungChon, OChonTatCa, OChonDong, ThanhDaChon, useDaChon } from './ChonDong'
