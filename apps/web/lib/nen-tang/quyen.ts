/**
 * Kho quyền — HÀM THUẦN, không đụng DB.
 *
 * Nguồn sự thật của DANH SÁCH quyền nằm ở ĐÂY, không ở DB. Lý do: một mã quyền
 * chỉ có nghĩa khi CÓ CHỖ TRONG CODE kiểm tra nó. Cho admin tự gõ thêm mã trong
 * DB là đẻ ra "quyền ma" — tick vào thấy yên tâm nhưng chẳng gác gì cả.
 * DB chỉ lưu Ô NÀO ĐƯỢC TICK (bảng quyen_vai_tro).
 *
 * 52 quyền gom từ 149 hàm thật trong app theo *đối tượng + hành động*.
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
 *  CEO   — chỉ CEO (và Quản trị). Dùng cho việc DUYỆT/phê chuẩn: người soạn và
 *          người duyệt phải là hai vai khác nhau. Cấp thêm cho vai khác thì tick
 *          trên màn ma trận, không phải sửa code.
 */
export type MucMacDinh = 'A' | 'TCS' | 'CS' | 'NS' | 'SALES' | 'CEO'

const VAI_TRO_THEO_MUC: Record<MucMacDinh, readonly VaiTro[]> = {
  A: ['admin'],
  TCS: ['admin', 'cs_manager'],
  // ky_thuat CỐ TÌNH không nằm trong mức CS (CEO chốt 20/08): kỹ thuật chỉ xem
  // lịch chuyến của mình. Họ vẫn VÀO được khu CS (VAI_TRO_VAO_APP) — vào cửa và
  // được-làm-gì là hai chuyện khác nhau.
  CS: ['admin', 'cs_manager', 'cs'],
  NS: VAI_TRO,
  SALES: ['admin', 'sales_manager', 'sales'],
  // admin đi kèm vì quyenCuaToi() đọc thẳng bảng quyen_vai_tro, KHÔNG miễn trừ admin.
  // Thiếu admin ở đây là admin mất quyền duyệt.
  CEO: ['admin', 'ceo'],
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
  'cs.khach.duyet_xuat': { nhom: 'khach', nhan: 'Duyệt yêu cầu xuất + tự xuất khách', mucMacDinh: 'TCS' },
  'cs.khach.duyet_xoa': { nhom: 'khach', nhan: 'Duyệt XOÁ hồ sơ khách', mucMacDinh: 'A' },
  'cs.khach.xoa_hang_loat': { nhom: 'khach', nhan: 'Xoá nhiều khách một lúc', mucMacDinh: 'A' },

  'cs.may.xem': { nhom: 'may', nhan: 'Xem máy, tra serial, lịch sử', mucMacDinh: 'CS', chiXem: true },
  'cs.may.kich_hoat_bh': { nhom: 'may', nhan: 'Kích hoạt bảo hành, lắp bộ combo', mucMacDinh: 'CS' },
  'cs.may.lap_thu_doi': { nhom: 'may', nhan: 'Lắp / thu hồi / đổi máy', mucMacDinh: 'TCS' },
  'cs.serial.kho': { nhom: 'may', nhan: 'Kho serial: nhập, đổi trạng thái', mucMacDinh: 'TCS' },
  'cs.serial.duyet': { nhom: 'may', nhan: 'Duyệt / từ chối serial chờ', mucMacDinh: 'TCS' },
  'cs.may.thay_loi': { nhom: 'may', nhan: 'Ghi / sửa / xoá lần thay lõi', mucMacDinh: 'CS' },
  'cs.may.trang_thai': { nhom: 'may', nhan: 'Trạng thái máy tuỳ chỉnh', mucMacDinh: 'TCS' },

  'cs.ticket.xem': { nhom: 'ticket', nhan: 'Xem ticket', mucMacDinh: 'CS', chiXem: true },
  'cs.ticket.xem_tat_ca': { nhom: 'ticket', nhan: 'Xem ticket của MỌI người', mucMacDinh: 'TCS', chiXem: true },
  'cs.ticket.tao_sua': { nhom: 'ticket', nhan: 'Tạo, sửa, nhận ticket, ghi chú', mucMacDinh: 'CS' },
  'cs.ticket.chi_phi': { nhom: 'ticket', nhan: 'Ghi chi phí ticket, thu phí', mucMacDinh: 'CS' },
  'cs.nhom_loi.cau_hinh': { nhom: 'ticket', nhan: 'Nhóm lỗi: tạo / sửa / xoá danh mục', mucMacDinh: 'TCS' },
  'cs.nhom_loi.gan_ticket': { nhom: 'ticket', nhan: 'Gán ticket vào nhóm lỗi', mucMacDinh: 'TCS' },

  'cs.bao_tri.xem': { nhom: 'bao_tri', nhan: 'Xem lịch bảo trì, lượt tới hạn', mucMacDinh: 'CS', chiXem: true },
  'cs.bao_tri.ghi_ket_qua': { nhom: 'bao_tri', nhan: 'Ghi kết quả bảo trì', mucMacDinh: 'CS' },
  'cs.bao_tri.tao_plan': { nhom: 'bao_tri', nhan: 'Tạo plan / lên lịch (chờ duyệt)', mucMacDinh: 'CS' },
  'cs.bao_tri.duyet_plan': { nhom: 'bao_tri', nhan: 'Duyệt plan bảo trì chờ', mucMacDinh: 'TCS' },

  'cs.ky_thuat.lich_cua_toi': { nhom: 'ky_thuat', nhan: 'Xem lịch chuyến của mình', mucMacDinh: 'NS', chiXem: true },
  'cs.ky_thuat.ho_so': { nhom: 'ky_thuat', nhan: 'Hồ sơ kỹ thuật viên', mucMacDinh: 'TCS' },
  'cs.ky_thuat.xep_lich': { nhom: 'ky_thuat', nhan: 'Xếp lịch chuyến, ngày nghỉ', mucMacDinh: 'TCS' },
  'cs.ky_thuat.tai_khoan': { nhom: 'ky_thuat', nhan: 'Cấp / thu tài khoản cho KTV', mucMacDinh: 'A' },

  'cs.bao_cao.xuat': { nhom: 'bao_cao', nhan: 'Xuất Excel ticket / máy / bảo trì', mucMacDinh: 'TCS' },
  // Trang /doanh-so vốn gác admin, nhưng hàm doanhSoCskh phía sau chỉ có
  // requireStaff ⇒ nhân viên CS gọi thẳng vẫn ra số. Lấy mức của TRANG làm chuẩn.
  'cs.bao_cao.doanh_so': { nhom: 'bao_cao', nhan: 'Xem doanh số CSKH', mucMacDinh: 'A', chiXem: true },

  'cs.yeu_cau.gui': { nhom: 'yeu_cau', nhan: 'Gửi yêu cầu sửa dữ liệu', mucMacDinh: 'CS' },
  'cs.yeu_cau.xem': { nhom: 'yeu_cau', nhan: 'Xem hàng chờ yêu cầu sửa', mucMacDinh: 'TCS', chiXem: true },
  'cs.yeu_cau.duyet': { nhom: 'yeu_cau', nhan: 'Duyệt / từ chối yêu cầu sửa', mucMacDinh: 'TCS' },
  'cs.yeu_cau.ap_thang': { nhom: 'yeu_cau', nhan: 'Sửa áp thẳng, không qua duyệt', mucMacDinh: 'TCS' },
  'cs.hang_loat.cap_nhat': { nhom: 'yeu_cau', nhan: 'Cập nhật hàng loạt bản ghi', mucMacDinh: 'TCS' },

  'work.viec.xem_tao': { nhom: 'work', nhan: 'Xem + tạo việc, bình luận', mucMacDinh: 'NS' },
  'work.viec.giao': { nhom: 'work', nhan: 'Giao việc cho người khác', mucMacDinh: 'NS' },
  'work.luat_tu_sinh': { nhom: 'work', nhan: 'Bật / tắt luật tự sinh việc', mucMacDinh: 'TCS' },

  'sales.don.xem': { nhom: 'sales', nhan: 'Xem đơn hàng Sales', mucMacDinh: 'SALES', chiXem: true },
  'sales.don.ghi': { nhom: 'sales', nhan: 'Tạo / sửa / xoá đơn Sales', mucMacDinh: 'SALES' },
  'sales.ctkm.xem': { nhom: 'sales', nhan: 'Xem khuyến mãi & chính sách giá', mucMacDinh: 'SALES', chiXem: true },
  'sales.ctkm.soan': { nhom: 'sales', nhan: 'Soạn / sửa chương trình khuyến mãi (bản nháp)', mucMacDinh: 'SALES' },
  // CEO chốt 21/08/2026: NV Sales và Trưởng Sales được LÊN chương trình, chỉ CEO
  // được DUYỆT. Đặt mức 'CEO' thay vì gán cứng, để sau cấp thêm cho Trưởng Sales
  // chỉ cần tick ô trên màn ma trận.
  'sales.ctkm.duyet': { nhom: 'sales', nhan: 'Duyệt & ban hành chương trình khuyến mãi', mucMacDinh: 'CEO' },

  'he_thong.nhan_su.xem': { nhom: 'he_thong', nhan: 'Xem danh sách nhân sự', mucMacDinh: 'A', chiXem: true },
  'he_thong.nhan_su.sua': { nhom: 'he_thong', nhan: 'Đổi vai trò, khoá, mời người', mucMacDinh: 'A' },
  // Tách khỏi .sua có chủ đích: sửa vai trò sai thì sửa lại được, xoá thì không.
  'he_thong.nhan_su.xoa': { nhom: 'he_thong', nhan: 'Xoá hẳn người mời nhầm', mucMacDinh: 'A' },
  'he_thong.nhan_su.mat_khau': { nhom: 'he_thong', nhan: 'Gửi lại email đặt mật khẩu', mucMacDinh: 'A' },
  'he_thong.phan_quyen': { nhom: 'he_thong', nhan: 'Sửa CHÍNH ma trận quyền này', mucMacDinh: 'A' },
  'he_thong.nhat_ky': { nhom: 'he_thong', nhan: 'Xem nhật ký thao tác', mucMacDinh: 'A', chiXem: true },
  'he_thong.catalog': { nhom: 'he_thong', nhan: 'Đồng bộ danh mục sản phẩm', mucMacDinh: 'A' },
  'he_thong.kenh': { nhom: 'he_thong', nhan: 'Quản lý kênh bán, gán kênh', mucMacDinh: 'CS' },
  // Tách ĐỌC khỏi GHI có chủ đích. Gộp chung là khoá chết app: mọi trang danh sách
  // đều gọi listBangView() lúc vẽ, nên nhân viên thường mở trang nào cũng bị đá ra
  // "không đủ quyền" — đo được khi thử tay 21/08 với một tài khoản NV CSKH thật.
  'he_thong.view_xem': { nhom: 'he_thong', nhan: 'Xem view bảng đã lưu', mucMacDinh: 'NS', chiXem: true },
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

/**
 * Bảng tra cho GIAO DIỆN: mã quyền -> được hay không.
 *
 * Khai báo ở file THUẦN này (không phải kiem-quyen.ts) để component client
 * `import type` được mà không kéo theo dataClient/next-navigation.
 */
export type BangQuyen = Partial<Record<MaQuyen, boolean>>

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
/** Quyền mức "mọi nhân sự" — nền chung, vai trò nào cũng có. */
const QUYEN_NEN = QUYEN.filter((q) => HO_SO_QUYEN[q].mucMacDinh === 'NS')

/**
 * Quản trị hệ thống (IT) — CEO chốt 20/08.
 *
 * Lo NGƯỜI và CẤU HÌNH, **mù hoàn toàn với dữ liệu nghiệp vụ**: không xem được
 * khách, máy, ticket, bảo trì, đơn hàng, doanh số. Đây là lý do phải tách
 * `cs.nhom_loi.cau_hinh` (danh mục, IT sửa được) khỏi `cs.nhom_loi.gan_ticket`
 * (chạm ticket của khách, IT KHÔNG được).
 *
 * Khác `admin` ở đúng chỗ đó: admin toàn quyền kể cả dữ liệu khách, nên admin là
 * tài khoản phá-kính-khẩn-cấp; quan_tri_ht mới là tài khoản dùng hằng ngày.
 */
const QUYEN_QUAN_TRI_HT: MaQuyen[] = [
  ...QUYEN_NEN,
  'he_thong.nhan_su.xem',
  'he_thong.nhan_su.sua',
  'he_thong.nhan_su.xoa',
  'he_thong.nhan_su.mat_khau',
  'he_thong.phan_quyen',
  'he_thong.nhat_ky',
  'he_thong.catalog',
  'he_thong.kenh',
  'he_thong.view_chung',
  'cs.nhom_loi.cau_hinh',
  'cs.may.trang_thai',
]

export const MAC_DINH: Record<VaiTro, MaQuyen[]> = Object.fromEntries(
  VAI_TRO.map((v) => [
    v,
    v === 'ceo'
      // CEO: toàn bộ quyền chỉ-xem, CỘNG các quyền đặt mức 'CEO' (duyệt/phê chuẩn).
      // Nhánh này cố tình BỎ QUA mucMacDinh cho phần còn lại, nên quyền mức CEO
      // phải cộng tay ở đây — không tự chảy vào như các vai khác.
      ? [...new Set([...QUYEN_CHI_XEM, ...QUYEN.filter((q) => HO_SO_QUYEN[q].mucMacDinh === 'CEO')])]
      : v === 'quan_tri_ht'
        ? [...QUYEN_QUAN_TRI_HT]
        : v === 'ky_thuat'
          // CEO chốt: kỹ thuật CHỈ xem lịch chuyến của mình, ngoài ra chỉ quyền nền.
          ? [...QUYEN_NEN]
          : QUYEN.filter((q) => VAI_TRO_THEO_MUC[HO_SO_QUYEN[q].mucMacDinh].includes(v)),
  ])
) as Record<VaiTro, MaQuyen[]>
