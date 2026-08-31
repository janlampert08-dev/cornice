"use client";

import Button from "@/components/ui/Button";

export default function OfflineRetryButton() {
  return (
    <Button type="button" onClick={() => window.location.reload()} className="mt-2">
      Erneut versuchen
    </Button>
  );
}
