/**
 * Kho quyền — HÀM THUẦN, không đụng DB.
 *
 * Nguồn sự thật của DANH SÁCH quyền nằm ở ĐÂY, không ở DB. Lý do: một mã quyền
 * chỉ có nghĩa khi CÓ CHỖ TRONG CODE kiểm tra nó. Cho admin tự gõ thêm mã trong
 * DB là đẻ ra "quyền ma" — tick vào thấy yên tâm nhưng chẳng gác gì cả.
 * DB chỉ lưu Ô NÀO ĐƯỢC TICK (bảng quyen_vai_tro).
 *
 * 45 quyền gom từ 149 hàm thật trong app theo *đối tượng + hành động*.
 * Spec: docs/superpowers/specs/2026-08-20-nen-tang-tai-khoan-phan-quyen-design.md §6.1
 */
import { VAI_TRO, type VaiTro } from './vai-tro'

export type NhomQuyen =
  | 'khach' | 'may' | 'ticket' | 'bao_tri' | 'ky_thuat'
  | 'bao_cao' | 'yeu_cau' | 'work' | 'sales' | 'he_thong'

export const NHAN_NHOM: Record<NhomQuyen, string> = {
  khach: 'Khách hàng',
  may: 'Máy & serial',
  ticket: 'Ticket',
  bao_tri: 'Bảo trì',
  ky_thuat: 'Kỹ thuật',
  bao_cao: 'Báo cáo',
  yeu_cau: 'Sửa dữ liệu',
  work: 'Việc',
  sales: 'Sales',
  he_thong: 'Hệ thống',
}

/**
 * Mức mặc định — chính là hành vi HÔM NAY, để ma trận lúc bật khớp 100% hiện
 * trạng (số lệch = 0). CEO chỉnh từ đó, mỗi tick là một khác biệt CÓ CHỦ ĐÍCH.
 *
 *  A     — chỉ Quản trị hệ thống
 *  TCS   — Trưởng CSKH trở lên
 *  CS    — mọi nhân viên vào được khu CS (đúng bằng VAI_TRO_VAO_APP)
 *  NS    — mọi nhân sự đang hoạt động, không cần vai trò cụ thể
 *  SALES — người vào được khu Sales
 */
export type MucMacDinh = 'A' | 'TCS' | 'CS' | 'NS' | 'SALES'

const VAI_TRO_THEO_MUC: Record<MucMacDinh, readonly VaiTro[]> = {
  A: ['admin'],
  TCS: ['admin', 'cs_manager'],
  CS: ['admin', 'cs_manager', 'cs', 'ky_thuat'],
  NS: VAI_TRO,
  SALES: ['admin', 'sales_manager', 'sales'],
}

type HoSo = {
  nhom: NhomQuyen
  nhan: string
  mucMacDinh: MucMacDinh
  /** Quyền chỉ ĐỌC, không đổi dữ liệu. CEO mặc định có sẵn toàn bộ nhóm này. */
  chiXem?: true
}

/**
 * Thứ tự khai báo ở đây = thứ tự hiện trên màn ma trận.
 * Sửa nhãn thoải mái; ĐỔI MÃ thì phải sửa cả bảng quyen_vai_tro trong DB.
 */
