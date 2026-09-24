'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({
  title,
  onClose,
  children,
  drawer = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={`stuw-dialog bg-stuw-canvas dark:bg-stuw-obsidian text-stuw-obsidian dark:text-stuw-canvas shadow-2xl border border-stuw-border dark:border-stuw-borderDark ${drawer ? 'stuw-drawer' : 'rounded-3xl w-[calc(100%-2rem)] max-w-xl max-h-[90dvh]'}`}
    >
      <div className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-stuw-border dark:border-stuw-borderDark pb-4">
          <h2 id={heading} className="font-serif text-2xl">
            {title}
          </h2>
          <button
            aria-label="Fechar"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stuw-sand dark:hover:bg-stone-800"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
