import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Brain, CheckCircle2, Cpu, FileText, Mic, MicOff, Radio, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import './styles.css';

const HOT_MEMORY = {
  identity: 'Aidlyst is an affiliate-first health-product comparison and referral platform that helps shoppers compare trusted home-health deals in one place.',
  boundaries: 'Aidlyst must not provide diagnosis, treatment, prescription guidance, emergency guidance, or unsupported medical/FDA claims.',
  ux: 'Use View deal, Visit partner, and compare language. Avoid Add to cart unless Aidlyst becomes seller of record after compliance review.',
  priorities: ['Affiliate-only Shopify flow', 'Remove cart and checkout paths', 'Replace MediDeal branding with Aidlyst', 'Add legal/footer pages', 'Track outbound affiliate clicks', 'Product QA and compliance review', 'Desktop polish'],
  tracking: 'Event: aidlyst_product_link_click with product_id, product_title, product_vendor, product_url, outbound_url, placement, timestamp.'
};

const DEEP_TERMS = ['plan','strategy','build','write spec','codex','legal','medical','compliance','launch','shopify','affiliate','develop','formulate','production','partner','finance','marketing'];
const FAST_TERMS = ['what is','next step','status','open','quick','summarize','blockers'];

function classify(text) {
  const q = text.toLowerCase();
  if (DEEP_TERMS.some(t => q.includes(t))) return 'Deep Brain';
  if (FAST_TERMS.some(t => q.includes(t)) || q.length < 80) return 'Fast Ops';
  return 'Fast Ops';
}

function scoreNotes(query, notes) {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return notes.map(note => {
    const hay = `${note.name} ${note.content}`.toLowerCase();
    const score = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
    return { ...note, score };
  }).filter(n => n.score > 0).sort((a,b) => b.score - a.score).slice(0, 5);
}

function answer(query, mode, matches) {
  const q = query.toLowerCase();
  if (q.includes('what is aidlyst') || q.includes('business model')) return HOT_MEMORY.identity;
  if (q.includes('avoid') || q.includes('compliance') || q.includes('medical')) return `Compliance line: ${HOT_MEMORY.boundaries} Product UX should stay affiliate-first: ${HOT_MEMORY.ux}`;
  if (q.includes('track') || q.includes('posthog') || q.includes('click')) return HOT_MEMORY.tracking;
  if (q.includes('next') || q.includes('priority') || q.includes('blocker')) return `Next moves: ${HOT_MEMORY.priorities.slice(0, 4).join('; ')}.`;
  if (mode === 'Deep Brain') {
    const sourceLine = matches.length ? `\n\nBrain context used: ${matches.map(m => m.name).join(', ')}` : '\n\nNo Obsidian files loaded yet. Use Load Brain to attach your vault markdown files.';
    return `Executive plan:\n1. Lock Aidlyst as affiliate-only until seller-of-record compliance is reviewed.\n2. Route all product CTAs to partner outbound links using View deal / Visit partner.\n3. Add legal, affiliate disclosure, privacy, terms, and medical disclaimer pages.\n4. Track every outbound click as ${HOT_MEMORY.tracking}\n5. Polish desktop alignment, navigation hierarchy, and product-card readability.\n\nImmediate build spec:\n- Disable cart and checkout UI.\n- Normalize product data around external_url and affiliate metadata.\n- Add a compliance copy guard for health claims.\n- Create QA checklist for every product page before launch.${sourceLine}`;
  }
  return `Fast read: Aidlyst should stay affiliate-first, compliance-safe, and focused on trusted home-health product comparison. Next action: ${HOT_MEMORY.priorities[0]}.`;
}

function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const r = new SR();
    r.continuous = false; r.interimResults = true; r.lang = 'en-US';
    recogRef.current = r;
  }, []);
  return { supported, listening, setListening, recogRef };
}

