import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/supabase/auth";

export const metadata: Metadata = { title: "Production Samples | JACK RUSSEL", description: "Production sample development tracking" };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export const preferredRegion = "hnd1";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return <html lang="th"><body className="font-normal" data-lang="th" data-theme="denim"><StoreProvider><AppShell user={user}>{children}</AppShell></StoreProvider></body></html>;
}
