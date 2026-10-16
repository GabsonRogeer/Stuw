import 'server-only';

export class OlistError extends Error {
  constructor(
    public code: string,
    public uncertain = false,
  ) {
    super(`Olist: ${code}`);
  }
}

export type OlistProduct = {
  id: string | number;
  codigo: string;
  nome: string;
  unidade?: string;
  preco?: string | number;
  ncm?: string;
  cest?: string;
  origem?: string;
  tipo?: string;
  tipoVariacao?: string;
  classe_produto?: string;
  situacao?: string;
  descricao_complementar?: string;
  marca?: string;
  categoria?: string;
  kit?: { item: { id_produto: string | number; quantidade: string | number } }[];
  gtin?: string;
  peso_bruto?: string | number;
  alturaEmbalagem?: string | number;
  larguraEmbalagem?: string | number;
  comprimentoEmbalagem?: string | number;
  grade?: Record<string, string>;
  idProdutoPai?: string | number;
  variacoes?: { variacao: OlistProduct }[];
  anexos?: { anexo: string }[];
  imagens_externas?: { imagem_externa: { url: string } }[];
};
export type OlistResult = {
  status: string;
  codigo_erro?: number | string;
  pagina?: number;
  numero_paginas?: number;
  produtos?: { produto: OlistProduct }[];
  produto?: OlistProduct;
  categorias?: { id: number; descricao: string; nodes?: unknown[] }[];
  registros?: {
    registro: {
      status?: string;
      id?: string | number;
      idNotaFiscal?: string | number;
      codigo_erro?: string | number;
    };
  }[];
  pedidos?: { pedido: Record<string, unknown> }[];
  pedido?: Record<string, unknown>;
  nota_fiscal?: Record<string, unknown>;
  link_nfe?: string;
};

const endpoints = [
  'produtos.categorias.arvore.php',
  'produtos.pesquisa.php',
  'produto.obter.php',
  'produto.incluir.php',
  'produto.alterar.php',
  'produto.obter.estoque.php',
  'pedidos.pesquisa.php',
  'pedido.incluir.php',
  'pedido.obter.php',
  'nota.fiscal.obter.php',
  'nota.fiscal.obter.link.php',
  'gerar.nota.fiscal.pedido.php',
  'nota.fiscal.emitir.php',
] as const;
export async function olistRequest(
  endpoint: (typeof endpoints)[number],
  params: Record<string, string> = {},
): Promise<OlistResult> {
  const token = process.env.OLIST_API_TOKEN;
  if (!token) throw new OlistError('TOKEN_MISSING');
  if (!endpoints.includes(endpoint)) throw new OlistError('ENDPOINT_INVALID');
  const fiscalMutation =
    endpoint === 'gerar.nota.fiscal.pedido.php' || endpoint === 'nota.fiscal.emitir.php';
  const mutation =
    endpoint.includes('.incluir.') || endpoint.includes('.alterar.') || fiscalMutation;
  if (mutation && process.env.OLIST_ENABLED !== 'true') throw new OlistError('DISABLED');
  if (fiscalMutation && process.env.OLIST_INVOICE_ENABLED !== 'true')
    throw new OlistError('INVOICE_DISABLED');
  let response: Response;
  try {
    response = await fetch(`https://api.tiny.com.br/api2/${endpoint}`, {
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, token, formato: 'JSON' }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new OlistError('CONNECTION', mutation);
  }
  if (!response.ok) throw new OlistError(`HTTP_${response.status}`, mutation);
  let result: OlistResult;
  try {
    const text = await response.text();
    if (text.length > 4_000_000) throw new Error();
    result = JSON.parse(text).retorno;
    // V2 returns { retorno: [] } when the category tree has no entries.
    if (endpoint === 'produtos.categorias.arvore.php' && Array.isArray(result))
      result = { status: 'OK', categorias: result };
    if (!result || !['OK', 'Erro'].includes(result.status)) throw new Error();
  } catch {
    throw new OlistError('RESPONSE_INVALID', mutation);
  }
  if (result.status !== 'OK')
    throw new OlistError(
      `API_${
        String(result.codigo_erro ?? 'ERROR')
          .replace(/[^0-9]/g, '')
          .slice(0, 8) || 'ERROR'
      }`,
      mutation,
    );
  return result;
}

export async function listOlistProducts(page = 1, search = '') {
  try {
    const result = await olistRequest('produtos.pesquisa.php', {
      pesquisa: search,
      pagina: String(page),
    });
    return {
      products: result.produtos?.map((row) => row.produto) ?? [],
      pages: Number(result.numero_paginas || 1),
    };
  } catch (error) {
    if (error instanceof OlistError && error.code === 'API_20') return { products: [], pages: 1 };
    throw error;
  }
}

export async function getOlistProduct(id: string) {
  if (!/^[1-9]\d{0,18}$/.test(id)) throw new OlistError('ID_INVALID');
  const result = await olistRequest('produto.obter.php', { id });
  if (!result.produto || String(result.produto.id) !== id) throw new OlistError('PRODUCT_INVALID');
  return result.produto;
}
