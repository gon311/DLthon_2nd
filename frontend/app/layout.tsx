import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "버킷 제주 | 여행자와 제주를 잇다",
  description: "버킷 게스트하우스 여행자를 위한 근처 장소 발견과 Join 커뮤니티",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "BUCKET JEJU",
    description: "제주에서 함께할 순간을 담아요",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "버킷 제주 게스트하우스 커뮤니티" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BUCKET JEJU",
    description: "제주에서 함께할 순간을 담아요",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

