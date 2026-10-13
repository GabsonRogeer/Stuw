import { SHIPMENT_LABELS, SHIPMENT_STEPS } from '@/services/fulfillment';
export function ShipmentTimeline({ status, paid }: { status: string; paid: boolean }) {
  const current = SHIPMENT_STEPS.indexOf(status as (typeof SHIPMENT_STEPS)[number]);
  return (
    <section aria-labelledby="shipment-timeline">
      <h3 id="shipment-timeline" className="font-serif text-xl mb-4">
        Acompanhe a entrega
      </h3>
      {!paid && (
        <p className="text-sm text-stuw-slate mb-4">O envio depende da confirmação do pagamento.</p>
      )}
      {current < 0 && (
        <p role="status" className="text-sm mb-4">
          {SHIPMENT_LABELS[status] ?? 'Consultando entrega'}
        </p>
      )}
      <ol className="grid gap-3 sm:grid-cols-5">
        {SHIPMENT_STEPS.map((step, index) => (
          <li
            key={step}
            aria-current={step === status ? 'step' : undefined}
            className={`border-t-2 pt-3 text-xs ${index <= current ? 'border-stuw-sage' : 'border-stuw-border dark:border-stuw-borderDark text-stuw-slate'}`}
          >
            <span className="block mb-1">{index + 1}</span>
            {SHIPMENT_LABELS[step]}
          </li>
        ))}
      </ol>
    </section>
  );
}
