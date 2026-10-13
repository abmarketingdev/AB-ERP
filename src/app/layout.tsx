import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { THEME_SCRIPT } from "@/lib/theme";

/*
 * IBM Plex, not Geist or Inter. Those two plus Poppins and Space Grotesk are the
 * faces that appear on nearly every generated interface, and shipping one would
 * undo a lot of the other work here.
 *
 * Plex Sans has slightly squared terminals and open apertures — it reads as
 * instrument panel rather than product marketing, which suits software people sit
 * in front of for eight hours. Weights are limited to 400/500 by design: the spec
 * says two weights, never 600 or 700.
 *
 * Plex Mono carries every figure in the product. That is not decoration — digits
 * align in columns, values stop shifting width as they update, and a number is
 * visually marked as data rather than prose.
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AB Marketing ERP",
  description: "Promoter, leder, rekruttering og kundeportal for AB Marketing",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /*
     * suppressHydrationWarning is required, not cosmetic: the theme script in
     * the head adds `dark` and sets `color-scheme` on this element before React
     * hydrates, so the server markup and the live DOM genuinely differ here.
     * That is the whole point of running it early — without the suppression
     * React reports a mismatch on every page load.
     */
    <html
      lang="nb"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applied before first paint so the chosen theme never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
