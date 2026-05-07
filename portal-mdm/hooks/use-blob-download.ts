"use client";

import { useCallback } from "react";

/**
 * Trigger a browser download for a Blob received from an API.
 * Creates a temporary `<a download>` element, clicks it, and revokes the
 * object URL afterwards.
 */
export function useBlobDownload() {
  return useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);
}
