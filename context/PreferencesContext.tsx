import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type OddsFormat = 'american' | 'decimal' | 'fractional';

type PreferencesContextValue = {
  currency: string;
  oddsFormat: OddsFormat;
  showBalance: boolean;
  loading: boolean;
  refresh: () => void;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  currency: 'USD',
  oddsFormat: 'american',
  showBalance: true,
  loading: true,
  refresh: () => {},
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currency, setCurrency] = useState('USD');
  const [oddsFormat, setOddsFormat] = useState<OddsFormat>('american');
  const [showBalance, setShowBalance] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();

      console.log('[PreferencesContext] fetch result:', { data, error });

      if (error) throw error;
      if (data?.preferences) {
        setCurrency(data.preferences.currency ?? 'USD');
        setOddsFormat(data.preferences.oddsFormat ?? 'american');
        setShowBalance(data.preferences.showBalance ?? true);
      }
    } catch (e) {
      console.error('[PreferencesContext] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPreferences();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchPreferences();
    });
    return () => sub.remove();
  }, [fetchPreferences]);

  return (
    <PreferencesContext.Provider value={{ currency, oddsFormat, showBalance, loading, refresh: fetchPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
