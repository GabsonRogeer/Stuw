'use client';

import { useEffect, useRef, useState } from 'react';
import { postalCodeDigits, type PostalAddress } from '@/services/postal-code';

type Pending = {
  sequence: number;
  debounce: ReturnType<typeof setTimeout> | null;
  timeout: ReturnType<typeof setTimeout> | null;
  controller: AbortController | null;
};
type Status = 'idle' | 'loading' | 'success' | 'not_found' | 'error';

function stop(pending: Pending) {
  pending.sequence++;
  if (pending.debounce) clearTimeout(pending.debounce);
  if (pending.timeout) clearTimeout(pending.timeout);
  pending.controller?.abort();
  pending.debounce = null;
  pending.timeout = null;
  pending.controller = null;
}

export function usePostalCode() {
  const [feedback, setFeedback] = useState<{ status: Status; message: string }>({
    status: 'idle',
    message: '',
  });
  const pending = useRef<Pending>({ sequence: 0, debounce: null, timeout: null, controller: null });
  useEffect(() => {
    const current = pending.current;
    return () => stop(current);
  }, []);

  function cancel() {
    stop(pending.current);
    setFeedback({ status: 'idle', message: '' });
  }

  function lookup(value: string, onFound: (address: PostalAddress) => void) {
    const current = pending.current;
    stop(current);
    const cep = postalCodeDigits(value);
    if (!/^\d{8}$/.test(cep)) {
      setFeedback({ status: 'idle', message: '' });
      return;
    }
    const sequence = current.sequence;
    setFeedback({ status: 'loading', message: 'Buscando endereço pelo CEP…' });
    current.debounce = setTimeout(async () => {
      const controller = new AbortController();
      current.controller = controller;
      const timeout = setTimeout(() => controller.abort(), 8000);
      current.timeout = timeout;
      try {
        const response = await fetch(`/api/cep/${cep}`, { signal: controller.signal });
        if (current.sequence !== sequence) return;
        if (response.status === 404) {
          setFeedback({
            status: 'not_found',
            message: 'CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.',
          });
          return;
        }
        if (!response.ok) throw new Error('Postal service unavailable');
        const address: PostalAddress = await response.json();
        if (current.sequence !== sequence || controller.signal.aborted) return;
        onFound(address);
        setFeedback({
          status: 'success',
          message:
            address.street && address.district
              ? 'Endereço localizado. Confira os dados antes de continuar.'
              : 'CEP localizado. Complete os campos de endereço não preenchidos.',
        });
      } catch {
        if (current.sequence === sequence)
          setFeedback({
            status: 'error',
            message:
              'Não foi possível buscar o CEP agora. Você pode preencher o endereço manualmente.',
          });
      } finally {
        clearTimeout(timeout);
        if (current.sequence === sequence) {
          current.timeout = null;
          current.controller = null;
        }
      }
    }, 350);
  }

  return { ...feedback, lookup, cancel };
}
