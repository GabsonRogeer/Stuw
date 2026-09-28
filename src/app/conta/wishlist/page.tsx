import { requireAccount } from '@/lib/supabase/account';
import { productRepository } from '@/repositories/products';
import { AccountWishlist } from '@/components/account/AccountWishlist';
export default async function WishlistPage() {
  await requireAccount();
  return (
    <>
      <h2 className="font-serif text-3xl border-b border-stuw-border dark:border-stuw-borderDark pb-5">
        Wishlist
      </h2>
      <AccountWishlist products={await productRepository.list()} />
    </>
  );
}
