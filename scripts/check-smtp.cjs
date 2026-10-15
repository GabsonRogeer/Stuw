// Never print credentials, SMTP responses or message bodies.
const { loadEnvConfig } = require('@next/env');
const nodemailer = require('nodemailer');

loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

async function main() {
  const send = process.argv.includes('--send');
  const required = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM_EMAIL',
  ];
  if (send) required.push('SMTP_TEST_TO');
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error('Variáveis ausentes: ' + missing.join(', '));
    process.exitCode = 1;
    return;
  }
  const port = Number(process.env.SMTP_PORT);
  const secure = process.env.SMTP_SECURE === 'true';
  if (!((port === 465 && secure) || (port === 587 && process.env.SMTP_SECURE === 'false'))) {
    console.error(
      'Use porta 465 com SMTP_SECURE=true ou 587 com SMTP_SECURE=false (STARTTLS obrigatório).',
    );
    process.exitCode = 1;
    return;
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    await transport.verify();
    console.log('Conexão TLS e autenticação SMTP verificadas.');
    if (!send) return;
    const to = process.env.SMTP_TEST_TO;
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)) {
      console.error('SMTP_TEST_TO deve conter um único endereço de e-mail.');
      process.exitCode = 1;
      return;
    }
    const result = await transport.sendMail({
      from: { name: process.env.SMTP_FROM_NAME || 'STUW', address: process.env.SMTP_FROM_EMAIL },
      to,
      subject: 'STUW — teste de envio SMTP',
      text: 'Este é um teste autorizado de envio de e-mail da STUW pela Hostinger.\n\nNenhuma compra ou cobrança foi realizada.\n\nSe recebeu esta mensagem, confirme o recebimento na conversa de configuração.',
    });
    if (result.rejected.length || result.accepted.length !== 1) {
      console.error('O servidor não aceitou o destinatário do teste.');
      process.exitCode = 1;
      return;
    }
    console.log(
      'Mensagem de teste aceita pelo servidor SMTP. O recebimento na caixa de entrada ainda deve ser confirmado.',
    );
  } finally {
    transport.close();
  }
}

main().catch((error) => {
  const codes = ['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'EENVELOPE', 'EMESSAGE'];
  console.error(
    'Falha SMTP: ' + (codes.includes(error.code) ? error.code : 'erro de conexão ou envio'),
  );
  process.exitCode = 1;
});
