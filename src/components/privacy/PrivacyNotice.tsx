'use client';

import { useState } from 'react';
import { usePersonalization } from '@/providers/personalization-provider';
import { Modal } from '@/components/ui/modal/modal';

function PrivacySettings() {
  const { choice, choose, closeSettings, clearHistory } = usePersonalization();
  const [cleared, setCleared] = useState(false);
  return (
    <Modal title="Cookies e privacidade" onClose={closeSettings}>
      <p className="text-sm leading-relaxed text-stuw-slate">
        Guardamos sua escolha neste navegador por 180 dias. Sacola e favoritos usam armazenamento
        local para manter as ações que você solicita.
      </p>
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Personalização opcional</h3>
        <p className="text-sm leading-relaxed text-stuw-slate">
          Se aceitar, guardamos os últimos 20 produtos vistos por até 30 dias neste navegador para
          mostrar seu histórico e sugestões. Esse histórico fica no dispositivo e não é enviado a
          serviços de publicidade. Recusar apaga o histórico e interrompe o registro de visitas.
        </p>
        <p className="text-xs">
          Personalização:{' '}
          {choice === 'accepted'
            ? 'ativada'
            : choice === 'rejected'
              ? 'desativada'
              : 'aguardando sua escolha'}
          .
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => choose('rejected')}
          className="border border-current px-4 py-3 text-xs hover:bg-stuw-sand dark:hover:bg-stone-800"
        >
          Recusar personalização
        </button>
        <button
          type="button"
          onClick={() => choose('accepted')}
          className="border border-current px-4 py-3 text-xs hover:bg-stuw-sand dark:hover:bg-stone-800"
        >
          Aceitar personalização
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          clearHistory();
          setCleared(true);
        }}
        className="underline text-xs"
      >
        Limpar produtos vistos
      </button>
      <p role="status" className="text-xs text-stuw-slate">
        {cleared ? 'Histórico de produtos vistos apagado.' : ''}
      </p>
    </Modal>
  );
}

export function PrivacyNotice() {
  const { ready, choice, settingsOpen, openSettings, choose } = usePersonalization();
  if (!ready) return null;
  if (settingsOpen) return <PrivacySettings />;
  if (choice) return null;
  return (
    <section
      aria-label="Cookies e privacidade"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-stuw-border dark:border-stuw-borderDark bg-stuw-canvas dark:bg-stuw-obsidian shadow-2xl max-h-[65dvh] overflow-y-auto"
    >
      <div className="page-container py-5 flex flex-col lg:flex-row gap-5 lg:items-center">
        <div className="flex-1">
          <h2 className="font-serif text-2xl mb-2">Sua privacidade, sua escolha.</h2>
          <p className="text-xs leading-relaxed text-stuw-slate max-w-2xl">
            Usamos armazenamento local para manter sua sacola, favoritos e preferências. Com sua
            permissão, também lembramos os produtos vistos para personalizar sugestões neste
            navegador. Você pode mudar sua escolha em “Cookies e privacidade” no rodapé.
          </p>
          <button type="button" onClick={openSettings} className="underline text-xs mt-3">
            Cookies e privacidade
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 shrink-0">
          <button
            type="button"
            onClick={() => choose('rejected')}
            className="border border-current px-4 py-3 text-xs hover:bg-stuw-sand dark:hover:bg-stone-800"
          >
            Recusar personalização
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="border border-current px-4 py-3 text-xs hover:bg-stuw-sand dark:hover:bg-stone-800"
          >
            Aceitar personalização
          </button>
        </div>
      </div>
    </section>
  );
}
