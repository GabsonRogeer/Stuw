'use client';

import dynamic from 'next/dynamic';
import { useStorefront } from '@/providers/storefront-provider';
import { Modal } from '@/components/ui/modal/modal';
import type { Product } from '@/types';

const CartDrawer = dynamic(() =>
  import('@/components/cart/CartDrawer/CartDrawer').then((module) => module.CartDrawer),
);
const SearchDialog = dynamic(() =>
  import('@/components/search/SearchDialog/SearchDialog').then((module) => module.SearchDialog),
);
const WishlistDialog = dynamic(() =>
  import('@/components/wishlist/WishlistDialog/WishlistDialog').then(
    (module) => module.WishlistDialog,
  ),
);
const FitGuide = dynamic(() =>
  import('@/components/product/FitGuide/FitGuide').then((module) => module.FitGuide),
);

export function StorefrontOverlays({ products }: { products: Product[] }) {
  const { panel, setPanel } = useStorefront();
  const close = () => setPanel(null);
  if (panel === 'cart') return <CartDrawer onClose={close} />;
  if (panel === 'search') return <SearchDialog products={products} onClose={close} />;
  if (panel === 'wishlist') return <WishlistDialog products={products} onClose={close} />;
  if (panel === 'fit') return <FitGuide onClose={close} />;
  if (panel === 'concierge') {
    const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '');
    return (
      <Modal title="Fale com a STUW" onClose={close}>
        <p className="text-sm text-stuw-slate">
          Uma escolha com mais cuidado. Conte com nossa equipe.
        </p>
        <a
          className="inline-block underline text-sm"
          href={number ? `https://wa.me/${number}` : 'https://www.instagram.com/stuw.company/'}
          target="_blank"
          rel="noreferrer"
        >
          {number ? 'Abrir WhatsApp' : 'Abrir Instagram'}
        </a>
      </Modal>
    );
  }
  if (panel === 'returns')
    return (
      <Modal title="Trocas e devoluções" onClose={close}>
        <p className="text-sm leading-relaxed">
          As condições da loja estão em preparação. Fale com a STUW para consultar prazos e
          orientações.
        </p>
      </Modal>
    );
  if (panel === 'newsletter')
    return (
      <Modal title="STUW Privé" onClose={close}>
        <p className="text-sm leading-relaxed">
          Os convites para o clube chegam em breve. O cadastro ainda não está ativo; seu e-mail não
          foi enviado.
        </p>
      </Modal>
    );
  return null;
}
