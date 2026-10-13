'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ManagedBanner } from './ManagedBanner';
import { bannerImageUrl, bannerIsCurrent } from '@/services/banners';
import type { Banner } from '@/types/database';
import styles from './BannerCarousel.module.css';

export function BannerCarousel({
  banners,
  serverNow,
  fallback,
}: {
  banners: Banner[];
  serverNow: number;
  fallback: ReactNode;
}) {
  const router = useRouter();
  const [now, setNow] = useState(serverNow);
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const current = banners.filter((banner) => bannerIsCurrent(banner, now));
  const count = current.length;
  const index = count ? selected % count : 0;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    // Future campaigns are private until their start, so periodically fetch the current public set.
    const refresh = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 30000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(refresh);
    };
  }, [router]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener('change', update);
    const timer = window.setTimeout(update, 0);
    return () => {
      window.clearTimeout(timer);
      query.removeEventListener('change', update);
    };
  }, []);
  useEffect(() => {
    if (count < 2 || paused || hovered || focused || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setSelected((value) => (value + 1) % count);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [count, paused, hovered, focused, reducedMotion]);
  function navigate(value: number) {
    setSelected((value + count) % count);
    setPaused(true);
  }
  if (!count) return fallback;
  return (
    <section
      className={styles.carousel}
      aria-roledescription="carrossel"
      aria-label="Campanhas STUW"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (count < 2) return;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          navigate(index - 1);
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          navigate(index + 1);
        }
      }}
    >
      <div aria-live={paused || reducedMotion ? 'polite' : 'off'}>
        {current.map((banner, slide) => (
          <div
            key={banner.id}
            hidden={slide !== index}
            className={styles.slide}
            role="group"
            aria-roledescription="slide"
            aria-label={slide + 1 + ' de ' + count}
          >
            <ManagedBanner
              title={banner.title}
              subtitle={banner.subtitle}
              description={banner.description}
              layout={banner.layout}
              link={banner.link}
              desktop={bannerImageUrl(banner.desktop_path)}
              mobile={bannerImageUrl(banner.mobile_path)}
              priority={slide === index}
            />
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className={styles.controls}>
          <button type="button" aria-label="Campanha anterior" onClick={() => navigate(index - 1)}>
            ←
          </button>
          <div className={styles.dots} aria-label="Selecionar campanha">
            {current.map((banner, slide) => (
              <button
                type="button"
                key={banner.id}
                aria-label={'Ver campanha ' + (slide + 1) + ': ' + banner.title}
                aria-pressed={index === slide}
                onClick={() => navigate(slide)}
              >
                <span />
              </button>
            ))}
          </div>
          <button type="button" aria-label="Próxima campanha" onClick={() => navigate(index + 1)}>
            →
          </button>
          {!reducedMotion && (
            <button
              type="button"
              className={styles.pause}
              onClick={() => setPaused(!paused)}
              aria-label={
                paused ? 'Retomar alternância automática' : 'Pausar alternância automática'
              }
            >
              {paused ? '▶ Continuar' : 'Ⅱ Pausar'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
