'use client';
import { createContext, useCallback, useContext, useState } from 'react';

type Toast = { id: number; msg: string };
const Ctx = createContext<{ push: (m: string) => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p, { id, msg }]);
    setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="toast-wrap">
        {items.map((t) => (
          <div key={t.id} className="toast">{t.msg}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
