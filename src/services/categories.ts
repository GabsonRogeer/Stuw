export type CategoryKind = 'piece' | 'activity';
export type Category = {
  id: number;
  kind: CategoryKind;
  label: string;
  value: string;
  position: number;
  archived: boolean;
  revision: number;
};
export type CategoryInput = Pick<Category, 'kind' | 'label' | 'position'>;
export type CategoryOption = Pick<Category, 'label' | 'value'>;
export type CategoryNavigation = {
  categories: CategoryOption[];
  activityCategories: CategoryOption[];
};
export const CATEGORY_KINDS = { piece: 'Tipo de peça', activity: 'Linha de uso' } as const;

export function validateCategory(input: CategoryInput): string | null {
  if (!input || !Object.hasOwn(CATEGORY_KINDS, input.kind)) return 'Selecione o tipo de categoria.';
  if (typeof input.label !== 'string' || !input.label.trim() || input.label.trim().length > 80)
    return 'Informe um nome com até 80 caracteres.';
  if (!Number.isInteger(input.position) || input.position < 0 || input.position > 999999)
    return 'A ordem deve ser um número inteiro entre 0 e 999999.';
  return null;
}

export function categoryNavigation(rows: Category[]): CategoryNavigation {
  const active = rows.filter((row) => !row.archived);
  return {
    categories: active
      .filter((row) => row.kind === 'piece')
      .map(({ label, value }) => ({ label, value })),
    activityCategories: active
      .filter((row) => row.kind === 'activity')
      .map(({ label, value }) => ({ label, value })),
  };
}
