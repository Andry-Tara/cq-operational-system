import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Resto Operational System",

  description:
    "Restaurant Operations Portal for Chong Qing Hot Pot and Ding Ding Hot Pot.",

  openGraph: {
    title:
      "Resto Operational System",
    description:
      "Restaurant Operations Portal · Chong Qing Hot Pot · Ding Ding Hot Pot",
    url:
      "https://ops.chongqinghotpot.id/auth/login",
    siteName:
      "Resto Operational System",
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
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
