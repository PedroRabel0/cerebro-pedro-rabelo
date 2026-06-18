export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { notFound } from "next/navigation";
import { getCompany, getGoogleStatus } from "../actions";
import CompanyDetail from "./CompanyDetail";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, googleStatus] = await Promise.all([getCompany(id), getGoogleStatus()]);
  if (!data) notFound();

  return <CompanyDetail data={data} googleConnected={googleStatus.connected} />;
}
