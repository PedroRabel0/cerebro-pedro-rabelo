"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "pedro" | "henrique";

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const r = user?.user_metadata?.role as UserRole | undefined;
      setRole(r ?? null);
      setLoading(false);
    });
  }, []);

  return {
    role,
    loading,
    isPedro: role === "pedro",
    isHenrique: role === "henrique",
  };
}
