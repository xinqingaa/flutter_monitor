import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type * as React from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../shared/formatting/cn';

type ToastTone = 'success' | 'info' | 'danger';

interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);

  const showToast = useCallback((message: Omit<ToastMessage, 'id'>) => {
    const id = Date.now() + Math.random();
    setMessages((current) => [...current, { ...message, id }].slice(-4));
    window.setTimeout(() => removeToast(id), 2600);
  }, [removeToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-3 top-14 z-[300] grid w-[min(360px,calc(100vw-24px))] gap-2">
        {messages.map((message) => (
          <ToastItem key={message.id} message={message} onClose={() => removeToast(message.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used within ToastProvider');
  return value;
}

function ToastItem({ message, onClose }: { message: ToastMessage; onClose: () => void }) {
  const Icon = message.tone === 'success' ? CheckCircle2 : Info;
  return (
    <div
      className={cn(
        'pointer-events-auto grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 rounded-md border bg-white p-3 shadow-lg',
        message.tone === 'success' && 'border-emerald-200',
        message.tone === 'info' && 'border-zinc-200',
        message.tone === 'danger' && 'border-red-200',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 size-4',
          message.tone === 'success' && 'text-emerald-600',
          message.tone === 'info' && 'text-zinc-500',
          message.tone === 'danger' && 'text-red-600',
        )}
      />
      <div className="min-w-0">
        <div className="text-sm font-medium text-zinc-950">{message.title}</div>
        {message.description ? <div className="mt-0.5 text-xs text-zinc-500">{message.description}</div> : null}
      </div>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} aria-label="关闭提示">
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
