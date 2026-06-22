"use client";

import { Providers } from "@/components/Providers";

export default function ProvidersWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Providers>{children}</Providers>;
}
