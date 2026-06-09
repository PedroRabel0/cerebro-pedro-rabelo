export const dynamic = "force-dynamic";

import { Upload } from "lucide-react";
import { getExternalUploads } from "./actions";
import UploadExterno from "./UploadExterno";

export default async function UploadExternoPage() {
  const uploads = await getExternalUploads();

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-violet/20">
            <Upload className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Upload Externo
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Suba posts criados fora da plataforma — eles aparecem no calendário para agendar
            </p>
          </div>
        </div>
      </div>

      <UploadExterno existingUploads={uploads} />
    </div>
  );
}
