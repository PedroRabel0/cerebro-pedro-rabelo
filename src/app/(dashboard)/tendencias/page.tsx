export const dynamic = "force-dynamic";
export const maxDuration = 60; // Radar faz scraping + IA — precisa de mais que os ~10s padrão

import {
  getTrends,
  getAllProfiles,
  getLatestScan,
  getRadarStats,
  getAcceptedRecommendationTitles,
} from "./actions";
import TrendsPanel from "./TrendsPanel";
import { TrendingUp } from "lucide-react";

export default async function TendenciasPage() {
  const [trends, profiles, latestScan, stats, acceptedTitlesSet] = await Promise.all([
    getTrends(),
    getAllProfiles(),
    getLatestScan(),
    getRadarStats(),
    getAcceptedRecommendationTitles(),
  ]);

  // Convert Set to array for serialization to client component
  const acceptedTitles = Array.from(acceptedTitlesSet);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-accent/20">
            <TrendingUp className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">
              Tendencias
            </h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              Radar automatico de referencias + tendencias manuais
            </p>
          </div>
        </div>
      </div>

      <TrendsPanel
        initialTrends={trends}
        initialProfiles={profiles}
        initialScan={latestScan}
        initialStats={stats}
        initialAcceptedTitles={acceptedTitles}
      />
    </div>
  );
}
