'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const overlayMotion = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } };
const modalMotion = {
  initial: { opacity: 0, scale: 0.96, y: 12 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 12 },
  transition: { duration: 0.18, ease: 'easeOut' as const },
};

const STEPS = [
  {
    title: 'Bem-vindo(a) à Minha Carteira 👋',
    text: 'Aqui você acompanha seus clientes, sua meta do mês e recebe sugestões de quem chamar hoje. Vamos dar uma volta rápida pelos blocos principais — leva menos de 1 minuto.',
  },
  {
    title: 'Meta do mês',
    text: 'No topo fica o seu progresso na meta. O básico já aparece direto — percentual, barra e valor. Clique em "Ver detalhes da meta" pra abrir projeção, comissão estimada e metas por categoria.',
  },
  {
    title: 'Ação do Dia',
    text: 'Logo abaixo dos números fica a lista de quem precisa de você hoje — contato de pós-venda pendente, carnê acabando, aniversário chegando. É o primeiro lugar pra olhar quando entrar no app.',
  },
  {
    title: 'Cartão do cliente',
    text: 'Cada cliente mostra um selo de temperatura (🔥 quente, 🙂 morno, ❄️ frio — baseado em há quanto tempo vocês não se falam) e um botão de WhatsApp com mensagens prontas pro tipo de cliente.',
  },
  {
    title: 'Sempre que precisar...',
    text: 'Os termos com um "?" do lado (VIP, piso garantido, funil...) têm explicação rápida com um clique. E pode rever essa introdução quando quiser, no botão "Como usar" lá no topo.',
  },
];

export function OnboardingTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => { if (open) setStep(0); }, [open]);

  const isLast = step === STEPS.length - 1;
  const atual = STEPS[step];

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="tour-overlay" className="modal-overlay" onClick={onClose} {...overlayMotion}>
          <motion.div key="tour-modal" className="modal tour-modal" onClick={e => e.stopPropagation()} {...modalMotion}>
            <div className="modal-header">
              <span className="modal-title">{atual.title}</span>
              <button type="button" className="close-btn" onClick={onClose} aria-label="Fechar introdução"><X size={20} /></button>
            </div>
            <p className="tour-text">{atual.text}</p>
            <div className="tour-dots">
              {STEPS.map((_, i) => (
                <span key={i} className={`tour-dot ${i === step ? 'active' : ''}`} />
              ))}
            </div>
            <div className="modal-actions">
              {step > 0 && <button type="button" className="btn ghost" onClick={() => setStep(s => s - 1)}>Voltar</button>}
              <button type="button" className="btn ghost" onClick={onClose}>Pular</button>
              <button
                type="button"
                className="btn primary"
                onClick={() => (isLast ? onClose() : setStep(s => s + 1))}
              >
                {isLast ? 'Entendi!' : 'Próximo'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
