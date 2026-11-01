import { createClient } from '@supabase/supabase-js'

// ⚠️ Substitua pelas suas credenciais do Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://SEU_PROJETO.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'SUA_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

