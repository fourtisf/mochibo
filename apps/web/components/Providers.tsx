"use client";
import type { ReactNode } from "react";
import { PreviewStoreProvider } from "@/lib/preview/store";
import { StageRegistryProvider } from "@/lib/stages";
import { ToastProvider } from "@/lib/toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <PreviewStoreProvider>
        <StageRegistryProvider>{children}</StageRegistryProvider>
      </PreviewStoreProvider>
    </ToastProvider>
  );
}