function App() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('Fast Ops');
  const [status, setStatus] = useState('Standing by');
  const [response, setResponse] = useState('Friday online. Load your Obsidian brain, speak a command, or type a mission.');
  const [notes, setNotes] = useState([]);
  const [sources, setSources] = useState([]);
  const { supported, listening, setListening, recogRef } = useSpeech();
  const fileRef = useRef(null);
  const priorities = HOT_MEMORY.priorities;

  const run = (text) => {
    if (!text.trim()) return;
    const nextMode = classify(text);
    setMode(nextMode);
    setStatus(nextMode === 'Fast Ops' ? 'Instant response' : 'Checking Obsidian brain');
    setResponse(nextMode === 'Fast Ops' ? 'On it.' : 'On it. Pulling brain context.');
    const matches = scoreNotes(text, notes);
    setSources(matches);
    setTimeout(() => {
      const final = answer(text, nextMode, matches);
      setResponse(final);
      setStatus('Ready');
      if ('speechSynthesis' in window) {
        const spoken = final.length > 220 ? final.slice(0, 180) + ' Full answer is on screen.' : final;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));
      }
    }, nextMode === 'Fast Ops' ? 260 : 850);
  };

  const startVoice = () => {
    if (!supported || !recogRef.current) return;
    const r = recogRef.current;
    r.onresult = (e) => {
      const text = Array.from(e.results).map(res => res[0].transcript).join(' ');
      setInput(text);
      if (e.results[e.results.length - 1].isFinal) run(text);
    };
    r.onend = () => setListening(false);
    setListening(true); setStatus('Listening'); r.start();
  };

  const loadBrain = async (files) => {
    const md = [...files].filter(f => f.name.endsWith('.md'));
    const loaded = [];
    for (const file of md.slice(0, 250)) loaded.push({ name: file.name, content: await file.text() });
    setNotes(loaded); setStatus(`${loaded.length} brain notes loaded`);
  };

  return <main className="shell">
    <aside className="sidebar glass">
      <div className="brand"><div className="mark">F</div><div><b>Friday</b><span>Aidlyst Command OS</span></div></div>
      {['Brain','Aidlyst','Tasks','Build','Launch','Compliance'].map((x,i)=><div className="nav" key={x}>{[Brain,Sparkles,CheckCircle2,Cpu,Radio,ShieldCheck].map(I=>I)[i]({size:18})}<span>{x}</span></div>)}
      <button className="load" onClick={()=>fileRef.current.click()}><FileText size={17}/> Load Brain</button>
      <input ref={fileRef} type="file" webkitdirectory="true" multiple hidden onChange={e=>loadBrain(e.target.files)} />
    </aside>
    <section className="center glass">
      <div className="topline"><span className="pill"><Zap size={15}/> {mode}</span><span>{status}</span></div>
      <div className={`orb ${listening ? 'listening' : ''}`}><div className="core"><Sparkles size={54}/></div></div>
      <h1>Friday is online.</h1><p className="sub">Voice-first founder cockpit for Aidlyst operations, product strategy, compliance, and execution.</p>
      <div className="composer">
        <button className="mic" onClick={listening ? ()=>recogRef.current?.stop() : startVoice}>{listening ? <MicOff/> : <Mic/>}</button>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')run(input)}} placeholder="Speak or type a command for Friday..." />
        <button onClick={()=>run(input)}>Execute</button>
      </div>
      {!supported && <p className="warn">Browser speech recognition unavailable. Text mode is active.</p>}
      <pre className="answer">{response}</pre>
    </section>
    <aside className="right glass">
      <h3>Current Aidlyst Priorities</h3>{priorities.map((p,i)=><div className="todo" key={p}><span>{i+1}</span>{p}</div>)}
      <h3>Brain Sources</h3>{sources.length ? sources.map(s=><div className="source" key={s.name}>{s.name}<small>score {s.score}</small></div>) : <p className="muted">No source files selected yet.</p>}
      <h3>Hot Memory</h3><p className="muted">Affiliate-first. Compliance-safe. Partner referrals. Premium desktop UX.</p>
    </aside>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
