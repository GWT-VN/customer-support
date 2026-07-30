import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThanhTaiKhoan } from "@/components/ThanhTaiKhoan";
import { Sidebar } from "@/components/Sidebar";
import { layNguoiDung } from "@/lib/supabase";
import { CauHinhBang } from "@/bang";
import { TEN_COT, NGHIA_SAP_XEP } from "@/lib/danhSach";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GWT · CSKH",
  description: "Hệ thống chăm sóc khách hàng GWT",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await layNguoiDung();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/*
          Cấp nhãn cột + nghĩa từng chiều sắp xếp cho bộ bảng dùng chung ở @/bang.
          Bọc MỘT lần ở đây, mọi trang danh sách dùng được ngay.
          Không truyền `giaoDien` -> dùng tông mặc định của bộ bảng; muốn đổi giao
          diện thì truyền đè vài khoá, xem bang/README.md.
        */}
        <CauHinhBang tenCot={TEN_COT} nghiaSapXep={NGHIA_SAP_XEP}>
          <ThanhTaiKhoan />
          {user ? (
            <div className="flex-1 flex flex-col lg:flex-row min-h-0">
              <Sidebar />
              <div className="flex-1 min-w-0">{children}</div>
            </div>
          ) : (
            children
          )}
        </CauHinhBang>
      </body>
    </html>
  );
}
