// ============================================================
//  supabase.js — Shared Supabase client for CivicLens
//
//  Include in every HTML page in this exact order:
//
//  <!-- 1. CDN must come FIRST -->
//  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
//
//  <!-- 2. This file comes SECOND -->
//  <script src="supabase.js"></script>
//
//  Then anywhere in your page scripts you can use:
//    sb.auth.getSession()
//    sb.auth.signInWithPassword(...)
//    sb.auth.signOut()
//    etc.
// ============================================================


// ── Your Supabase project credentials ──────────────────────
// Find these in: Supabase Dashboard → Project Settings → API
const SUPABASE_URL      = "YOUR_SUPABASE_URL";       // e.g. https://xyzabc.supabase.co
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";  // long string starting with eyJ...


// ── Safety check ────────────────────────────────────────────
// Confirms the CDN script loaded correctly before we use it.
// If this error fires, the CDN <script> tag is missing or in
// the wrong order — it must come BEFORE this file.
if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error(
    "[CivicLens] window.supabase not found. " +
    "Make sure the CDN script tag comes BEFORE supabase.js in your HTML."
  );
}


// ── Create and expose the client globally ───────────────────
// We use window.supabase.createClient() — this is the correct
// way to call it from a UMD bundle in a plain HTML file.
// Do NOT write:  const { createClient } = supabase  — that
// pattern only works with ES module / bundler setups.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ── Confirm in browser console ──────────────────────────────
console.log("[CivicLens] Supabase client ready.");