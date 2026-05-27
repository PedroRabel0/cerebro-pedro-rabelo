"use server";

import { createClient } from "@/lib/supabase/server";

export interface MonthlyCostRow {
  month: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export async function getMonthlyCosts(): Promise<MonthlyCostRow[]> {
  const supabase = await createClient();

  // Fetch all logs from the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("api_cost_log")
    .select("input_tokens, output_tokens, cost_usd, created_at")
    .gte("created_at", sixMonthsAgo.toISOString())
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  // Group by month
  const grouped = new Map<string, MonthlyCostRow>();

  for (const row of data) {
    const date = new Date(row.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        month: key,
        calls: 0,
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
      });
    }

    const entry = grouped.get(key)!;
    entry.calls += 1;
    entry.input_tokens += row.input_tokens ?? 0;
    entry.output_tokens += row.output_tokens ?? 0;
    entry.cost_usd += row.cost_usd ?? 0;
  }

  // Sort descending by month
  return Array.from(grouped.values()).sort((a, b) =>
    b.month.localeCompare(a.month)
  );
}

export interface ProviderCostRow {
  provider: string;
  calls: number;
  cost_usd: number;
}

export async function getCostsByProvider(): Promise<ProviderCostRow[]> {
  const supabase = await createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await supabase
    .from("api_cost_log")
    .select("provider, cost_usd")
    .gte("created_at", startOfMonth.toISOString());

  if (error || !data) {
    return [];
  }

  const grouped = new Map<string, ProviderCostRow>();

  for (const row of data) {
    const provider = (row.provider as string) || "anthropic";
    if (!grouped.has(provider)) {
      grouped.set(provider, { provider, calls: 0, cost_usd: 0 });
    }
    const entry = grouped.get(provider)!;
    entry.calls += 1;
    entry.cost_usd += row.cost_usd ?? 0;
  }

  return Array.from(grouped.values()).sort((a, b) => b.cost_usd - a.cost_usd);
}

export async function getCurrentMonthCost(): Promise<number> {
  const supabase = await createClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await supabase
    .from("api_cost_log")
    .select("cost_usd")
    .gte("created_at", startOfMonth.toISOString());

  if (error || !data) {
    return 0;
  }

  return data.reduce((sum, row) => sum + (row.cost_usd ?? 0), 0);
}
