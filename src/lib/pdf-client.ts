// Client-only helpers to turn an uploaded PDF (carousel export) into image files.
// Runs entirely in the browser via pdf.js so the server never touches the PDF.

/**
 * Render each PDF page to a 2160px-wide JPEG File (2x o 1080 do Instagram —
 * qualidade maxima; texto sem serrilhado). Com slides mais pesados, o envio
 * pro servidor e feito em LOTES pelo chamador (uploadFilesInBatches).
 */
export async function pdfToImageFiles(file: File): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const baseName = file.name.replace(/\.pdf$/i, "") || "carrossel";
  const files: File[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = 2160 / base.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob | null>((res) =>
      // 0.95: visualmente sem perda em texto/design (0.85 serrilhava)
      canvas.toBlob((b) => res(b), "image/jpeg", 0.95)
    );
    if (blob) {
      const name = `${baseName}-slide-${String(i).padStart(2, "0")}.jpg`;
      files.push(new File([blob], name, { type: "image/jpeg" }));
    }
  }
  return files;
}

export function isPdf(f: File): boolean {
  return f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
}

/**
 * Extrai o TEXTO de um PDF no navegador via pdf.js — funciona com PDFs
 * modernos (streams comprimidos/FlateDecode), que o extrator caseiro do
 * servidor nao consegue ler. Retorna "" para PDFs so de imagem (scan).
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s{3,}/g, "\n")
      .trim();
    if (pageText) parts.push(pageText);
  }
  return parts.join("\n\n").trim();
}

function isImage(f: File): boolean {
  return f.type.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(f.name);
}

/**
 * Normalize a drop/selection of PDFs and images into an ordered list of image
 * Files: PDFs are split into per-page slides, images pass through. Sorted by
 * filename (numeric-aware) so slide-1, slide-2, ... stay in order.
 * Returns { files, ignored } so the caller can warn about unrecognized files.
 */
export async function filesToImageFiles(
  input: FileList | File[]
): Promise<{ files: File[]; ignored: string[] }> {
  const arr = Array.from(input)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const files: File[] = [];
  const ignored: string[] = [];

  for (const f of arr) {
    if (isPdf(f)) {
      files.push(...(await pdfToImageFiles(f)));
    } else if (isImage(f)) {
      files.push(f);
    } else {
      ignored.push(f.name);
    }
  }
  return { files, ignored };
}
