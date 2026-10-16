import 'server-only';
import { olistDocumentUrl, INVOICE_FILE_LIMIT } from '@/services/invoice-documents';

export async function renderOlistDanfe(link: string, accessKey: string) {
  const url = olistDocumentUrl(link);
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('DANFE indisponível na Olist.');
  const html = await response.text();
  if (Buffer.byteLength(html) > INVOICE_FILE_LIMIT || !html.replace(/\s/g, '').includes(accessKey))
    throw new Error('DANFE com identidade fiscal divergente.');
  const [{ default: puppeteer }, { default: chromium }] = await Promise.all([
    import('puppeteer-core'),
    import('@sparticuz/chromium'),
  ]);
  chromium.setGraphicsMode = false;
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath:
        process.env.INVOICE_CHROMIUM_EXECUTABLE_PATH || (await chromium.executablePath()),
      args: process.platform === 'linux' ? chromium.args : [],
      headless: 'shell',
      timeout: 15000,
    });
  } catch {
    throw new Error('PDF_BROWSER_FAILED');
  }
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const target = request.url();
      const css = new URL('/styles/danfe.css', url);
      const allowed =
        target.startsWith('data:image/png;base64,') ||
        (request.resourceType() === 'stylesheet' && target.startsWith(css.href + '?'));
      void (allowed ? request.continue() : request.abort());
    });
    // The provider HTML is rendered without JavaScript, cookies or API credentials.
    const content = html.replace(/<head([^>]*)>/i, `<head$1><base href="${url.origin}/">`);
    await page.setContent(content, { waitUntil: 'load', timeout: 20000 });
    const pdf = Buffer.from(
      await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        timeout: 20000,
      }),
    );
    if (pdf.length > INVOICE_FILE_LIMIT || pdf.subarray(0, 5).toString() !== '%PDF-')
      throw new Error('Falha ao preparar o PDF fiscal.');
    return pdf;
  } catch {
    throw new Error('PDF_RENDER_FAILED');
  } finally {
    await browser.close();
  }
}
