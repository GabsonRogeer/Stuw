import type { ButtonHTMLAttributes } from 'react';

export function Button({
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`px-6 py-3 text-xs uppercase tracking-widest font-semibold bg-stuw-obsidian text-stuw-canvas dark:bg-stuw-canvas dark:text-stuw-obsidian hover:bg-stuw-sage dark:hover:bg-stuw-champagne silk-transition disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  );
}
