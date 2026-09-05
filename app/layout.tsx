import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Sora,
  Plus_Jakarta_Sans,
} from "next/font/google";
import { Toaster } from "sonner";
import { ConfirmDialogProvider } from "@/components/shared/confirm-dialog";
import { DevViewServerWrapper } from "@/components/providers/dev-view-server-wrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Redesign display + body faces (docs/redesign/SPEC.md) — exposed as the
// `font-display` / `font-body` utilities; screens adopt them per-phase.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sate Kambing Sido Mampir",
  description: "Kasir Sate Kambing Sido Mampir",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables live on <html> (:root), not <body>: globals.css
    // resolves --font-sans from --font-geist-sans inside `@theme`, which Tailwind
    // emits at :root. Declared one level lower, that lookup found nothing and
    // every screen fell back to the browser serif.
    //
    // `dark` ALSO belongs here, for the same class of reason (found 2026-09-05).
    // It used to sit only on the wrapper div inside each screen (app-shell.tsx,
    // page.tsx, error.tsx...). Anything rendered through a PORTAL — every
    // base-ui Dialog and every Sonner toast — mounts on document.body, OUTSIDE
    // those wrappers, so it resolved the tokens from :root and came out with
    // the LIGHT palette: `--popover` is oklch(1 0 0), pure white. That is why
    // dialogs appeared as a white card on the dark UI.
    //
    // The app is dark-only (no theme toggle exists), so this is unconditional.
    // The `dark` classes on the wrappers are now redundant but harmless; leave
    // them until someone removes them deliberately.
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${geistSans.variable} ${geistMono.variable} ${sora.variable} ${jakarta.variable}`}
    >
      <body className="antialiased">
        <ConfirmDialogProvider>
          <DevViewServerWrapper>
            {children}
          </DevViewServerWrapper>
        </ConfirmDialogProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
