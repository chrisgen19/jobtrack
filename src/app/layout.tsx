import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "JobTrack", template: "%s · JobTrack" },
  description:
    "Organize job opportunities, applications, interviews and follow-ups in one private workspace.",
};

export const viewport: Viewport = { themeColor: "#f7f8f5" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
