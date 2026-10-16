import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { Order } from '@/types/database';
import { assertRemoteInvoice } from './olist-invoices';

export const INVOICE_FILE_LIMIT = 4 * 1024 * 1024;

function parser(stopNodes: string[] = []) {
  return new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: false,
    stopNodes,
  });
}
function validXml(xml: string) {
  if (!xml || Buffer.byteLength(xml) > INVOICE_FILE_LIMIT || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new Error('XML fiscal inválido.');
  if (XMLValidator.validate(xml) !== true) throw new Error('XML fiscal inválido.');
}
export function extractInvoiceXml(response: string) {
  validXml(response);
  const result = parser(['retorno.xml_nfe']).parse(response).retorno;
  if (result?.status !== 'OK' || typeof result.xml_nfe !== 'string')
    throw new Error('XML autorizado ainda indisponível na Olist.');
  const xml = result.xml_nfe.trim();
  validXml(xml);
  return xml;
}

export function validateInvoiceXml(
  xml: string,
  order: Order,
  remoteId: string,
  invoice: Record<string, unknown>,
  taxDocument: string,
  components: { sku: string; quantity: number }[],
) {
  validXml(xml);
  const process = parser().parse(xml).nfeProc;
  const nfe = process?.NFe?.infNFe;
  const protocol = process?.protNFe?.infProt;
  const key = String(invoice.chave_acesso ?? '');
  if (
    !nfe ||
    !protocol ||
    nfe.ide?.tpAmb !== '1' ||
    protocol.tpAmb !== '1' ||
    !['100', '150'].includes(protocol.cStat) ||
    !/^\d{15}$/.test(protocol.nProt ?? '') ||
    !/^\d{44}$/.test(key) ||
    protocol.chNFe !== key ||
    nfe['@_Id'] !== `NFe${key}` ||
    nfe.ide?.mod !== '55' ||
    Number(nfe.ide?.nNF) !== Number(invoice.numero) ||
    Number(nfe.ide?.serie) !== Number(invoice.serie) ||
    !/^\d{14}$/.test(nfe.emit?.CNPJ ?? '') ||
    nfe.emit.CNPJ !== key.slice(6, 20) ||
    !Number.isFinite(Date.parse(protocol.dhRecbto ?? ''))
  )
    throw new Error('XML sem autorização de produção ou com identidade fiscal divergente.');
  const details: { prod?: { cProd?: string; qCom?: string; NCM?: string; CFOP?: string } }[] =
    Array.isArray(nfe.det) ? nfe.det : [nfe.det];
  assertRemoteInvoice(
    order,
    {
      id: invoice.id,
      id_venda: remoteId,
      valor_nota: nfe.total?.ICMSTot?.vNF,
      cliente: { cpf_cnpj: nfe.dest?.CPF ?? nfe.dest?.CNPJ },
      itens: details.map((d) => ({
        item: {
          codigo: d?.prod?.cProd,
          quantidade: d?.prod?.qCom,
          ncm: d?.prod?.NCM,
          cfop: d?.prod?.CFOP,
        },
      })),
    },
    remoteId,
    String(invoice.id),
    taxDocument,
    components,
  );
  return {
    number: String(Number(nfe.ide.nNF)),
    series: String(Number(nfe.ide.serie)),
    accessKey: key,
    authorizedAt: new Date(protocol.dhRecbto).toISOString(),
  };
}

// Only official print views returned by the authenticated Olist API are fetched.
export function olistDocumentUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !['erp.olist.com', 'erp.tiny.com.br', 'www.tiny.com.br'].includes(url.hostname) ||
    url.pathname !== '/doc.view' ||
    url.hash
  )
    throw new Error('Endereço de documento fiscal inválido.');
  return url;
}
