import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { purchaseEmail } from '@/services/email-templates';
import { smtpTransport } from './smtp';

export async function processEmailOutbox() {
  if (process.env.TRANSACTIONAL_EMAIL_ENABLED !== 'true')
    return { enabled: false, sent: 0, failed: 0 };
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site || new URL(site).protocol !== 'https:')
    throw new Error('Public HTTPS site URL required');
  const transport = smtpTransport();
  const db = createServiceClient();
  let sent = 0;
  let failed = 0;
  try {
    // Verify before claiming any messages. An outage must not consume the queue.
    await transport.verify();
    const stale = await db
      .from('email_outbox')
      .update({ status: 'uncertain', last_error: 'Worker interrupted; reconcile before retry' })
      .eq('status', 'sending')
      .lt('claimed_at', new Date(Date.now() - 10 * 60000).toISOString());
    if (stale.error) throw new Error('Email queue unavailable');
    const { data, error } = await db
      .from('email_outbox')
      .select('*')
      .eq('status', 'pending')
      .lte('available_at', new Date().toISOString())
      .order('available_at')
      .limit(3);
    if (error) throw new Error('Email queue unavailable');
    await Promise.all(
      data.map(async (row) => {
        // Compare-and-swap: concurrent jobs cannot send the same pending row.
        const claim = await db
          .from('email_outbox')
          .update({
            status: 'sending',
            claimed_at: new Date().toISOString(),
            attempts: row.attempts + 1,
          })
          .eq('id', row.id)
          .eq('status', 'pending')
          .eq('attempts', row.attempts)
          .select('*')
          .maybeSingle();
        if (claim.error) {
          failed++;
          return;
        }
        if (!claim.data) return;
        let smtpStarted = false;
        let accepted = false;
        try {
          const result = await db.from('orders').select('*').eq('id', row.order_id).single();
          if (result.error || !result.data) throw new Error('Order unavailable');
          const order = result.data;
          if (order.is_demo || order.payment_test_mode || order.payment_status !== 'approved') {
            const cancel = await db
              .from('email_outbox')
              .update({ status: 'cancelled', last_error: 'Order no longer eligible' })
              .eq('id', row.id)
              .eq('status', 'sending');
            if (cancel.error) throw new Error('Queue update failed');
            return;
          }
          if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(order.customer_email))
            throw new Error('Invalid recipient');
          const message = purchaseEmail(order, site);
          smtpStarted = true;
          const delivery = await transport.sendMail({
            from: {
              name: process.env.SMTP_FROM_NAME || 'STUW',
              address: process.env.SMTP_FROM_EMAIL!,
            },
            to: order.customer_email,
            messageId: `<purchase-${row.id}@${new URL(site).hostname}>`,
            ...message,
          });
          if (delivery.rejected.length || delivery.accepted.length !== 1)
            throw new Error('Recipient rejected');
          accepted = true;
          const saved = await db
            .from('email_outbox')
            .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
            .eq('id', row.id)
            .eq('status', 'sending');
          if (saved.error) throw new Error('Queue update failed after SMTP');
          sent++;
        } catch {
          failed++;
          // SMTP cannot guarantee exactly-once delivery. Never automatically resend an ambiguous send.
          const status =
            smtpStarted || accepted ? 'uncertain' : row.attempts >= 4 ? 'failed' : 'pending';
          const saved = await db
            .from('email_outbox')
            .update({
              status,
              available_at: new Date(Date.now() + 5 * 60000).toISOString(),
              last_error: smtpStarted
                ? 'SMTP outcome requires manual reconciliation'
                : 'Preparation failed before SMTP',
            })
            .eq('id', row.id)
            .eq('status', 'sending');
          if (saved.error) console.warn('[email.outbox] Could not persist delivery state');
        }
      }),
    );
    return { enabled: true, sent, failed };
  } finally {
    transport.close();
  }
}
