import styles from './ManagedBanner.module.css';
export function ManagedBanner({
  title,
  subtitle = '',
  description = '',
  link,
  desktop,
  mobile,
  preview,
}: {
  title: string;
  subtitle?: string;
  description?: string;
  link: string;
  desktop: string;
  mobile: string;
  preview?: 'desktop' | 'mobile';
}) {
  const media =
    preview === 'desktop' ? 'all' : preview === 'mobile' ? 'not all' : '(min-width: 768px)';
  const heading = (
    <>
      <span className="text-stuw-obsidian dark:text-stuw-canvas">{title}</span>
      {subtitle && <em className="block text-stuw-sage dark:text-stuw-champagne">{subtitle}</em>}
    </>
  );
  return (
    <section
      aria-label="Destaque STUW"
      className={
        styles.banner +
        ' ' +
        (preview === 'desktop' ? styles.desktop : preview === 'mobile' ? '' : styles.responsive) +
        ' bg-stuw-sand dark:bg-stone-900'
      }
    >
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
      <picture className={styles.media}>
        <source media={media} srcSet={desktop} />
        {/* Native picture preserves art direction with distinct mobile/desktop assets. */}
        <img src={mobile} alt={title} fetchPriority={preview ? 'auto' : 'high'} />
      </picture>
    </section>
  );
}
