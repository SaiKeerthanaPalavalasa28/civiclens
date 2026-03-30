import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { supabase } from '../utils/supabase';
import './Dashboard.css';

const API_BASE = import.meta.env.VITE_API_BASEURL || "http://localhost:5000";

const Dashboard = () => {
  const [session, setSession] = useState(null);
  const [policy, setPolicy] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  
  // Loading State
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0); // 1, 2, 3
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [rawData, setRawData] = useState(null);
  const [displayData, setDisplayData] = useState(null); // Used for translated/english
  const [lang, setLang] = useState('en');
  const [translating, setTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/login');
      else setSession(session);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate('/login');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Audio helpers
  const playTick = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = 880;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2);
    } catch(e) {}
  };

  const playSuccess = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[523,0],[659,0.12],[784,0.24],[1047,0.36]].forEach(([f,t]) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = f;
        const s = ctx.currentTime + t;
        g.gain.setValueAtTime(0,s);
        g.gain.linearRampToValueAtTime(0.18, s+0.04);
        g.gain.exponentialRampToValueAtTime(0.001, s+0.35);
        osc.start(s); osc.stop(s+0.4);
      });
    } catch(e) {}
  };

  const scoreColor = (s) => s >= 70 ? 'green' : s >= 45 ? 'amber' : 'red';

  const runAnalysis = async () => {
    const trimmed = policy.trim();
    if (!trimmed) { setErrorMsg("Please enter a policy before running the analysis."); return; }
    if (trimmed.length < 20) { setErrorMsg("Please describe the policy in more detail (at least 20 characters)."); return; }
    
    setErrorMsg(null);
    stopSpeak();
    setLoading(true);
    
    setLoadingStep(1); playTick();
    try {
      await new Promise(r => setTimeout(r, 800));
      setLoadingStep(2); playTick();

      const response = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ policy: trimmed })
      });

      setLoadingStep(3); playTick();
      await new Promise(r => setTimeout(r, 600));

      if (!response.ok) {
        let msg = `Server error (${response.status})`;
        try { const e = await response.json(); msg = e.detail ?? msg; } catch(_) {}
        throw new Error(msg);
      }

      const data = await response.json();
      await new Promise(r => setTimeout(r, 400));
      
      setRawData(data);
      setDisplayData({ ...data, headings: ["Positive Impacts", "Negative Impacts", "Suggested Improvements"] });
      setLang('en');
      setShowModal(true);
      playSuccess();
      
      setTimeout(() => startSpeakWrapper(data, 'en'), 800);
      
    } catch (err) {
      setErrorMsg("Analysis failed: " + err.message + "\n\nMake sure your backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    stopSpeak();
    setShowModal(false);
  };

  // Translation
  const translateText = async (text, targetLang) => {
    if (targetLang === "en") return text;
    try {
      const code = targetLang === "hi" ? "hi-IN" : "te-IN";
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${code}`;
      const res = await fetch(url);
      const json = await res.json();
      return json.responseData?.translatedText || text;
    } catch(e) { return text; }
  };

  const switchLang = async (newLang) => {
    if (newLang === lang || !rawData) return;
    setLang(newLang);
    stopSpeak();
    
    if (newLang === 'en') {
      setDisplayData({ ...rawData, headings: ["Positive Impacts", "Negative Impacts", "Suggested Improvements"] });
      return;
    }
    
    setTranslating(true);
    const headings = newLang === "hi" 
      ? ["सकारात्मक प्रभाव", "नकारात्मक प्रभाव", "सुझाव"] 
      : ["సానుకూల ప్రభావాలు", "ప్రతికూల ప్రభావాలు", "సూచనలు"];
      
    try {
      const [tPros, tCons, tCorr, tJust] = await Promise.all([
        Promise.all((rawData.pros||[]).map(t => translateText(t, newLang))),
        Promise.all((rawData.cons||[]).map(t => translateText(t, newLang))),
        Promise.all((rawData.corrections||[]).map(t => translateText(t, newLang))),
        translateText(rawData.justification, newLang)
      ]);
      setDisplayData({ pros: tPros, cons: tCons, corrections: tCorr, justification: tJust, score: rawData.score, headings });
    } catch(e) {
      console.error(e);
    } finally {
      setTranslating(false);
    }
  };

  // TTS
  const startSpeakWrapper = (dataToRead, langCode) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    const pros = (dataToRead.pros || []).join(". ");
    const cons = (dataToRead.cons || []).join(". ");
    const corr = (dataToRead.corrections || []).join(". ");
    
    // Fallbacks since displayData hasn't updated yet in the exact tick if auto-triggered
    const text = `Policy score: ${dataToRead.score} out of 100. ${dataToRead.justification}. Positive impacts: ${pros}. Negative impacts: ${cons}. Suggested improvements: ${corr}.`;
    
    const utter = new SpeechSynthesisUtterance(text);
    if (langCode === "hi") utter.lang = "hi-IN";
    else if (langCode === "te") utter.lang = "te-IN";
    else utter.lang = "en-US";
    
    utter.rate = 0.92;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utter);
  };

  const toggleSpeak = () => {
    if (isSpeaking) {
      stopSpeak();
    } else {
      startSpeakWrapper(displayData, lang);
    }
  };

  const stopSpeak = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  return (
    <>
      <Header />
      <main className="dashboard-main">
        <h1 className="page-heading">Policy Analysis</h1>
        <p className="page-sub">Describe your policy below — CivicLens will evaluate its pros, cons, and give it a score.</p>
        
        <div className="input-card">
          <label className="input-label" htmlFor="policyInput">Enter your policy</label>
          <textarea 
            id="policyInput" 
            className="policy-input"
            placeholder="e.g. Introduce free school meals for all students in government schools, funded by a 2% corporate tax cess…"
            maxLength={2000}
            value={policy}
            onChange={e => setPolicy(e.target.value)}
          />
          <div className="input-footer">
            <span className="char-count">{policy.length} / 2000 characters</span>
            <button className="btn-analyze" onClick={runAnalysis} disabled={loading}>
              <span>🔍</span>
              <span>{loading ? "Analyzing…" : "Analyze Policy"}</span>
            </button>
          </div>
        </div>
        
        {errorMsg && <div className="error-card visible">{errorMsg}</div>}
      </main>

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay visible">
          <div className="loading-ring">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle className="track" cx="50" cy="50" r="42"/>
              <circle className="arc" cx="50" cy="50" r="42"/>
            </svg>
            <div className="loading-ring-icon">
              {loadingStep === 1 ? '🔍' : loadingStep === 2 ? '⚖️' : '📊'}
            </div>
          </div>
          <div style={{textAlign: 'center'}}>
            <p className="loading-title">Analyzing Policy…</p>
            <p className="loading-sub">
              {loadingStep === 1 ? 'Agent 1 — Finding positive impacts…' : 
               loadingStep === 2 ? 'Agent 2 — Finding negative impacts…' : 
               'Agent 3 — Scoring and suggesting improvements…'}
            </p>
          </div>
          <div className="steps-row">
            <div className={`step-pill ${loadingStep >= 1 ? (loadingStep > 1 ? 'done' : 'active') : ''}`}><span className="step-dot"></span> Positive Impacts</div>
            <div className={`step-pill ${loadingStep >= 2 ? (loadingStep > 2 ? 'done' : 'active') : ''}`}><span className="step-dot"></span> Negative Impacts</div>
            <div className={`step-pill ${loadingStep >= 3 ? 'active' : ''}`}><span className="step-dot"></span> Scoring</div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showModal && displayData && (
        <div className="modal-backdrop visible" onClick={(e) => { if(e.target === e.currentTarget) closeModal() }}>
          <div className="modal">
            
            <div className="modal-header">
              <div className="modal-header-left">
                <div className="modal-score-ring">
                  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                    <circle className="ring-track" cx="50" cy="50" r="42"/>
                    <circle className={`ring-fill ${scoreColor(displayData.score)}`} cx="50" cy="50" r="42" 
                      strokeDasharray="264" 
                      strokeDashoffset={264 - (displayData.score/100)*264} />
                  </svg>
                  <div className="modal-score-num">
                    <span className={`num ${scoreColor(displayData.score)}`}>{displayData.score}</span>
                    <span className="denom">/ 100</span>
                  </div>
                </div>
                <div className="modal-score-info">
                  <p className="modal-score-title">
                    {displayData.score >= 70 ? "✅ Good Policy — Ready to Implement" :
                     displayData.score >= 45 ? "⚠️ Needs Improvement Before Implementation" :
                     "❌ Poor Policy — Major Rework Required"}
                  </p>
                  <p className="modal-score-just">{displayData.justification}</p>
                </div>
              </div>
              <div className="modal-header-actions">
                <button className="modal-close" onClick={closeModal} title="Close">✕</button>
              </div>
            </div>

            <div className="modal-toolbar">
              <span className="toolbar-label">Language</span>
              <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => switchLang('en')}>🇬🇧 English</button>
              <button className={`lang-btn ${lang === 'hi' ? 'active' : ''}`} onClick={() => switchLang('hi')}>🇮🇳 Hindi</button>
              <button className={`lang-btn ${lang === 'te' ? 'active' : ''}`} onClick={() => switchLang('te')}>🏳 Telugu</button>
              <div className="toolbar-divider"></div>
              <button className={`btn-speak ${isSpeaking ? 'speaking' : ''}`} onClick={toggleSpeak}>
                <span>{isSpeaking ? '⏹' : '🔊'}</span>
                <span>{isSpeaking ? 'Stop' : 'Read Aloud'}</span>
              </button>
              {translating && <div className="translating-badge visible"><div className="translating-spin"></div>Translating…</div>}
            </div>

            <div className="modal-body">
              <div className="analyzed-policy">
                <strong>Policy analyzed:</strong> <span>{policy.length > 120 ? policy.slice(0,120) + '…' : policy}</span>
              </div>
              
              <div className="results-grid">
                <div className="result-card">
                  <div className="result-card-header">
                    <span className="result-card-icon">✅</span>
                    <span className="result-card-title green">{displayData.headings[0]}</span>
                  </div>
                  <ul className="result-list">
                    {displayData.pros?.length ? displayData.pros.map((p,i) => <li key={i}><span className="result-icon">•</span><span>{p}</span></li>) : <li>No positive impacts found.</li>}
                  </ul>
                </div>
                
                <div className="result-card">
                  <div className="result-card-header">
                    <span className="result-card-icon">❌</span>
                    <span className="result-card-title red">{displayData.headings[1]}</span>
                  </div>
                  <ul className="result-list">
                    {displayData.cons?.length ? displayData.cons.map((c,i) => <li key={i}><span className="result-icon">•</span><span>{c}</span></li>) : <li>No negative impacts found.</li>}
                  </ul>
                </div>
                
                <div className="result-card">
                  <div className="result-card-header">
                    <span className="result-card-icon">🔧</span>
                    <span className="result-card-title amber">{displayData.headings[2]}</span>
                  </div>
                  <ul className="result-list">
                    {displayData.corrections?.length ? displayData.corrections.map((c,i) => <li key={i}><span className="result-icon">•</span><span>{c}</span></li>) : <li>No suggestions available.</li>}
                  </ul>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-new" onClick={closeModal}>← Analyze another policy</button>
            </div>
            
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
