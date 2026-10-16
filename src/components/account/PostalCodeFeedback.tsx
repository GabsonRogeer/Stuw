import { LoaderCircle } from 'lucide-react';

export function PostalCodeFeedback({
  id,
  status,
  message,
  onRetry,
}: {
  id: string;
  status: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div id={id} className="text-xs text-stuw-slate space-y-2">
      <p role="status" aria-live="polite" aria-atomic="true" className="flex items-start gap-2">
        {status === 'loading' && (
          <LoaderCircle size={14} className="animate-spin shrink-0" aria-hidden="true" />
        )}
        {message || 'Digite os 8 dígitos do CEP para preencher o endereço.'}
      </p>
      {status === 'error' && (
        <button type="button" onClick={onRetry} className="underline underline-offset-4">
          Tentar buscar novamente
        </button>
      )}
    </div>
  );
}
