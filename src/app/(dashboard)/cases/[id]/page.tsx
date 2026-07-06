export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { notFound } from "next/navigation";
import { getCase } from "../actions";
import CaseDetail from "./CaseDetail";

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getCase(id);
  if (!data) notFound();

  return <CaseDetail initialCase={data.case} photos={data.photos} />;
}
