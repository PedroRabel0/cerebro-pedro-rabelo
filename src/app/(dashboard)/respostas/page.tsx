export const revalidate = 30;

import { getResponses } from "./actions";
import ResponsesBank from "./ResponsesBank";
import { MessageCircle } from "lucide-react";

export default async function RespostasPage() {
  const responses = await getResponses();

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-purple/20">
            <MessageCircle className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Pedro Clone
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Respostas automaticas na voz do Pedro
            </p>
          </div>
        </div>
      </div>

      <ResponsesBank initialResponses={responses} />
    </div>
  );
}
