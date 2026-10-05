'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { requireAdmin } from '@/lib/supabase/admin';
import { PRODUCTS } from '@/data/products';
import { access } from 'node:fs/promises';
import path from 'node:path';
import {
  validateProduct,
  toStoreProduct,
  PRODUCT_BUCKET,
  type ProductDraft,
  type AdminProduct,
} from '@/services/product-admin';

type Result = { error?: string; record?: AdminProduct };
function refresh() {
  updateTag('product-catalog');
  revalidatePath('/', 'layout');
}
export async function saveProduct(input: {
  id: number | null;
  revision: number;
  document: ProductDraft;
}): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (
      !input ||
      !Number.isInteger(input.revision) ||
      input.revision < 0 ||
      (input.id !== null && (!Number.isInteger(input.id) || input.id < 1))
    )
      return { error: 'Identificação inválida. Recarregue o cadastro.' };
    if (input.revision === 0 && input.id !== null && !PRODUCTS.some((p) => p.id === input.id))
      return { error: 'Produto de origem não encontrado.' };
    const invalid = validateProduct(input.document);
    if (invalid) return { error: invalid };
    if (PRODUCTS.some((p) => p.slug === input.document.slug && p.id !== input.id))
      return { error: 'Este slug já pertence a um produto publicado.' };
    const p = { ...input.document, lastSync: '' };
    if (input.id && input.revision) {
      const current = await supabase
        .from('admin_products')
        .select('document')
        .eq('id', input.id)
        .single();
      if (current.error) return { error: 'Não foi possível conferir a revisão atual.' };
      p.lastSync = current.data.document.lastSync;
    }
    if (p.status === 'active') {
      const localPaths = [
        ...new Set(
          p.colors
            .filter((c) => c.active)
            .flatMap((c) => [...c.images.map((m) => m.src), c.swatch])
            .filter((s) => s.startsWith('/products/')),
        ),
      ];
      const files = await Promise.allSettled(
        localPaths.map((src) => access(path.join(process.cwd(), 'public', src))),
      );
      if (files.some((r) => r.status === 'rejected'))
        return {
          error:
            'Uma imagem local não existe. Confira o caminho ou envie o arquivo antes de publicar.',
        };
      const paths = [
        ...new Set(
          p.colors
            .filter((c) => c.active)
            .flatMap((c) => [...c.images.map((m) => m.src), c.swatch])
            .filter((s) => s.startsWith('/api/product-images/'))
            .map((s) => s.split('/').at(-1)!),
        ),
      ];
      const checks = await Promise.all(
        paths.map((path) => supabase.storage.from(PRODUCT_BUCKET).info(path)),
      );
      if (checks.some((r) => r.error))
        return { error: 'Uma imagem não está disponível. Envie-a novamente antes de publicar.' };
    }
    const regular = toStoreProduct(input.id ?? 0, { ...p, salePrice: null });
    const promotion = toStoreProduct(input.id ?? 0, p, p.saleStart ? Date.parse(p.saleStart) : 0);
    const { data: id, error } = await supabase.rpc('save_product', {
      input_id: input.id,
      expected_revision: input.revision,
      input_document: p,
      input_payload: { regular, promotion, saleStart: p.saleStart, saleEnd: p.saleEnd },
      legacy_slug: PRODUCTS.find((p) => p.id === input.id)?.slug ?? null,
    });
    if (error?.code === '23505')
      return {
        error:
          'Slug, SKU ou EAN/GTIN já cadastrado. Confira também se o produto foi criado em outra sessão.',
      };
    if (error?.code === '40001')
      return { error: 'Outra sessão alterou este cadastro. Recarregue a página antes de salvar.' };
    if (error || !id)
      return {
        error:
          'Não foi possível salvar. Confira a migração do catálogo e seu acesso administrativo.',
      };
    refresh();
    const record = await supabase.from('admin_products').select('*').eq('id', id).single();
    if (record.error)
      return {
        error:
          'Produto salvo, mas não foi possível recarregar. Atualize a página antes de editar novamente.',
      };
    return { record: record.data };
  } catch {
    return { error: 'Não foi possível salvar. Verifique sua conexão e seu acesso administrativo.' };
  }
}
export async function archiveProduct(id: number, revision: number): Promise<Result> {
  try {
    const { supabase } = await requireAdmin();
    if (!Number.isInteger(id) || !Number.isInteger(revision) || revision < 1)
      return { error: 'Cadastro inválido.' };
    const { error } = await supabase.rpc('archive_product', {
      input_id: id,
      expected_revision: revision,
    });
    if (error)
      return { error: 'Não foi possível arquivar. Recarregue o cadastro e confira sua revisão.' };
    refresh();
    return {};
  } catch {
    return { error: 'Verifique seu acesso administrativo.' };
  }
}
