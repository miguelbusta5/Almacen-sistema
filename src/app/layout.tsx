import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/common/Providers";
import { PRODUCT } from "@/config/product";

export const metadata: Metadata = {
  title: `${PRODUCT.displayName} - ${PRODUCT.brand}`,
  description: PRODUCT.tagline,
};

export const viewport: Viewport = {
  themeColor: "#08090B",
  colorScheme: "dark light",
};

// Script anti-parpadeo: antes del paint aplica el tema guardado por dispositivo
// (localStorage 'theme'); por defecto queda en oscuro (atributo SSR). Quien no
// lo haya elegido nunca verá el claro (toggle gateado hasta QA — Fase C/D).
const THEME_INIT = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
