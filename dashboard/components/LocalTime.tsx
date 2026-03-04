"use client";

import { useEffect, useState } from "react";

export default function LocalTime({ iso, fallback = "—" }: { iso: string | null; fallback?: string }) {
  const [formatted, setFormatted] = useState(fallback);

  useEffect(() => {
    if (iso) {
      setFormatted(
        new Date(iso).toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })
      );
    }
  }, [iso]);

  return <>{formatted}</>;
}
