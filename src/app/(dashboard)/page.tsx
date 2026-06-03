export const dynamic = "force-dynamic";
export const maxDuration = 60;

import BrainChat from "@/components/BrainChat";

export default async function DashboardHome() {
  return (
    <div className="fixed inset-0 md:left-56">
      <BrainChat />
    </div>
  );
}
