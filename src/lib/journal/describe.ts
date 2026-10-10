import { blobToBase64 } from "./image";

const URL_ = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/journal`;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type DescribeContext = { missionTitle: string; phase: string };

/**
 * Asks the `journal` edge function (hosted Gemma) to write an entry about the photo.
 * Returns null on ANY failure so the caller can fall back to the user writing it themselves.
 */
export async function describePhoto(photo: Blob, ctx: DescribeContext): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn("describePhoto: NEXT_PUBLIC_SUPABASE_URL is not set");
    return null;
  }
  try {
    const image = await blobToBase64(photo);
    const res = await fetch(URL_, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ image, missionTitle: ctx.missionTitle, phase: ctx.phase }),
      signal: AbortSignal.timeout(60_000), // image calls to hosted Gemma can be slow; the function gives up at ~55 s
    });
    if (!res.ok) {
      console.warn("journal function failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const { entry } = await res.json();
    return typeof entry === "string" && entry.trim() ? entry.trim() : null;
  } catch (e) {
    console.warn("describePhoto error:", e);
    return null;
  }
}