import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://ops.chongqinghotpot.id"
  ),

  title: {
    default:
      "Resto Operational System",
    template:
      "%s | Resto Operational System",
  },

  description:
    "Restaurant Operations Portal for Chong Qing Hot Pot and Ding Ding Hot Pot.",

  applicationName:
    "Resto Operational System",

  openGraph: {
    title:
      "Resto Operational System",
    description:
      "Restaurant Operations Portal · Chong Qing Hot Pot · Ding Ding Hot Pot",
    url:
      "https://ops.chongqinghotpot.id",
    siteName:
      "Resto Operational System",
    type:
      "website",
    images: [
      {
        url:
          "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt:
          "Resto Operational System",
      },
    ],
  },

  twitter: {
    card:
      "summary_large_image",
    title:
      "Resto Operational System",
    description:
      "Restaurant Operations Portal · Chong Qing Hot Pot · Ding Ding Hot Pot",
    images: [
      "/twitter-image.png",
    ],
  },

  robots: {
    index: false,
    follow: false,
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
