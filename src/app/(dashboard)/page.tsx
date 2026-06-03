export const dynamic = "force-dynamic";
export const maxDuration = 60;

import BrainChat from "@/components/BrainChat";

export default async function DashboardHome() {
  return (
    <div className="relative h-[calc(100vh-6rem)]">
      <BrainChat />
    </div>
  );
}
