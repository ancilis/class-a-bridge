export function downloadBytes(bytes: Uint8Array, fileName: string, mimeType: string) {
  const blob = new Blob([bytes as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadText(
  text: string,
  fileName: string,
  mimeType = "text/plain;charset=utf-8",
) {
  downloadBytes(new TextEncoder().encode(text), fileName, mimeType);
}

export function diagnosticReport(error?: unknown) {
  return {
    application: "Class A Bridge",
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    capabilities: {
      indexedDb: typeof globalThis.indexedDB !== "undefined",
      webCrypto: Boolean(globalThis.crypto?.subtle),
      serviceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
      storageEstimate:
        typeof navigator !== "undefined" &&
        Boolean(navigator.storage && "estimate" in navigator.storage),
    },
    error:
      error instanceof Error ? { name: error.name, code: "LOCAL_OPERATION_FAILED" } : undefined,
    privacy:
      "Project values, filenames, answers, evidence metadata, and document content are excluded.",
  };
}
