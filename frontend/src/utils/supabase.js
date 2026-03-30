import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bloaxjfbwpgetpvdguvv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsb2F4amZid3BnZXRwdmRndXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDU5OTIsImV4cCI6MjA4OTcyMTk5Mn0.WHVF9Ts9JdE_cW2m8Q_6lFyl-URgFg-C-v482OCnT-0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
