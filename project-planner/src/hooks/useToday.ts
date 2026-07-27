import { useEffect, useState } from 'react';
import { today } from '../utils/date';

/** Current date (yyyy-MM-dd), automatically refreshed when the day rolls over. */
export function useToday(): string {
  const [value, setValue] = useState(today());

  useEffect(() => {
    const id = window.setInterval(() => {
      setValue((prev) => {
        const next = today();
        return next === prev ? prev : next;
      });
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return value;
}
