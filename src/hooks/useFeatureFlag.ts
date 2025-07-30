import { useEffect, useState } from 'react';
import { featureFlags } from '@/shared/feature-flags';

export function useFeatureFlag(flag: string): boolean {
  const [value, setValue] = useState(() => featureFlags.get(flag));

  useEffect(() => {
    // Get the initial value (which creates the flag if it doesn't exist)
    setValue(featureFlags.get(flag));

    const unsubscribe = featureFlags.subscribe(() => {
      setValue(featureFlags.get(flag));
    });

    return unsubscribe;
  }, [flag]);

  return value;
}

export function useAllFeatureFlags(): Record<string, boolean> {
  const [flags, setFlags] = useState(() => featureFlags.getAll());

  useEffect(() => {
    const unsubscribe = featureFlags.subscribe(() => {
      setFlags(featureFlags.getAll());
    });

    return unsubscribe;
  }, []);

  return flags;
}