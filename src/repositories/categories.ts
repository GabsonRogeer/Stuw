import { cache } from 'react';
import { categories, activityCategories } from '@/data/navigation';
import { getSupabaseConfig, isSupabaseConfigured } from '@/lib/supabase/config';
import { categoryNavigation, type Category } from '@/services/categories';

export const getCategoryNavigation = cache(async () => {
  if (!isSupabaseConfigured()) return { categories, activityCategories };
  const { url, key } = getSupabaseConfig();
  const rows: Category[] = [];
  // A cursor avoids both the API row limit and increasingly expensive offsets.
  let after = 0;
  for (;;) {
    const response = await fetch(
      `${url}/rest/v1/product_categories?select=id,kind,label,value,position,archived&archived=eq.false&id=gt.${after}&order=id&limit=500`,
      { headers: { apikey: key }, cache: 'no-store', signal: AbortSignal.timeout(8000) },
    );
    // Only the pre-migration state uses the original categories. An empty managed list stays empty.
    if (response.status === 404) return { categories, activityCategories };
    if (!response.ok) throw new Error('Não foi possível carregar as categorias.');
    const batch: Category[] = await response.json();
    if (!batch.length) break;
    rows.push(...batch);
    after = batch[batch.length - 1].id;
  }
  rows.sort((a, b) => a.position - b.position || a.id - b.id);
  return categoryNavigation(rows);
});
