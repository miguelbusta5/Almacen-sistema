import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/common/Providers";
import { PRODUCT } from "@/config/product";

export const metadata: Metadata = {
  title: `${PRODUCT.displayName} - ${PRODUCT.brand}`,
  description: PRODUCT.tagline,
};

export const viewport: Viewport = {
  themeColor: "#0c1a3a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
