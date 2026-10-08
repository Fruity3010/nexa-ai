import type { Metadata } from "next";
import { Suspense } from "react";
import { NexaProvider } from "@/components/nexa-context";
import { Shell } from "@/components/shell";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <NexaProvider>
      <Suspense>
        <Shell>{children}</Shell>
      </Suspense>
    </NexaProvider>
  );
}