const BANG_QUYEN = {
  'cs.khach.xem': { nhom: 'khach', nhan: 'Tìm / xem hồ sơ khách', mucMacDinh: 'CS', chiXem: true },
  'cs.khach.sua': { nhom: 'khach', nhan: 'Sửa thông tin khách, liên hệ', mucMacDinh: 'CS' },
  'cs.khach.xin_xoa': { nhom: 'khach', nhan: 'Gửi yêu cầu xoá khách / máy', mucMacDinh: 'CS' },
  'cs.khach.gop': { nhom: 'khach', nhan: 'Gộp 2 hồ sơ trùng ngay', mucMacDinh: 'TCS' },
  'cs.khach.duyet_cho': { nhom: 'khach', nhan: 'Duyệt khách chờ', mucMacDinh: 'TCS' },
  'cs.khach.xin_xuat': { nhom: 'khach', nhan: 'Xin xuất danh sách khách', mucMacDinh: 'CS' },
  'cs.khach.duyet_xuat': { nhom: 'khach', nhan: 'Duyệt yêu cầu xuất khách', mucMacDinh: 'TCS' },
  'cs.khach.xoa_hang_loat': { nhom: 'khach', nhan: 'Xoá nhiều khách một lúc', mucMacDinh: 'A' },

  'cs.may.xem': { nhom: 'may', nhan: 'Xem máy, tra serial, lịch sử', mucMacDinh: 'CS', chiXem: true },
  'cs.may.kich_hoat_bh': { nhom: 'may', nhan: 'Kích hoạt bảo hành, lắp bộ combo', mucMacDinh: 'CS' },
  'cs.may.lap_thu_doi': { nhom: 'may', nhan: 'Lắp / thu hồi / đổi máy', mucMacDinh: 'TCS' },
  'cs.serial.kho': { nhom: 'may', nhan: 'Kho serial: nhập, đổi trạng thái', mucMacDinh: 'TCS' },
  'cs.serial.duyet': { nhom: 'may', nhan: 'Duyệt / từ chối serial chờ', mucMacDinh: 'TCS' },
  'cs.may.thay_loi': { nhom: 'may', nhan: 'Ghi / sửa / xoá lần thay lõi', mucMacDinh: 'CS' },
  'cs.may.trang_thai': { nhom: 'may', nhan: 'Trạng thái máy tuỳ chỉnh', mucMacDinh: 'TCS' },

  'cs.ticket.xem': { nhom: 'ticket', nhan: 'Xem ticket', mucMacDinh: 'CS', chiXem: true },
  'cs.ticket.tao_sua': { nhom: 'ticket', nhan: 'Tạo, sửa, nhận ticket, ghi chú', mucMacDinh: 'CS' },
  'cs.ticket.chi_phi': { nhom: 'ticket', nhan: 'Ghi chi phí ticket, thu phí', mucMacDinh: 'CS' },
  'cs.ticket.nhom_loi': { nhom: 'ticket', nhan: 'Nhóm lỗi: tạo, sửa, gán ticket', mucMacDinh: 'TCS' },

  'cs.bao_tri.xem': { nhom: 'bao_tri', nhan: 'Xem lịch bảo trì, lượt tới hạn', mucMacDinh: 'CS', chiXem: true },
  'cs.bao_tri.ghi_ket_qua': { nhom: 'bao_tri', nhan: 'Ghi kết quả bảo trì', mucMacDinh: 'CS' },
  'cs.bao_tri.tao_plan': { nhom: 'bao_tri', nhan: 'Tạo plan / lên lịch (chờ duyệt)', mucMacDinh: 'CS' },
  'cs.bao_tri.duyet_plan': { nhom: 'bao_tri', nhan: 'Duyệt plan bảo trì chờ', mucMacDinh: 'TCS' },

  'cs.ky_thuat.lich_cua_toi': { nhom: 'ky_thuat', nhan: 'Xem lịch chuyến của mình', mucMacDinh: 'NS', chiXem: true },
  'cs.ky_thuat.ho_so': { nhom: 'ky_thuat', nhan: 'Hồ sơ kỹ thuật viên', mucMacDinh: 'TCS' },
  'cs.ky_thuat.xep_lich': { nhom: 'ky_thuat', nhan: 'Xếp lịch chuyến, ngày nghỉ', mucMacDinh: 'TCS' },
  'cs.ky_thuat.tai_khoan': { nhom: 'ky_thuat', nhan: 'Cấp / thu tài khoản cho KTV', mucMacDinh: 'A' },

  'cs.bao_cao.xuat': { nhom: 'bao_cao', nhan: 'Xuất Excel ticket / máy / bảo trì', mucMacDinh: 'TCS' },
  'cs.bao_cao.doanh_so': { nhom: 'bao_cao', nhan: 'Xem doanh số CSKH', mucMacDinh: 'CS', chiXem: true },

  'cs.yeu_cau.gui': { nhom: 'yeu_cau', nhan: 'Gửi yêu cầu sửa dữ liệu', mucMacDinh: 'CS' },
  'cs.yeu_cau.tu_choi': { nhom: 'yeu_cau', nhan: 'Xem + từ chối yêu cầu sửa', mucMacDinh: 'TCS' },
  'cs.yeu_cau.duyet': { nhom: 'yeu_cau', nhan: 'DUYỆT yêu cầu sửa dữ liệu', mucMacDinh: 'A' },
  'cs.hang_loat.cap_nhat': { nhom: 'yeu_cau', nhan: 'Cập nhật hàng loạt bản ghi', mucMacDinh: 'TCS' },

  'work.viec.xem_tao': { nhom: 'work', nhan: 'Xem + tạo việc, bình luận', mucMacDinh: 'NS' },
  'work.viec.giao': { nhom: 'work', nhan: 'Giao việc cho người khác', mucMacDinh: 'NS' },
  'work.luat_tu_sinh': { nhom: 'work', nhan: 'Bật / tắt luật tự sinh việc', mucMacDinh: 'TCS' },

  'sales.don.xem': { nhom: 'sales', nhan: 'Xem đơn hàng Sales', mucMacDinh: 'SALES', chiXem: true },
  'sales.don.ghi': { nhom: 'sales', nhan: 'Tạo / sửa / xoá đơn Sales', mucMacDinh: 'SALES' },

  'he_thong.nhan_su.xem': { nhom: 'he_thong', nhan: 'Xem danh sách nhân sự', mucMacDinh: 'A', chiXem: true },
  'he_thong.nhan_su.sua': { nhom: 'he_thong', nhan: 'Đổi vai trò, khoá, mời người', mucMacDinh: 'A' },
  'he_thong.phan_quyen': { nhom: 'he_thong', nhan: 'Sửa CHÍNH ma trận quyền này', mucMacDinh: 'A' },
  'he_thong.nhat_ky': { nhom: 'he_thong', nhan: 'Xem nhật ký thao tác', mucMacDinh: 'A', chiXem: true },
  'he_thong.catalog': { nhom: 'he_thong', nhan: 'Đồng bộ danh mục sản phẩm', mucMacDinh: 'A' },
  'he_thong.kenh': { nhom: 'he_thong', nhan: 'Quản lý kênh bán, gán kênh', mucMacDinh: 'CS' },
  'he_thong.view_chung': { nhom: 'he_thong', nhan: 'Lưu / xoá view bảng dùng chung', mucMacDinh: 'TCS' },
} as const satisfies Record<string, HoSo>

