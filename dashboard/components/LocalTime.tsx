"use client";

import { useEffect, useState } from "react";

export default function LocalTime({ iso, fallback = "—" }: { iso: string | null; fallback?: string }) {
  const [formatted, setFormatted] = useState(fallback);

  useEffect(() => {
    if (iso) {
      setFormatted(
        new Date(iso).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZoneName: "short",
        })
      );
    }
  }, [iso]);

  return <>{formatted}</>;
}
