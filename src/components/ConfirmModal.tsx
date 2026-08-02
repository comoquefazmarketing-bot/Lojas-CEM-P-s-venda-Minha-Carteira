'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const overlayMotion = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } };
const modalMotion = {
  initial: { opacity: 0, scale: 0.96, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 12 },
  transition: { duration: 0.18, ease: 'easeOut' as const },
};

export type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  /** se definido, exige digitar esse texto exato antes de liberar o botão — reservado pra ações de alto impacto (ex: transferir carteira inteira) */
  typeToConfirm?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  danger = false, loading = false, typeToConfirm, onConfirm, onCancel,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const podeConfirmar = !typeToConfirm || typed.trim() === typeToConfirm;

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="confirm-generic-overlay" className="modal-overlay" onClick={onCancel} {...overlayMotion}>
          <motion.div key="confirm-generic-modal" className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()} {...modalMotion}>
            <div className="modal-title" style={{ marginBottom: 10 }}>{title}</div>
            <div className="confirm-generic-message">{message}</div>
            {typeToConfirm && (
              <input
                autoFocus
                className="confirm-type-input"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder={`Digite "${typeToConfirm}" pra confirmar`}
              />
            )}
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={onCancel}>{cancelLabel}</button>
              <button
                type="button"
                className={`btn ${danger ? 'danger' : 'primary'}`}
                disabled={!podeConfirmar || loading}
                onClick={onConfirm}
              >
                {loading ? 'Aguarda...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
