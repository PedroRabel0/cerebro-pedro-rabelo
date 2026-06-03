import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  // Check for admin secret
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Test if table already exists by trying to select
  const { error: testError } = await supabase
    .from('trend_scans')
    .select('id')
    .limit(1);

  if (!testError) {
    return Response.json({ message: 'Table trend_scans already exists' });
  }

  // If table doesn't exist, we need to create it via SQL
  // Since we can't run raw SQL from the client, return the SQL to run manually
  return Response.json({
    message: 'Table trend_scans does not exist yet. Run this SQL in the Supabase SQL Editor:',
    sql: `create table if not exists public.trend_scans (
  id uuid primary key default gen_random_uuid(),
  scanned_at timestamptz not null default now(),
  profiles_scanned integer default 0,
  total_posts_analyzed integer default 0,
  new_posts_found integer default 0,
  cross_profile_insights text,
  top_themes jsonb default '[]',
  content_recommendations jsonb default '[]',
  per_profile_summary jsonb default '[]',
  created_at timestamptz not null default now()
);

alter table public.trend_scans enable row level security;
create policy "Authenticated users can manage trend_scans" on public.trend_scans
  for all using (auth.role() = 'authenticated');`
  });
}
