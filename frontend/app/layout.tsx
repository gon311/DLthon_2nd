import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "버킷제주 | 투숙객 Join",
  description: "버킷제주 주변 장소와 투숙객 조인을 연결하는 제주 여행 커뮤니티",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "BUCKET JEJU",
    description: "제주에서 함께할 순간을 담아요",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "버킷제주 투숙객 커뮤니티" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
