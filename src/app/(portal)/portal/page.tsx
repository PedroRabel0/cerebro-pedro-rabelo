import { getClientCompany, getClientChat } from "../actions";
import PortalChat from "./PortalChat";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const [company, chat] = await Promise.all([
    getClientCompany(),
    getClientChat(),
  ]);

  if ("error" in company) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-text-secondary">
        Nao foi possivel carregar seu portal. {company.error}
      </div>
    );
  }

  return <PortalChat company={company} initialChat={chat} />;
}