export type MaQuyen = keyof typeof BANG_QUYEN

/**
 * Ép về một kiểu CHUNG. `as const` ở trên giữ kiểu literal cho từng dòng, khiến
 * `chiXem` biến mất ở các quyền không khai báo nó — đọc `HO_SO_QUYEN[q].chiXem`
 * sẽ không biên dịch được.
 */
export const HO_SO_QUYEN: Record<MaQuyen, HoSo> = BANG_QUYEN

export const QUYEN = Object.keys(HO_SO_QUYEN) as MaQuyen[]

export function laMaQuyenHopLe(x: string): x is MaQuyen {
  return Object.prototype.hasOwnProperty.call(BANG_QUYEN, x)
}

/** Các quyền chỉ-đọc — CEO mặc định có sẵn toàn bộ nhóm này (CEO chốt 20/08). */
export const QUYEN_CHI_XEM = QUYEN.filter((q) => HO_SO_QUYEN[q].chiXem === true)

/**
 * Giá trị khởi tạo của ma trận, sinh từ mức mặc định của từng quyền.
 *
 * CEO là ngoại lệ CÓ CHỦ ĐÍCH: thấy toàn bộ công ty (mọi quyền xem) nhưng không
 * có quyền ghi nào — tránh ca lỡ tay xoá dữ liệu. Muốn cho ghi thì tick tay.
 */
export const MAC_DINH: Record<VaiTro, MaQuyen[]> = Object.fromEntries(
  VAI_TRO.map((v) => [
    v,
    v === 'ceo'
      ? [...QUYEN_CHI_XEM]
      : QUYEN.filter((q) => VAI_TRO_THEO_MUC[HO_SO_QUYEN[q].mucMacDinh].includes(v)),
  ])
) as Record<VaiTro, MaQuyen[]>
