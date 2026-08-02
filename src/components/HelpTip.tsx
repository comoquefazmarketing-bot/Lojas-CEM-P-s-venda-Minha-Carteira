'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';

/** botão "?" que abre uma explicação curta em linguagem simples — pensado pra termos
 * calculados que não são óbvios pra quem não é do dia a dia de vendas (VIP, temperatura,
 * piso garantido, projeção...). Usa portal + clique (não hover) pra funcionar em toque. */
export function HelpTip({ text, label, variant = 'default' }: { text: string; label?: string; variant?: 'default' | 'on-dark' }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick() { setOpen(false); }
    function onScroll() { setOpen(false); }
    document.addEventListener('click', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(o => !o);
  }

  return (
    <span className="help-tip-wrap">
      <button
        ref={btnRef}
        type="button"
        className={`help-tip-btn${variant === 'on-dark' ? ' help-tip-btn-on-dark' : ''}`}
        onClick={toggle}
        aria-label={label ? `Ajuda: ${label}` : 'O que é isso?'}
      >
        <HelpCircle size={13} />
      </button>
      {open && rect && createPortal(
        <div
          className="help-tip-pop"
          style={{
            position: 'fixed',
            top: Math.min(rect.bottom + 6, window.innerHeight - 160),
            left: Math.min(Math.max(8, rect.left - 110), window.innerWidth - 268),
          }}
          onClick={e => e.stopPropagation()}
        >
          {label && <div className="help-tip-pop-title">{label}</div>}
          {text}
        </div>,
        document.body
      )}
    </span>
  );
}
