export const OPERATION_STAGES: Record<string, string> = {
  awaiting_pick: 'Aguardando separação',
  picked: 'Separado',
  checked: 'Conferido',
  invoiced: 'Faturado',
  posted: 'Postado',
};
export const RETURN_STAGES: Record<string, string> = {
  requested: 'Solicitado',
  authorized: 'Autorizado',
  received: 'Recebido',
  inspected: 'Conferido',
  completed: 'Concluído',
  rejected: 'Recusado / cancelado',
};
export const RETURN_NEXT: Record<string, string[]> = {
  requested: ['authorized', 'rejected'],
  authorized: ['received', 'rejected'],
  received: ['inspected'],
  inspected: ['completed'],
  completed: [],
  rejected: [],
};
export const STAFF_ROLES: Record<string, string> = {
  logistics: 'Expedição',
  support: 'Atendimento',
  finance: 'Financeiro',
  auditor: 'Auditoria',
};
export const money = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const localTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
