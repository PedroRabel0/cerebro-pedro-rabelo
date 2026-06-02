export const revalidate = 30;
export const maxDuration = 60;

import { getRepurposeableContents } from "./actions";
import RepurposePanel from "./RepurposePanel";
import { Repeat2 } from "lucide-react";

export default async function RepurposePage() {
  const contents = await getRepurposeableContents();

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-purple/20">
            <Repeat2 className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Reaproveitar Conteudo
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Transforme um conteudo existente em multiplos formatos
              automaticamente.
            </p>
          </div>
        </div>
      </div>

      <RepurposePanel contents={contents} />
    </div>
  );
}
