import { useEffect, useState } from 'react';

export default function Toast({ toast }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className={`toast ${visible ? 'open' : ''} ${toast.ok ? '' : 'err'}`}>
      <i className="ti ti-circle-check" style={{ fontSize: 16 }} />
      <span>{toast.msg}</span>
    </div>
  );
}
