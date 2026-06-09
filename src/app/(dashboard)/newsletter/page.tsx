export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { getNewsletters } from "./actions";
import NewsletterPanel from "./NewsletterPanel";
import { Mail } from "lucide-react";

export default async function NewsletterPage() {
  const newsletters = await getNewsletters();

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-red/20">
            <Mail className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Newsletter
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Gere newsletters semanais com IA
            </p>
          </div>
        </div>
      </div>

      <NewsletterPanel newsletters={newsletters} />
    </div>
  );
}
