import { AnnouncementBar } from '@/components/layout/AnnouncementBar/AnnouncementBar';
import { SiteHeader } from '@/components/layout/SiteHeader/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter/SiteFooter';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-stuw-canvas focus:text-stuw-obsidian focus:p-4"
      >
        Pular para o conteúdo
      </a>
      <AnnouncementBar />
      <SiteHeader />
      <main id="conteudo">{children}</main>
      <SiteFooter />
    </>
  );
}
