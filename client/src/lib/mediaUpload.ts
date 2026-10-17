import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";
let client: ReturnType<typeof createTRPCClient<AppRouter>> | undefined;
function mediaClient() {
  return (client ??= createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
  }));
}
/** Same-origin bounded chunks work without a public bucket or browser R2 CORS. */
export async function uploadOwnedMedia(
  file: File,
  purpose: "timeline" | "training" | "animation",
  onProgress?: (fraction: number) => void
) {
  const api = mediaClient();
  const contentType = file.type === "audio/x-wav" ? "audio/wav" : file.type;
  const upload = await api.media.createUpload.mutate({
    fileName: file.name,
    contentType,
    size: file.size,
    purpose,
  });
  for (let part = 0; part < upload.partCount; part++) {
    const chunk = file.slice(
      part * upload.chunkSize,
      Math.min(file.size, (part + 1) * upload.chunkSize)
    );
    let accepted = false;
    for (let attempt = 0; attempt < 3 && !accepted; attempt++) {
      try {
        const response = await fetch(
          `/api/media/upload/${upload.uploadId}/${part}`,
          {
            method: "PUT",
            body: chunk,
            credentials: "same-origin",
            headers: { "Content-Type": "application/octet-stream" },
          }
        );
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new Error(error?.error ?? "Upload failed. Please try again.");
        }
        accepted = true;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
    onProgress?.(((part + 1) / upload.partCount) * 0.95);
  }
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await api.media.completeUpload.mutate({
        uploadId: upload.uploadId,
      });
      break;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  if (!result)
    throw new Error("Upload completion is still pending. Try again shortly.");
  onProgress?.(1);
  return result;
}
