'use client';

import { Modal } from '@/components/ui/modal/modal';

export function FitGuide({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Seu caimento, sua escolha" onClose={onClose}>
      <div className="space-y-5 text-sm leading-relaxed">
        <p>
          Consulte os tamanhos disponíveis em cada peça. Para escolher seu caimento, tenha em mãos
          as medidas de busto, cintura e quadril.
        </p>
        <p className="text-stuw-slate">
          A tabela de medidas da coleção estará disponível em breve. Nossa equipe pode ajudar na
          escolha pelo Instagram.
        </p>
        <a
          className="inline-block underline"
          target="_blank"
          rel="noreferrer"
          href="https://www.instagram.com/stuw.company/"
        >
          Falar com a STUW
        </a>
      </div>
    </Modal>
  );
}
