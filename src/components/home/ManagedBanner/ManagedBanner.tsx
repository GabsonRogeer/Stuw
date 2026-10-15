import type { CSSProperties } from 'react';
import styles from './ManagedBanner.module.css';
export function ManagedBanner({
  title,
  subtitle = '',
  description = '',
  link,
  desktop,
  mobile,
  preview,
  layout = 'split',
  priority = true,
  desktopPositionY = 0,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  link: string;
  desktop: string;
  mobile: string;
  preview?: 'desktop' | 'mobile';
  layout?: 'split' | 'image';
  priority?: boolean;
  desktopPositionY?: number;
}) {
  const media =
    preview === 'desktop' ? 'all' : preview === 'mobile' ? 'not all' : '(min-width: 768px)';
  const heading = (
    <>
      <span className="text-stuw-obsidian dark:text-stuw-canvas">{title}</span>
      {subtitle && <em className="block text-stuw-sage dark:text-stuw-champagne">{subtitle}</em>}
    </>
  );
  const picture = (
    <picture
      className={styles.media}
      style={
        {
          '--banner-desktop-position-y':
            (Number.isFinite(desktopPositionY) ? Math.min(100, Math.max(0, desktopPositionY)) : 0) +
            '%',
        } as CSSProperties
      }
    >
      <source media={media} srcSet={desktop} />
      {/* Native picture preserves art direction with distinct mobile/desktop assets. */}
      <img
        src={mobile}
        alt={title}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={preview || !priority ? 'auto' : 'high'}
      />
    </picture>
  );
  return (
    <section
      aria-label="Destaque STUW"
      className={
        styles.banner +
        (layout === 'image' ? ' ' + styles.fullImage : '') +
        ' ' +
        (preview === 'desktop' ? styles.desktop : preview === 'mobile' ? '' : styles.responsive) +
        ' bg-stuw-sand dark:bg-stone-900'
      }
    >
      {layout === 'split' ? (
        <>
          <div className={styles.copy}>
            <p className="eyebrow mb-6">STUW / Activewear & Wellness</p>
            {preview ? (
              <h3 className={styles.title + ' font-serif font-light'}>{heading}</h3>
            ) : (
              <h1 className={styles.title + ' font-serif font-light'}>{heading}</h1>
            )}
            {description && (
              <p className="text-sm text-stuw-slate mt-6 leading-relaxed whitespace-pre-line">
                {description}
              </p>
            )}
            {preview ? (
              <span className="text-xs uppercase tracking-widest border-b border-current pb-2 mt-8">
                Explorar coleção
              </span>
            ) : (
              <a
                href={link}
                className="text-xs uppercase tracking-widest border-b border-current pb-2 mt-8"
              >
                Explorar coleção
              </a>
            )}
          </div>
          {picture}
        </>
      ) : (
        <>
          {preview ? <h3 className="sr-only">{title}</h3> : <h1 className="sr-only">{title}</h1>}
          {preview ? (
            picture
          ) : (
            <a href={link} className={styles.imageLink}>
              {picture}
            </a>
          )}
        </>
      )}
    </section>
  );
}
