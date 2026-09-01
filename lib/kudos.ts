import { createClient } from "@/lib/supabase/server";

export interface KudosInfo {
  count: number;
  givenByMe: boolean;
}

// Ein Batch-Read für eine ganze Liste von Fahrten statt einer Query pro
// Kudos-Button. kudos_summary (0029) ist bereits auf öffentliche Fahrten gefiltert, die
// zweite Query (eigene Kudos) braucht deshalb keinen zusätzlichen
// ist_oeffentlich-Check.
export async function getKudosForCompletions(
  completionIds: string[],
  userId: string | null,
): Promise<Map<string, KudosInfo>> {
  const result = new Map<string, KudosInfo>();
  if (completionIds.length === 0) return result;

  const supabase = await createClient();

  const [{ data: summary }, { data: own }] = await Promise.all([
    supabase.from("kudos_summary").select("completion_id, kudos_count").in("completion_id", completionIds),
    userId
      ? supabase.from("kudos").select("completion_id").eq("user_id", userId).in("completion_id", completionIds)
      : Promise.resolve({ data: [] as { completion_id: string }[] }),
  ]);

  const ownIds = new Set((own ?? []).map((k) => k.completion_id));

  for (const id of completionIds) {
    result.set(id, { count: 0, givenByMe: ownIds.has(id) });
  }
  for (const row of summary ?? []) {
    result.set(row.completion_id, {
      count: row.kudos_count,
      givenByMe: ownIds.has(row.completion_id),
    });
  }

  return result;
}
