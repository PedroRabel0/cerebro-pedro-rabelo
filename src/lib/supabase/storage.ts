import { createClient } from "./server";

/**
 * Upload an image to Supabase Storage ("generated-images" bucket).
 *
 * Accepts either:
 *  - A base64 data URL  (e.g. `data:image/png;base64,iVBOR...`)
 *  - A hosted URL        (e.g. DALL-E temporary URL)
 *
 * Returns the public URL from Supabase Storage, or null on failure.
 */
export async function uploadImageToStorage(
  imageData: string,
  contentId: string
): Promise<string | null> {
  try {
    const supabase = await createClient();
    const timestamp = Date.now();
    const isBase64 = imageData.startsWith("data:");

    let buffer: Buffer;
    let mimeType: string;

    if (isBase64) {
      // Parse data URL: data:<mime>;base64,<data>
      const match = imageData.match(
        /^data:(image\/[a-zA-Z+]+);base64,(.+)$/
      );
      if (!match) {
        console.error("[Storage] Invalid base64 data URL format");
        return null;
      }
      mimeType = match[1];
      buffer = Buffer.from(match[2], "base64");
    } else {
      // Fetch image from hosted URL (e.g. DALL-E)
      const response = await fetch(imageData);
      if (!response.ok) {
        console.error(
          `[Storage] Failed to fetch image from URL: ${response.status}`
        );
        return null;
      }
      mimeType =
        response.headers.get("content-type") || "image/png";
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    // Determine file extension from mime type
    const ext = mimeType.split("/")[1]?.replace("+xml", "") || "png";
    const filePath = `content-images/${contentId}-${timestamp}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("generated-images")
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Storage] Upload failed:", uploadError.message);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("generated-images").getPublicUrl(filePath);

    console.log(`[Storage] Uploaded image: ${filePath}`);
    return publicUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Storage] uploadImageToStorage error:", message);
    return null;
  }
}
