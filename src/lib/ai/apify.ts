/**
 * Apify Instagram Scraping — extracts post data from Instagram URLs.
 * Uses Apify's REST API directly (no SDK needed).
 */

export interface InstagramPostData {
  caption: string | null;
  likes: number;
  comments: number;
  thumbnail_url: string | null;
  posted_at: string | null;
  owner_username: string | null;
  owner_full_name: string | null;
  video_url: string | null;
  is_video: boolean;
  engagement_rate: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePostedAt(post: Record<string, unknown>): string | null {
  if (typeof post.timestamp === 'string') return post.timestamp;
  const epoch = post.takenAtTimestamp;
  if (typeof epoch === 'number' && epoch > 0) {
    return new Date(epoch * 1000).toISOString();
  }
  return null;
}

function mapPost(
  post: Record<string, unknown>,
  fallbackUsername?: string,
): InstagramPostData {
  const likes = (post.likesCount ?? post.likes ?? 0) as number;
  const comments = (post.commentsCount ?? post.comments ?? 0) as number;
  const followers = (post.ownerFollowerCount ?? post.ownerFollowersCount ?? 0) as number;

  const owner = (post.owner ?? {}) as Record<string, unknown>;

  return {
    caption: (post.caption ?? post.text ?? null) as string | null,
    likes,
    comments,
    thumbnail_url: (post.displayUrl ?? post.thumbnailUrl ?? post.imageUrl ?? null) as string | null,
    posted_at: parsePostedAt(post),
    owner_username: (post.ownerUsername ?? owner.username ?? fallbackUsername ?? null) as string | null,
    owner_full_name: (post.ownerFullName ?? owner.fullName ?? null) as string | null,
    video_url: (post.videoUrl ?? null) as string | null,
    is_video: Boolean(post.isVideo ?? (post.type === 'Video')),
    engagement_rate: followers > 0 ? ((likes + comments) / followers) * 100 : null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scrape a single Instagram post URL using Apify.
 * Uses the synchronous run endpoint for simplicity.
 */
export async function scrapeInstagramPost(
  url: string,
): Promise<InstagramPostData | { error: string }> {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) return { error: 'APIFY_TOKEN not configured' };

    const actorId = 'apify~instagram-post-scraper';
    const apiUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls: [url],
        resultsLimit: 1,
      }),
      signal: AbortSignal.timeout(60_000), // 60 s timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Apify] HTTP error:', response.status, errorText);
      return { error: `Apify retornou status ${response.status}` };
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return { error: 'Apify não retornou dados para este post' };
    }

    const result = mapPost(data[0] as Record<string, unknown>);

    console.log(
      `[Apify] Scraped Instagram post | likes: ${result.likes} | comments: ${result.comments}`,
    );

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Apify Error] scrapeInstagramPost:', message);
    return { error: `Falha ao scraper Instagram: ${message}` };
  }
}

/**
 * Scrape an Instagram profile's recent posts using Apify.
 */
export async function scrapeInstagramProfile(
  username: string,
  maxPosts: number = 12,
): Promise<InstagramPostData[] | { error: string }> {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) return { error: 'APIFY_TOKEN not configured' };

    const actorId = 'apify~instagram-scraper';
    const apiUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: 'posts',
        resultsLimit: maxPosts,
      }),
      signal: AbortSignal.timeout(120_000), // 2 min timeout for profiles
    });

    if (!response.ok) {
      return { error: `Apify retornou status ${response.status}` };
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return { error: 'Apify não retornou dados para este perfil' };
    }

    return data.map((post) =>
      mapPost(post as Record<string, unknown>, username),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Apify Error] scrapeInstagramProfile:', message);
    return { error: `Falha ao scraper perfil: ${message}` };
  }
}
