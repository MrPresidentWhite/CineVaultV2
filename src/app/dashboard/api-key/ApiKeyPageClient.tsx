"use client";

import { useState } from "react";
import { ApiKeySshSection } from "./ApiKeySshSection";
import { ApiKeyListSection } from "./ApiKeyListSection";

export function ApiKeyPageClient() {
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  return (
    <div className="space-y-8">
      <ApiKeySshSection onSuccess={() => setRefetchTrigger((t) => t + 1)} />
      <ApiKeyListSection refetchTrigger={refetchTrigger} />
    </div>
  );
}
