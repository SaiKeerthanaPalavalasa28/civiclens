import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './Home.css';

const TTT_WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const MEMORY_EMOJIS = ['🍎','🍌','🍒','🍇','🍉','🥥'];

const Home = () => {
  // --- Tic Tac Toe State ---
  const [tttBoard, setTttBoard] = useState(Array(9).fill(null));
  const [tttStatus, setTttStatus] = useState("Your turn — play as X");
  const [tttOver, setTttOver] = useState(false);
  
  // --- Memory State ---
  const [memCards, setMemCards] = useState([]);
  const [memFlipped, setMemFlipped] = useState([]);
  const [memMatched, setMemMatched] = useState([]);
  const [memPairs, setMemPairs] = useState(0);

  const canvasRef = useRef(null);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-up').forEach(el => obs.observe(el));
    
    initMemory();
    return () => obs.disconnect();
  }, []);

  // --- Audio Helpers ---
  const playWin = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[523,0],[659,0.13],[784,0.26],[1047,0.39]].forEach(([f,t]) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = f;
        const s = ctx.currentTime + t;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.28, s + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, s + 0.38);
        osc.start(s); osc.stop(s + 0.4);
      });
    } catch(e) {}
  };

  const playLose = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[466,0],[392,0.22],[311,0.44],[233,0.66]].forEach(([f,t]) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sawtooth'; osc.frequency.value = f;
        const s = ctx.currentTime + t;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.18, s + 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, s + 0.45);
        osc.start(s); osc.stop(s + 0.5);
      });
    } catch(e) {}
  };

  const launchConfetti = () => {
    const cCanvas = canvasRef.current;
    if (!cCanvas) return;
    cCanvas.width = window.innerWidth;
    cCanvas.height = window.innerHeight;
    const ctx = cCanvas.getContext('2d');
    const pieces = Array.from({length: 120}, () => ({
      x: Math.random() * cCanvas.width,
      y: -20 - Math.random() * 200,
      w: 8 + Math.random() * 6,
      h: 12 + Math.random() * 6,
      r: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 3,
      vy: 2.5 + Math.random() * 3,
      vr: (Math.random() - 0.5) * 0.15,
      color: ['#2d6be4','#2a8c5a','#c93030','#f59e0b','#8b5cf6','#ec4899'][Math.floor(Math.random()*6)],
      opacity: 1
    }));
    let start = null;
    let animId;
    const draw = (ts) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      ctx.clearRect(0, 0, cCanvas.width, cCanvas.height);
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        p.vy += 0.06;
        if (elapsed > 2200) p.opacity = Math.max(0, p.opacity - 0.018);
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      });
      if (elapsed < 3500 && pieces.some(p => p.opacity > 0)) {
        animId = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, cCanvas.width, cCanvas.height);
      }
    };
    animId = requestAnimationFrame(draw);
  };

  const celebrate = () => { playWin(); launchConfetti(); };
  const booHorn = () => playLose();

  // --- Tic Tac Toe Logic ---
  const checkWin = (b, p) => TTT_WINS.find(w => w.every(i => b[i] === p)) || null;
  const tttCellClick = (i) => {
    if (tttOver || tttBoard[i]) return;
    const newB = [...tttBoard];
    newB[i] = 'X';
    setTttBoard(newB);
    
    if (checkWin(newB, 'X')) {
      setTttStatus("You win! 🎉"); setTttOver(true); celebrate(); return;
    }
    if (newB.every(Boolean)) {
      setTttStatus("It's a draw!"); setTttOver(true); return;
    }
    
    // AI Turn
    setTimeout(() => {
      let aiMove = -1;
      for (let w of TTT_WINS) {
        const line = [newB[w[0]], newB[w[1]], newB[w[2]]];
        if (line.filter(v => v === 'O').length === 2 && line.includes(null)) aiMove = w[line.indexOf(null)];
      }
      if (aiMove === -1) {
        for (let w of TTT_WINS) {
          const line = [newB[w[0]], newB[w[1]], newB[w[2]]];
          if (line.filter(v => v === 'X').length === 2 && line.includes(null)) aiMove = w[line.indexOf(null)];
        }
      }
      if (aiMove === -1 && !newB[4]) aiMove = 4;
      if (aiMove === -1) {
        const emp = newB.map((v, idx) => v ? null : idx).filter(v => v !== null);
        aiMove = emp[Math.floor(Math.random() * emp.length)];
      }
      
      newB[aiMove] = 'O';
      setTttBoard([...newB]);
      
      if (checkWin(newB, 'O')) {
        setTttStatus("AI wins! 🤖"); setTttOver(true); booHorn(); return;
      }
      if (newB.every(Boolean)) {
        setTttStatus("It's a draw!"); setTttOver(true); return;
      }
    }, 400);
  };

  const resetTtt = () => {
    setTttBoard(Array(9).fill(null)); setTttOver(false); setTttStatus("Your turn — play as X");
  };

  // --- Memory Logic ---
  const initMemory = () => {
    const arr = [...MEMORY_EMOJIS, ...MEMORY_EMOJIS].sort(() => Math.random() - 0.5);
    setMemCards(arr.map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false })));
    setMemFlipped([]); setMemMatched([]); setMemPairs(0);
  };
  
  const memClick = (index) => {
    if (memFlipped.length >= 2 || memMatched.includes(index) || memFlipped.includes(index)) return;
    const newFlipped = [...memFlipped, index];
    setMemFlipped(newFlipped);
    
    if (newFlipped.length === 2) {
      if (memCards[newFlipped[0]].emoji === memCards[newFlipped[1]].emoji) {
        const newMatched = [...memMatched, newFlipped[0], newFlipped[1]];
        setMemMatched(newMatched);
        setMemPairs(newMatched.length / 2);
        setMemFlipped([]);
        if (newMatched.length === 12) {
          setTimeout(celebrate, 300);
        }
      } else {
        setTimeout(() => setMemFlipped([]), 800);
      }
    }
  };

  return (
    <>
      <Header />
      <section id="home" className="hero">
        <div className="hero-inner">
          <div className="hero-badge">Policy Analysis Tool</div>
          <h1>Civic<span className="accent">Lens</span></h1>
          <p className="hero-sub">See what might happen before a policy is implemented.</p>
          <p style={{fontSize:'0.95rem',color:'var(--text-muted)',maxWidth:'420px',margin:'0 auto 36px',lineHeight:1.7}}>
            A simple system to explore possible outcomes, risks, and readiness of policies.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn-primary">Try Now</Link>
            <a href="#about" className="btn-secondary">Learn more →</a>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <span className="stat-num">Benefits</span>
            <span className="stat-label">Identified</span>
          </div>
          <div className="hero-divider"></div>
          <div className="stat">
            <span className="stat-num">Risks</span>
            <span className="stat-label">Surfaced</span>
          </div>
          <div className="hero-divider"></div>
          <div className="stat">
            <span className="stat-num">Readiness</span>
            <span className="stat-label">Scored</span>
          </div>
        </div>
      </section>

      <section id="about" className="section about-grid">
        <div className="fade-up">
          <p className="section-label">About</p>
          <h2 className="section-title">What is CivicLens?</h2>
          <p className="section-body">CivicLens is a simple tool that helps analyze policies before they are implemented. It looks at possible benefits, risks, and practical challenges so that decisions can be better understood early on.</p>
          <p className="section-body" style={{marginTop:'16px'}}>It does not predict the future, but helps highlight what could go right or wrong.</p>
        </div>
        <div className="about-visual fade-up">
          <div className="about-pill pill-blue"><span className="pill-icon"></span> Benefits Identified</div>
          <p className="about-card-title">Economic Impact Assessment</p>
          <p className="about-card-sub">Projected 12% GDP growth over 5 years</p>
          <hr className="about-divider"/>
          <div className="about-pill pill-red"><span className="pill-icon"></span> Risk Flagged</div>
          <p className="about-card-title">Implementation Bottleneck</p>
          <p className="about-card-sub">Budget allocation may require rebalancing</p>
          <hr className="about-divider"/>
          <div className="about-pill pill-green"><span className="pill-icon"></span> Readiness Score</div>
          <p className="about-card-title">Policy Confidence: 78%</p>
          <p className="about-card-sub">High feasibility — proceed with caution on Phase 2</p>
        </div>
      </section>

      <section id="how" className="section how-section">
        <p className="section-label">Process</p>
        <h2 className="section-title">How it works</h2>
        <p className="section-body">Three clear steps from input to insight — simple, structured, and transparent.</p>
        <div className="steps">
          <div className="step-card fade-up">
            <span className="step-num">01</span>
            <div className="step-icon step-icon-blue">📝</div>
            <p className="step-title">Enter a policy</p>
            <p className="step-desc">Describe the policy you want to analyze — in your own words, as simply or in as much detail as you like.</p>
          </div>
          <div className="step-card fade-up">
            <span className="step-num">02</span>
            <div className="step-icon step-icon-green">⚙️</div>
            <p className="step-title">System analyzes it</p>
            <p className="step-desc">Two independent agents check for possible benefits and risks, working separately to give a balanced view.</p>
          </div>
          <div className="step-card fade-up">
            <span className="step-num">03</span>
            <div className="step-icon step-icon-amber">📊</div>
            <p className="step-title">View results</p>
            <p className="step-desc">Get a readiness score, confidence score, and key insights — presented clearly so they are easy to understand.</p>
          </div>
        </div>
      </section>

      <section id="features" className="features-section">
        <div className="features-inner">
          <p className="section-label">Capabilities</p>
          <h2 className="section-title">What it offers</h2>
          <div className="features-grid">
            <div className="feature-card fade-up"><span className="feature-icon">🔬</span><p className="feature-title">Pre-implementation Analysis</p><p className="feature-desc">Understand what a policy might lead to before it is put into action — reducing guesswork and surprises.</p></div>
            <div className="feature-card fade-up"><span className="feature-icon">⚖️</span><p className="feature-title">Separate Benefit & Risk Evaluation</p><p className="feature-desc">Benefits and risks are analyzed independently by two agents, ensuring a balanced and unbiased view.</p></div>
            <div className="feature-card fade-up"><span className="feature-icon">📈</span><p className="feature-title">Readiness Score</p><p className="feature-desc">A straightforward score that shows how ready a policy is for implementation at a glance.</p></div>
            <div className="feature-card fade-up"><span className="feature-icon">🎯</span><p className="feature-title">Confidence Score</p><p className="feature-desc">Shows how reliable the analysis is, so you know how much weight to give each result.</p></div>
            <div className="feature-card fade-up"><span className="feature-icon">💡</span><p className="feature-title">Simple & Explainable Results</p><p className="feature-desc">Every output is written in plain language. No jargon — just clear reasoning behind each finding.</p></div>
            <div className="feature-card fade-up"><span className="feature-icon">🧩</span><p className="feature-title">Structured Logic</p><p className="feature-desc">The system follows a consistent process every time, making results easy to compare across different policies.</p></div>
          </div>
        </div>
      </section>

      <section id="team" className="section team-section">
        <p className="section-label">The Team</p>
        <h2 className="section-title">Meet the Team</h2>
        <p className="section-body" style={{margin:'0 auto'}}>Three people, one shared goal — making policy analysis simpler and more transparent.</p>
        <div className="team-grid">
          <div className="team-card fade-up">
            <div className="team-avatar av-blue">SK</div>
            <p className="team-name">P. Sai Keerthana</p>
            <p className="team-role" style={{color:'var(--blue)',fontWeight:600,marginBottom:'8px'}}>Project Lead</p>
            <p style={{fontSize:'0.82rem',color:'var(--text-muted)',lineHeight:1.6}}>Oversees design, development, and overall system flow.</p>
          </div>
          <div className="team-card fade-up">
            <div className="team-avatar av-green">M</div>
            <p className="team-name">P. Monisha</p>
            <p className="team-role" style={{color:'var(--green)',fontWeight:600,marginBottom:'8px'}}>Research &amp; Analysis</p>
            <p style={{fontSize:'0.82rem',color:'var(--text-muted)',lineHeight:1.6}}>Worked on problem understanding, logic design, and system structure.</p>
          </div>
          <div className="team-card fade-up">
            <div className="team-avatar av-red">NB</div>
            <p className="team-name">Neha Balaji Jagatkar</p>
            <p className="team-role" style={{color:'var(--red)',fontWeight:600,marginBottom:'8px'}}>Documentation &amp; Reporting</p>
            <p style={{fontSize:'0.82rem',color:'var(--text-muted)',lineHeight:1.6}}>Handled documentation, report writing, and presentation content.</p>
          </div>
        </div>
      </section>

      <canvas ref={canvasRef} id="confetti-canvas"></canvas>

      <section id="fun" className="section fun-section">
        <p className="section-label">Take a Break</p>
        <h2 className="section-title">Take a quick break 🎮</h2>
        <p className="section-body" style={{margin:'0 auto'}}>Need a breather? Pick a game and have some fun. Win and your laptop will celebrate with you!</p>
        
        <div className="games-grid">
          {/* Tic Tac Toe */}
          <div className="game-panel fade-up">
            <p className="game-panel-title">Tic Tac Toe</p>
            <p className="game-panel-sub">Play against a simple AI — you are X</p>
            <p className="game-status">{tttStatus}</p>
            <div className="tic-board">
              {tttBoard.map((c, i) => {
                const isWin = checkWin(tttBoard, c)?.includes(i);
                return (
                  <div key={i} className={`tic-cell ${c ? c.toLowerCase() : ''} ${isWin ? 'win' : ''}`} onClick={() => tttCellClick(i)}>
                    {c}
                  </div>
                )
              })}
            </div>
            <button className="game-reset" onClick={resetTtt}>Reset</button>
          </div>

          {/* Memory Match */}
          <div className="game-panel fade-up">
            <p className="game-panel-title">Memory Match</p>
            <p className="game-panel-sub">Flip cards and find all matching pairs</p>
            <p className="game-status">Pairs found: {memPairs} / 6</p>
            <div className="mem-board-grid">
              {memCards.map((c, i) => (
                <div key={i} className={`mem-card ${memFlipped.includes(i) || memMatched.includes(i) ? 'flipped matched' : ''}`} onClick={() => memClick(i)}>
                  <div className="mem-inner">
                    <div className="mem-front"></div>
                    <div className="mem-back">{c.emoji}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="game-reset" onClick={initMemory}>Reset</button>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default Home;
