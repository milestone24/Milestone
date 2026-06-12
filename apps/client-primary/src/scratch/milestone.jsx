import React, { useState, useEffect, useRef, useMemo } from "react";

const PLATFORMS = [
  {id:'t212',  name:'Trading 212',          ab:'Tr', bg:'#0E1116', fg:'#1FA8FF'},
  {id:'ie',    name:'InvestEngine',         ab:'In', bg:'#F1F1F4', fg:'#6E62F5'},
  {id:'vg',    name:'Vanguard',             ab:'Va', bg:'#8B1F1F', fg:'#FFFFFF'},
  {id:'ajb',   name:'AJ Bell',              ab:'AJ', bg:'#0E3F3D', fg:'#7FD9CE'},
  {id:'av',    name:'Aviva',                ab:'Av', bg:'#3C0078', fg:'#FFFFFF'},
  {id:'barc',  name:'Barclays',             ab:'Ba', bg:'#002B5C', fg:'#00AEEF'},
  {id:'bi',    name:'Bestinvest',           ab:'Bs', bg:'#0A2540', fg:'#F5C842'},
  {id:'cs',    name:'Charles Stanley',      ab:'CS', bg:'#1B3A6B', fg:'#FFFFFF'},
  {id:'chip',  name:'Chip',                 ab:'Ch', bg:'#0F2E2A', fg:'#86F0CB'},
  {id:'etoro', name:'eToro',                ab:'eT', bg:'#0E2A1F', fg:'#5EE08F'},
  {id:'fd',    name:'Fidelity',             ab:'Fi', bg:'#0E5C3A', fg:'#FFFFFF'},
  {id:'ft',    name:'Freetrade',            ab:'Fr', bg:'#0F2A24', fg:'#3EE0A8'},
  {id:'hfx',   name:'Halifax',              ab:'Hx', bg:'#003A6E', fg:'#FFFFFF'},
  {id:'hl',    name:'Hargreaves Lansdown',  ab:'HL', bg:'#143C70', fg:'#FFFFFF'},
  {id:'ig',    name:'IG Invest',            ab:'IG', bg:'#0E4F8F', fg:'#FFFFFF'},
  {id:'ii',    name:'Interactive Investor', ab:'II', bg:'#1A1A1A', fg:'#FF8A3D'},
  {id:'jpm',   name:'JP Morgan',            ab:'JP', bg:'#0C2340', fg:'#FFFFFF'},
  {id:'mb',    name:'Moneybox',             ab:'Mo', bg:'#F47C7C', fg:'#FFFFFF'},
  {id:'mf',    name:'Moneyfarm',            ab:'Mf', bg:'#16213E', fg:'#7B68EE'},
  {id:'mnzo',  name:'Monzo',                ab:'Mz', bg:'#3D0015', fg:'#FF3464'},
  {id:'nm',    name:'Nutmeg',               ab:'Nu', bg:'#2D2A26', fg:'#E8B86A'},
  {id:'plum',  name:'Plum',                 ab:'Pl', bg:'#1F1442', fg:'#B59BFF'},
  {id:'ql',    name:'Quilter',              ab:'Qu', bg:'#4A0080', fg:'#FFFFFF'},
  {id:'rh',    name:'Robinhood',            ab:'Rh', bg:'#003300', fg:'#00C805'},
  {id:'sant',  name:'Santander',            ab:'Sn', bg:'#8B0000', fg:'#FFFFFF'},
  {id:'saxo',  name:'Saxo',                 ab:'Sx', bg:'#1C1C28', fg:'#C9A84C'},
  {id:'wf',    name:'Wealthify',            ab:'We', bg:'#0E2440', fg:'#7FB3FF'},
  {id:'xtb',   name:'XTB',                  ab:'Xt', bg:'#7A0E14', fg:'#FFFFFF'},
];

const ACCOUNT_TYPES = [
  {id:'isa',  name:'Stocks & Shares ISA'},
  {id:'sipp', name:'Self-Invested Personal Pension'},
  {id:'lisa', name:'Lifetime ISA'},
  {id:'gia',  name:'General Investment Account'},
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const YEARS = Array.from({length: CURRENT_YEAR - 1979}, (_, i) => String(CURRENT_YEAR - i));
const DAYS = Array.from({length: 31}, (_, i) => String(i + 1).padStart(2, '0'));

const ITEM_H = 50;
const VISIBLE = 5;

const INVESTMENTS = [
  {id:'vwrp', ticker:'VWRP', name:'Vanguard FTSE All-World Acc ETF',      type:'ETF',   bg:'#8B1F1F', fg:'#FFFFFF'},
  {id:'vuag', ticker:'VUAG', name:'Vanguard S&P 500 UCITS ETF Acc',        type:'ETF',   bg:'#8B1F1F', fg:'#FFFFFF'},
  {id:'vusa', ticker:'VUSA', name:'Vanguard S&P 500 UCITS ETF',            type:'ETF',   bg:'#8B1F1F', fg:'#FFFFFF'},
  {id:'vhvg', ticker:'VHVG', name:'Vanguard FTSE Developed World ETF',     type:'ETF',   bg:'#8B1F1F', fg:'#FFFFFF'},
  {id:'cspx', ticker:'CSPX', name:'iShares Core S&P 500 ETF',              type:'ETF',   bg:'#1A3A6B', fg:'#FFFFFF'},
  {id:'swld', ticker:'SWLD', name:'iShares Core MSCI World ETF',            type:'ETF',   bg:'#1A3A6B', fg:'#FFFFFF'},
  {id:'isf',  ticker:'ISF',  name:'iShares Core FTSE 100 ETF',             type:'ETF',   bg:'#1A3A6B', fg:'#FFFFFF'},
  {id:'eqqq', ticker:'EQQQ', name:'Invesco NASDAQ-100 ETF',                type:'ETF',   bg:'#0A2540', fg:'#00B4FF'},
  {id:'aapl', ticker:'AAPL', name:'Apple Inc.',                            type:'Stock', bg:'#1C1C1E', fg:'#FFFFFF'},
  {id:'msft', ticker:'MSFT', name:'Microsoft Corporation',                 type:'Stock', bg:'#00539F', fg:'#FFFFFF'},
  {id:'nvda', ticker:'NVDA', name:'NVIDIA Corporation',                    type:'Stock', bg:'#1A2E0A', fg:'#76B900'},
  {id:'tsla', ticker:'TSLA', name:'Tesla Inc.',                            type:'Stock', bg:'#3D0000', fg:'#FF4444'},
  {id:'amzn', ticker:'AMZN', name:'Amazon.com Inc.',                       type:'Stock', bg:'#1A1200', fg:'#FF9900'},
  {id:'hsba', ticker:'HSBA', name:'HSBC Holdings plc',                     type:'Stock', bg:'#6B0010', fg:'#FFFFFF'},
  {id:'bp',   ticker:'BP.',  name:'BP plc',                                type:'Stock', bg:'#003D00', fg:'#FFD700'},
  {id:'shel', ticker:'SHEL', name:'Shell plc',                             type:'Stock', bg:'#2A2000', fg:'#FFD500'},
  {id:'barc', ticker:'BARC', name:'Barclays plc',                          type:'Stock', bg:'#002B5C', fg:'#00AEEF'},
  {id:'lloy', ticker:'LLOY', name:'Lloyds Banking Group plc',              type:'Stock', bg:'#006B54', fg:'#FFFFFF'},
];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  html, body { margin: 0; padding: 0; background: #0A0A0C; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  .ms-scroll::-webkit-scrollbar { width: 0; }
  .ms-scroll { scrollbar-width: none; }
  .drum-scroll::-webkit-scrollbar { width: 0; }
  .drum-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; scroll-snap-type: y mandatory; }
  @keyframes rowIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .phone-input::placeholder { color: rgba(255,255,255,0.4); }
  .phone-input { caret-color: #2563EB; outline: none; }
  .phone-input[type=number]::-webkit-inner-spin-button,
  .phone-input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .phone-input[type=number] { -moz-appearance: textfield; }
  .phone-btn { outline: none; -webkit-tap-highlight-color: transparent; }
  @keyframes borderSpin {
    from { transform: translate(-50%,-50%) rotate(0deg); }
    to   { transform: translate(-50%,-50%) rotate(360deg); }
  }
  .app-shell {
    position: relative;
    margin: 0 auto;
    max-width: 390px;
    min-height: 100vh;
    background: #09090B;
    overflow: hidden;
  }
  @media (min-width: 430px) {
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .app-shell { min-height: 844px; height: 844px; border-radius: 50px; box-shadow: 0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07); }
  }
  .safe-bottom { padding-bottom: max(36px, calc(env(safe-area-inset-bottom) + 16px)); }
`;

// ── Radio ──────────────────────────────────────────────────────────────────
// ── Phosphor icons (inline paths, viewBox 256x256) ────────────────────────
const PH = {
  arrowLeft:      "M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z",
  magnifyingGlass:"M229.66,218.34l-50.06-50.07a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.31-11.31ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z",
  x:              "M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z",
  caretDown:      "M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z",
  caretLeft:      "M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z",
  lock:           "M208,80H168V72a40,40,0,0,0-80,0v8H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM104,72a24,24,0,0,1,48,0v8H104ZM208,208H48V96H208V208Z",
  chatCircleDots: "M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128ZM84,116a12,12,0,1,0,12,12A12,12,0,0,0,84,116Zm88,0a12,12,0,1,0,12,12A12,12,0,0,0,172,116Zm60,12A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z",
  plus:           "M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z",
  arrowRight:     "M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z",
  arrowBendUpRight:"M229.66,109.66l-48,48a8,8,0,0,1-11.32-11.32L204.69,112H128a88.1,88.1,0,0,0-88,88,8,8,0,0,1-16,0A104.11,104.11,0,0,1,128,96h76.69L170.34,61.66a8,8,0,0,1,11.32-11.32l48,48A8,8,0,0,1,229.66,109.66Z",
  check:          "M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34Z",
};
function Ph({ icon, size=16, color='currentColor', style:s={}, fillRule='nonzero' }) {
  return <svg width={size} height={size} viewBox="0 0 256 256" fill={color} fillRule={fillRule} style={s}><path d={PH[icon]}/></svg>;
}

function Radio({ selected }) {
  return (
    <div style={{position:'relative',width:22,height:22,flexShrink:0}}>
      <div style={{position:'absolute',inset:0,borderRadius:'50%',border:'1.5px solid rgba(140,140,150,0.55)',opacity:selected?0:1,transform:selected?'scale(0.6)':'scale(1)',transition:'opacity 180ms,transform 220ms cubic-bezier(0.34,1.56,0.64,1)'}} />
      <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'#2563EB',transform:selected?'scale(1)':'scale(0.3)',opacity:selected?1:0,transition:'transform 280ms cubic-bezier(0.34,1.56,0.64,1),opacity 180ms'}} />
      <svg width="22" height="22" viewBox="0 0 22 22" style={{position:'absolute',inset:0,opacity:selected?1:0,transition:'opacity 160ms 80ms'}}>
        <path d="M6.5 11.5L9.7 14.6L15.5 8.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
          style={{strokeDasharray:16,strokeDashoffset:selected?0:16,transition:'stroke-dashoffset 300ms cubic-bezier(0.65,0,0.35,1) 100ms'}} />
      </svg>
    </div>
  );
}

// ── PlatformRow ────────────────────────────────────────────────────────────
function PlatformRow({ p, selected, dimmed, onSelect, index }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button className="phone-btn"
      onClick={() => onSelect(p.id)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{all:'unset',boxSizing:'border-box',display:'block',width:'100%',position:'relative',isolation:'isolate',cursor:'pointer',
        opacity:dimmed?0.36:1,filter:dimmed?'saturate(0.85)':'none',
        transform:pressed?'scale(0.985)':'scale(1)',
        transition:'opacity 300ms,filter 300ms,transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
        animation:`rowIn 460ms cubic-bezier(0.22,1,0.36,1) ${index*25}ms backwards`,
      }}
    >
      <div style={{position:'absolute',left:8,right:8,top:3,bottom:3,borderRadius:14,background:'#fff',
        opacity:selected?1:0,transform:selected?'scale(1)':'scale(0.93)',
        transition:selected?'opacity 200ms,transform 360ms cubic-bezier(0.34,1.56,0.64,1),box-shadow 280ms':'opacity 180ms,transform 200ms',
        boxShadow:selected?'0 8px 28px rgba(0,0,0,0.38),0 2px 6px rgba(0,0,0,0.16)':'none',
        willChange:'transform,opacity',
      }} />
      <div style={{position:'relative',display:'flex',alignItems:'center',gap:14,padding:'12px 20px 12px 16px',minHeight:64,
        margin:'3px 0',borderRadius:14,
        background:selected?'transparent':'rgba(255,255,255,0.04)',
      }}>
        <div style={{width:42,height:42,borderRadius:11,background:p.bg,color:p.fg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,letterSpacing:-0.2,flexShrink:0,fontFamily:'Inter,system-ui,sans-serif',boxShadow:selected?'0 2px 8px rgba(0,0,0,0.15)':'inset 0 0 0 0.5px rgba(255,255,255,0.08)'}}>
          {p.ab}
        </div>
        <div style={{flex:1,fontSize:16,fontWeight:500,letterSpacing:-0.2,color:selected?'#09090B':'#fff',fontFamily:'Inter,system-ui,sans-serif',transition:'color 180ms'}}>
          {p.name}
        </div>
        <Radio selected={selected} />
      </div>
    </button>
  );
}

// ── AccountTypeRow ─────────────────────────────────────────────────────────
function AccountTypeRow({ a, selected, dimmed, onSelect, index }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button className="phone-btn"
      onClick={() => onSelect(a.id)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{all:'unset',boxSizing:'border-box',display:'block',width:'100%',position:'relative',isolation:'isolate',cursor:'pointer',
        opacity:dimmed?0.36:1,filter:dimmed?'saturate(0.85)':'none',
        transform:pressed?'scale(0.985)':'scale(1)',
        transition:'opacity 300ms,filter 300ms,transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
        animation:`rowIn 460ms cubic-bezier(0.22,1,0.36,1) ${index*60}ms backwards`,
      }}
    >
      <div style={{position:'absolute',left:8,right:8,top:3,bottom:3,borderRadius:14,background:'#fff',
        opacity:selected?1:0,transform:selected?'scale(1)':'scale(0.93)',
        transition:selected?'opacity 200ms,transform 360ms cubic-bezier(0.34,1.56,0.64,1)':'opacity 180ms,transform 200ms',
        boxShadow:selected?'0 8px 28px rgba(0,0,0,0.38)':'none',
        willChange:'transform,opacity',
      }}/>
      <div style={{position:'relative',display:'flex',alignItems:'center',padding:'16px 20px',minHeight:64,
        margin:'3px 0',borderRadius:14,
        background:selected?'transparent':'rgba(255,255,255,0.04)',
      }}>
        <div style={{flex:1,fontSize:16,fontWeight:500,letterSpacing:-0.2,color:selected?'#09090B':'#fff',fontFamily:'Inter,system-ui,sans-serif',transition:'color 180ms'}}>{a.name}</div>
        <Radio selected={selected}/>
      </div>
    </button>
  );
}

// ── DrumColumn ─────────────────────────────────────────────────────────────
function DrumColumn({ items, selectedIndex, onSelect, flex }) {
  const ref = useRef(null);
  const [localIdx, setLocalIdx] = useState(selectedIndex);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = selectedIndex * ITEM_H;
  }, []);

  // Local scroll: update visuals only, no parent re-render
  const handleScroll = () => {
    if (!ref.current) return;
    const idx = Math.round(Math.max(0, Math.min(items.length - 1, ref.current.scrollTop / ITEM_H)));
    setLocalIdx(idx);
  };

  // Notify parent only when scroll ends — prevents CTA being swallowed by re-renders
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onEnd = () => {
      const idx = Math.round(Math.max(0, Math.min(items.length - 1, el.scrollTop / ITEM_H)));
      onSelect(idx);
    };
    el.addEventListener('scrollend', onEnd);
    return () => el.removeEventListener('scrollend', onEnd);
  }, []);

  return (
    <div style={{flex, position:'relative', height: ITEM_H * VISIBLE, overflow:'hidden'}}>
      <div ref={ref} onScroll={handleScroll} className="drum-scroll"
        style={{height:'100%', overflowY:'scroll', paddingTop: ITEM_H * 2, paddingBottom: ITEM_H * 2}}>
        {items.map((item, i) => {
          const d = Math.abs(i - localIdx);
          const signed = i - localIdx;
          const angle = Math.max(-72, Math.min(72, signed * 17));
          const opacity = d===0?1:d===1?0.6:d===2?0.3:d===3?0.12:0.04;
          return (
            <div key={i} style={{
              height: ITEM_H,
              scrollSnapAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Inter,system-ui,sans-serif',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 19,
              fontWeight: d===0 ? 600 : 400,
              color: '#fff',
              letterSpacing: d===0 ? -0.5 : 0,
              opacity,
              transform: `perspective(180px) rotateX(${angle}deg)`,
              transformOrigin: 'center center',
              transition: 'opacity 100ms',
              userSelect: 'none',
            }}>
              {item}
            </div>
          );
        })}
      </div>
      <div style={{position:'absolute',top:0,left:0,right:0,height:ITEM_H*2,
        background:'linear-gradient(to bottom,rgba(9,9,11,0.95) 0%,rgba(9,9,11,0.4) 60%,transparent)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:ITEM_H*2,
        background:'linear-gradient(to top,rgba(9,9,11,0.95) 0%,rgba(9,9,11,0.4) 60%,transparent)',pointerEvents:'none'}}/>
    </div>
  );
}

// ── BottomCTA ──────────────────────────────────────────────────────────────
function BottomCTA({ active, onClick, label }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button className="phone-btn"
      disabled={!active}
      onClick={active ? onClick : undefined}
      onPointerDown={() => active && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{all:'unset',boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',width:'100%',height:56,borderRadius:999,
        background:'#18181B',cursor:active?'pointer':'default',
        position:'relative',overflow:'hidden',
        transform:pressed?'scale(0.975)':'scale(1)',
        transition:'transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow:active?'0 12px 32px rgba(255,255,255,0.08)':'none',
        fontFamily:'Inter,system-ui,sans-serif',
      }}
    >
      <div style={{position:'absolute',left:'50%',top:'50%',width:80,height:80,marginLeft:-40,marginTop:-40,borderRadius:'50%',background:'#fff',
        transform:active?'scale(6)':'scale(0)',
        transition:active?'transform 500ms cubic-bezier(0.22,1,0.36,1) 120ms':'transform 400ms cubic-bezier(0.4,0,0.2,1) 120ms',
        willChange:'transform',
      }} />
      <span style={{position:'absolute',zIndex:1,fontSize:16,fontWeight:600,letterSpacing:-0.2,color:'rgba(255,255,255,0.3)',opacity:active?0:1,transition:active?'opacity 100ms':'opacity 180ms 320ms'}}>
        {label}
      </span>
      <span style={{position:'absolute',zIndex:1,fontSize:16,fontWeight:600,letterSpacing:-0.2,color:'#09090B',opacity:active?1:0,transform:active?'translateY(0)':'translateY(8px)',transition:active?'opacity 180ms 200ms,transform 240ms cubic-bezier(0.34,1.56,0.64,1) 190ms':'opacity 80ms,transform 200ms'}}>
        Continue
      </span>
    </button>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState(4);
  const [selected, setSelected] = useState(null);
  const [accountType, setAccountType] = useState(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [sheetName, setSheetName] = useState('');
  const [sent, setSent] = useState(false);

  // Date picker state — default to today
  const [showHelp, setShowHelp] = useState(false);
  const dateScrollRef = useRef(null);
  const [platformScrolled, setPlatformScrolled] = useState(false);
  const platformScrollRef = useRef(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [dayIdx, setDayIdx] = useState(now.getDate() - 1);
  const [monthIdx, setMonthIdx] = useState(now.getMonth());
  const [yearIdx, setYearIdx] = useState(0);

  const filtered = useMemo(() => {
    if (!query.trim()) return PLATFORMS;
    const q = query.toLowerCase();
    return PLATFORMS.filter(p => p.name.toLowerCase().includes(q));
  }, [query]);

  const openSheet = () => { setSheetName(query.trim()); setSent(false); setShowSheet(true); };
  const handleSend = () => { if (!sheetName.trim()) return; setSent(true); setTimeout(() => setShowSheet(false), 3000); };

  const [cashAmount, setCashAmount] = useState('');
  const [investScrolled, setInvestScrolled] = useState(false);
  const investScrollRef = useRef(null);
  const [investQuery, setInvestQuery] = useState('');
  const [investSearchFocused, setInvestSearchFocused] = useState(false);
  const investSearchRef = useRef(null);
  const [investSheet, setInvestSheet] = useState(null);
  const [showInvestRequest, setShowInvestRequest] = useState(false);
  const [showShareHelp, setShowShareHelp] = useState(false);
  const [investRequestName, setInvestRequestName] = useState('');
  const [investRequestSent, setInvestRequestSent] = useState(false);
  const [sharesHeld, setSharesHeld] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [addedInvestments, setAddedInvestments] = useState([]);

  const [contribMethod, setContribMethod] = useState(null);

  const progressFilled = screen <= 3 ? 1 : screen <= 5 ? 2 : 3;
  const titles = ['Add your account', 'Select account type', 'When did you open this account?', 'Add your investments', 'Add your investments', 'Track contributions'];
  const ctaLabels = ['', '', '', 'Search to add investments', 'Enter your cash balance', 'Select a method'];
  const hasInvestments = addedInvestments.length > 0;
  const hasCash = cashAmount.trim().length > 0;
  const ctaActive = [!!selected, !!accountType, true, hasInvestments, hasCash, !!contribMethod];

  return (
    <div className="app-shell" style={{fontFamily:'Inter,system-ui,sans-serif'}}>
      <style dangerouslySetInnerHTML={{__html:css}}/>

        {/* Ambient glow */}
        <div style={{position:'absolute',inset:0,background:'radial-gradient(480px 280px at 6% -5%,rgba(80,130,255,0.09),transparent 65%)',pointerEvents:'none',zIndex:0}} />

        {/* ── Fixed header ── */}
        <div style={{position:'absolute',top:0,left:0,right:0,zIndex:20,padding:'48px 24px 16px',display:'flex',flexDirection:'column',gap:12,background:'#09090B'}}>
          {/* Back + progress bar inline */}
          <div style={{position:'relative',display:'flex',alignItems:'center',gap:14}}>
            <button className="phone-btn" onClick={()=>screen>1&&setScreen(s=>s-1)}
              style={{all:'unset',width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'0.5px solid rgba(255,255,255,0.09)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
              <Ph icon="caretLeft" size={18} color="rgba(255,255,255,0.8)"/>
            </button>
            <div style={{display:'flex',gap:6,flex:1}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{flex:1,height:3,borderRadius:2,
                  background:i<progressFilled?'rgba(255,255,255,0.85)':'rgba(255,255,255,0.10)',
                  transition:'background 400ms ease',
                }}/>
              ))}
            </div>
            {/* Help button */}
            <button className="phone-btn" onClick={()=>setShowHelpModal(true)}
              style={{all:'unset',width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'0.5px solid rgba(255,255,255,0.09)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
              <Ph icon="chatCircleDots" size={20} color="rgba(255,255,255,0.75)" fillRule="evenodd"/>
            </button>
          </div>
          {/* Title */}
          <div style={{position:'relative',height:52}}>
            {titles.map((t,i)=>(
              <h1 key={i} style={{position:'absolute',margin:0,fontSize:22,fontWeight:700,color:'#fff',lineHeight:1.2,letterSpacing:-0.3,textAlign:'center',width:'100%',
                opacity:screen===i+1?1:0,transition:'opacity 260ms ease',pointerEvents:'none',
              }}>{t}</h1>
            ))}
          </div>

        </div>

        {/* ── Sliding content ── */}
        <div style={{position:'absolute',left:0,right:0,top:168,bottom:100,overflow:'hidden',zIndex:1}}>

            {/* Screen 1 — Platform */}
            <div style={{position:'absolute',inset:0,overflow:'hidden',transform:'translateX('+((1-screen)*100)+'%)',transition:'transform 420ms cubic-bezier(0.32,0.72,0,1)',willChange:'transform'}}>
              <div ref={platformScrollRef} className="ms-scroll" onScroll={e=>setPlatformScrolled(e.currentTarget.scrollTop>0)} style={{position:'absolute',inset:0,overflowY:'auto',padding:'4px 8px 180px'}}>
                {filtered.map((p,i)=>(
                  <PlatformRow key={p.id} p={p} index={i}
                    selected={selected===p.id} dimmed={selected!==null&&selected!==p.id}
                    onSelect={id=>{
                      setSelected(id);
                      setTimeout(()=>setScreen(2), 320);
                    }} />
                ))}
                {filtered.length===0&&(
                  <div style={{padding:'60px 24px 40px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
                    <div style={{color:'rgba(255,255,255,0.4)',fontSize:14}}>No platforms match "{query}"</div>
                    <button className="phone-btn" onClick={openSheet} style={{all:'unset',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:7,padding:'10px 16px',borderRadius:999,border:'0.5px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.75)',fontSize:13,fontWeight:500}}>
                      Can't find your platform? <span style={{color:'#2563EB',fontWeight:600}}>Let us know </span><Ph icon="arrowRight" size={10} color="#2563EB" style={{verticalAlign:"middle",marginBottom:1}}/>
                    </button>
                  </div>
                )}
                <div style={{height:20}}/>
              </div>
              <div style={{position:'absolute',left:0,right:0,top:0,height:100,background:'linear-gradient(to bottom,#09090B 0%,rgba(9,9,11,0.85) 40%,rgba(9,9,11,0.4) 70%,transparent 100%)',pointerEvents:'none',zIndex:3,opacity:platformScrolled?1:0,transition:'opacity 300ms ease'}}/>
              <div style={{position:'absolute',left:0,right:0,bottom:0,height:160,background:'linear-gradient(to bottom,transparent 0%,#09090B 60%)',pointerEvents:'none'}}/>
              {/* Search */}
              <div style={{position:'absolute',left:44,right:44,bottom:106,zIndex:10}}>
                <div style={{height:50,borderRadius:14,background:'#111114',
                  border:'0.5px solid rgba(255,255,255,0.18)',
                  boxShadow:focused?'0 0 0 1px rgba(255,255,255,0.25), 0 0 8px 3px rgba(255,255,255,0.08), 0 0 20px 6px rgba(255,255,255,0.04)':'0 8px 24px rgba(0,0,0,0.4)',
                  display:'flex',alignItems:'center',padding:'0 14px',
                  transition:'box-shadow 200ms,border-color 200ms',
                }}>
                  <Ph icon="magnifyingGlass" size={16} color="rgba(255,255,255,0.45)" fillRule="evenodd" style={{flexShrink:0,marginRight:10}}/>
                  <input className="phone-input" value={query} onChange={e=>setQuery(e.target.value)}
                    onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
                    placeholder="Search platforms…"
                    style={{all:'unset',flex:1,fontSize:15,color:'#fff',letterSpacing:-0.15,fontFamily:'Inter,system-ui,sans-serif'}}/>
                  {query&&(
                    <button className="phone-btn" onClick={()=>setQuery('')} style={{all:'unset',cursor:'pointer',width:18,height:18,borderRadius:'50%',background:'rgba(255,255,255,0.45)',display:'flex',alignItems:'center',justifyContent:'center',marginLeft:8,flexShrink:0}}>
                      <Ph icon="x" size={10} color="rgba(255,255,255,0.7)"/>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Screen 2 — Account type */}
            <div style={{position:'absolute',inset:0,overflow:'hidden',transform:'translateX('+((2-screen)*100)+'%)',transition:'transform 420ms cubic-bezier(0.32,0.72,0,1)',willChange:'transform'}}>
              <div className="ms-scroll" style={{position:'absolute',inset:0,overflowY:'auto',padding:'4px 8px 180px'}}>
                {ACCOUNT_TYPES.map((a,i)=>(
                  <AccountTypeRow key={a.id} a={a} index={i}
                    selected={accountType===a.id} dimmed={accountType!==null&&accountType!==a.id}
                    onSelect={id=>{
                      setAccountType(id);
                      setTimeout(()=>setScreen(3), 320);
                    }}/>
                ))}
              </div>
              <div style={{position:'absolute',left:0,right:0,bottom:0,height:180,background:'linear-gradient(to bottom,transparent 0%,rgba(9,9,11,0.7) 40%,#09090B 80%)',pointerEvents:'none'}}/>
            </div>

            {/* Screen 3 — Date picker */}
            <div style={{position:'absolute',inset:0,overflow:'hidden',transform:'translateX('+((3-screen)*100)+'%)',transition:'transform 420ms cubic-bezier(0.32,0.72,0,1)',willChange:'transform'}}>
              <div ref={dateScrollRef} className="ms-scroll" style={{position:'absolute',inset:0,overflowY:'auto',padding:'24px 24px 180px',display:'flex',flexDirection:'column',alignItems:'center'}}>
                {/* Drum picker */}
                <div style={{width:'100%',display:'flex',gap:0,alignItems:'center',position:'relative',marginBottom:28}}>
                  <div style={{position:'absolute',top:ITEM_H*2,left:0,right:0,height:ITEM_H,
                    background:'rgba(255,255,255,0.04)',
                    borderRadius:14,
                    pointerEvents:'none',zIndex:5}}/>
                  <DrumColumn items={DAYS}   selectedIndex={dayIdx}   onSelect={setDayIdx}   flex={1}/>
                  <DrumColumn items={MONTHS} selectedIndex={monthIdx} onSelect={setMonthIdx} flex={2}/>
                  <DrumColumn items={YEARS}  selectedIndex={yearIdx}  onSelect={setYearIdx}  flex={1.2}/>
                 </div>{/* close drum picker */}
                {/* How can I find this */}
                <div style={{textAlign:'center',width:'100%'}}>
                <button className="phone-btn" onClick={()=>{ const n=!showHelp; setShowHelp(n); if(n && dateScrollRef.current) setTimeout(()=>dateScrollRef.current.scrollTo({top:200,behavior:'smooth'}),50); }}
                  style={{all:'unset',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:7,padding:'10px 16px',borderRadius:999,border:'0.5px solid rgba(37,99,235,0.3)',color:'#2563EB',fontSize:13,fontWeight:500,fontFamily:'Inter,system-ui,sans-serif'}}>
                  How can I find this?
                  <Ph icon="caretDown" size={13} color="#2563EB" style={{transform:showHelp?'rotate(180deg)':"rotate(0deg)",transition:"transform 260ms cubic-bezier(0.4,0,0.2,1)",flexShrink:0}}/>
                </button>
                <div style={{overflow:'hidden',maxHeight:showHelp?'480px':'0',transition:'max-height 420ms cubic-bezier(0.4,0,0.2,1)'}}>
                  <div style={{margin:'12px 0 0',borderRadius:16,background:'rgba(255,255,255,0.04)',padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
                    <span style={{fontSize:13,color:'rgba(255,255,255,0.55)',lineHeight:1.5,fontFamily:'Inter,system-ui,sans-serif'}}>
                      Open your investing app, on your chart, toggle "Max" — then hover the chart to find the start date. A line may appear, make sure it's at the very start of the chart, and you'll find the date.
                    </span>
                    {/* Illustrated screenshot */}
                    <div style={{borderRadius:10,background:'#fff',padding:'10px 12px',display:'flex',flexDirection:'column',gap:8,margin:'0 4px'}}>
                      {/* Time selector */}
                      <div style={{display:'flex',justifyContent:'space-between',background:'#f3f3f3',borderRadius:20,padding:'3px'}}>
                        {['1W','1M','6M','1Y','Max'].map(t=>(
                          <div key={t} style={{position:'relative',flex:1,textAlign:'center',padding:'4px 0',borderRadius:16,
                            background:t==='Max'?'#fff':'transparent',
                            boxShadow:t==='Max'?'0 1px 3px rgba(0,0,0,0.1)':'none',
                          }}>
                            {t==='Max'&&<div style={{position:'absolute',inset:-2,borderRadius:18,border:'1.5px solid #2563EB',pointerEvents:'none'}}/>}
                            <span style={{fontSize:11,fontWeight:t==='Max'?600:400,color:t==='Max'?'#111':'#999',fontFamily:'Inter,system-ui,sans-serif'}}>{t}</span>
                          </div>
                        ))}
                      </div>
                      {/* Tabs */}
                      <div style={{display:'flex',borderBottom:'1px solid #eee'}}>
                        <div style={{flex:1,textAlign:'center',paddingBottom:6,borderBottom:'2px solid #22c55e',fontSize:11,fontWeight:600,color:'#111',fontFamily:'Inter,system-ui,sans-serif'}}>Investment return</div>
                        <div style={{flex:1,textAlign:'center',paddingBottom:6,fontSize:11,color:'#bbb',fontFamily:'Inter,system-ui,sans-serif'}}>Dividends</div>
                      </div>
                      {/* Highlighted date value */}
                      <div style={{position:'relative',textAlign:'center',padding:'3px 8px',alignSelf:'center'}}>
                        <div style={{position:'absolute',inset:-2,borderRadius:7,border:'1.5px solid #2563EB',pointerEvents:'none'}}/>
                        <div style={{fontSize:15,fontWeight:700,color:'#111',fontFamily:'Inter,system-ui,sans-serif'}}>£8<span style={{fontSize:12,fontWeight:400}}>.55</span></div>
                        <div style={{fontSize:10,color:'#666',fontFamily:'Inter,system-ui,sans-serif'}}>30 Apr 2024</div>
                      </div>
                      {/* Chart */}
                      <div style={{height:60}}>
                        <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none">
                          <polyline points="0,52 20,50 40,46 60,42 80,44 100,34 120,36 140,32 150,22 160,40 180,26 200,18 220,14 240,10 260,8 280,5 300,3"
                            fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinejoin="round"/>
                          <circle cx="0" cy="52" r="3" fill="#999"/>
                          <line x1="0" y1="0" x2="0" y2="60" stroke="#ddd" strokeWidth="1"/>
                        </svg>
                      </div>
                      {/* X axis dates */}
                      <div style={{display:'flex',justifyContent:'space-between',marginTop:-4}}>
                        <div style={{position:'relative'}}>
                          <div style={{position:'absolute',inset:-2,borderRadius:5,border:'1.5px solid #2563EB',pointerEvents:'none'}}/>
                          <span style={{fontSize:10,color:'#999',fontFamily:'Inter,system-ui,sans-serif',padding:'0 2px'}}>30 Apr 24</span>
                        </div>
                        <span style={{fontSize:10,color:'#999',fontFamily:'Inter,system-ui,sans-serif'}}>28 May 26</span>
                      </div>
                    </div>
                  </div>
                </div>
                </div>{/* close How can I find this */}
              </div>{/* close ms-scroll */}
            </div>{/* close screen 3 */}

            {/* Screen 4 — Uninvested cash */}
            <div style={{position:'absolute',inset:0,overflow:'hidden',transform:'translateX('+((5-screen)*100)+'%)',transition:'transform 420ms cubic-bezier(0.32,0.72,0,1)',willChange:'transform',display:'flex',flexDirection:'column',padding:'24px 24px 0'}}>
              <p style={{margin:'0 0 8px',fontSize:17,fontWeight:500,color:'#fff',lineHeight:1.5,letterSpacing:-0.1,fontFamily:'Inter,system-ui,sans-serif'}}>
                What's your cash balance?
              </p>
              <p style={{margin:'0 0 20px',fontSize:13,color:'rgba(255,255,255,0.4)',fontFamily:'Inter,system-ui,sans-serif',lineHeight:1.5}}>
                Any uninvested cash sitting in this account today.
              </p>
              <div style={{display:'flex',alignItems:'center',gap:0,padding:'0 16px',height:50,borderRadius:14,background:'rgba(255,255,255,0.04)',border:'0.5px solid rgba(255,255,255,0.18)'}}>
                <span style={{fontSize:16,fontWeight:500,color:'rgba(255,255,255,0.45)',fontFamily:'Inter,system-ui,sans-serif',marginRight:4}}>£</span>
                <input
                  className="phone-input"
                  type="number"
                  inputMode="decimal"
                  value={cashAmount}
                  onChange={e=>setCashAmount(e.target.value)}
                  placeholder="0.00"
                  style={{all:'unset',flex:1,fontSize:16,fontWeight:500,color:'#fff',fontFamily:'Inter,system-ui,sans-serif',letterSpacing:-0.1,caretColor:'#2563EB'}}
                />
              </div>
            </div>
            <div style={{position:'absolute',inset:0,overflow:'hidden',transform:'translateX('+((4-screen)*100)+'%)',transition:'transform 420ms cubic-bezier(0.32,0.72,0,1)',willChange:'transform',display:'flex',flexDirection:'column'}}>

              {/* Search bar */}
              <div style={{padding:'8px 16px 12px',flexShrink:0}}>
                <div style={{height:50,borderRadius:14,background:'#111114',
                  border:investSearchFocused?'0.5px solid rgba(255,255,255,0.35)':'0.5px solid rgba(255,255,255,0.18)',
                  display:'flex',alignItems:'center',padding:'0 14px',
                  transition:'border-color 200ms',
                }}>
                  <Ph icon="magnifyingGlass" size={16} color="rgba(255,255,255,0.45)" style={{flexShrink:0,marginRight:10}}/>
                  <input ref={investSearchRef} className="phone-input" value={investQuery}
                    onChange={e=>setInvestQuery(e.target.value)}
                    onFocus={()=>setInvestSearchFocused(true)}
                    onBlur={()=>{ setTimeout(()=>setInvestSearchFocused(false),150); }}
                    placeholder="Search by name or ticker…"
                    style={{all:'unset',flex:1,fontSize:15,color:'#fff',letterSpacing:-0.1,fontFamily:'Inter,system-ui,sans-serif'}}/>
                  {investQuery&&(
                    <button className="phone-btn" onClick={()=>setInvestQuery('')} style={{all:'unset',cursor:'pointer',width:18,height:18,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <Ph icon="x" size={8} color="#09090B"/>
                    </button>
                  )}
                </div>
              </div>

              {/* Content area */}
              <div style={{flex:1,minHeight:0,position:'relative'}}>

                {/* Search results — shown when focused or has query */}
                <div className="ms-scroll" onScroll={e=>setInvestScrolled(e.currentTarget.scrollTop>0)} style={{position:'absolute',inset:0,overflowY:'auto',padding:'0 8px 180px',
                  opacity:(investSearchFocused||investQuery)?1:0,
                  pointerEvents:(investSearchFocused||investQuery)?'auto':'none',
                  transition:'opacity 200ms',
                }}>
                  {INVESTMENTS
                    .filter(inv=>!investQuery.trim()||inv.ticker.toLowerCase().includes(investQuery.toLowerCase())||inv.name.toLowerCase().includes(investQuery.toLowerCase()))
                    .map((inv,i)=>{
                      const isAdded = addedInvestments.some(a=>a.id===inv.id);
                      return (
                        <button key={inv.id} className="phone-btn"
                          onClick={()=>{ setInvestSheet(inv); setSharesHeld(isAdded?(addedInvestments.find(a=>a.id===inv.id)?.shares||''):''); setCurrentValue(isAdded?(addedInvestments.find(a=>a.id===inv.id)?.value||''):''); }}
                          style={{all:'unset',boxSizing:'border-box',display:'block',width:'100%',cursor:'pointer',
                            animation:`rowIn 300ms cubic-bezier(0.22,1,0.36,1) ${i*20}ms backwards`,
                            position:'relative',
                          }}>
                          {/* White card for added state */}
                          <div style={{position:'absolute',left:0,right:0,top:3,bottom:3,borderRadius:14,background:'#fff',
                            opacity:isAdded?1:0,transform:isAdded?'scale(1)':'scale(0.93)',
                            transition:'opacity 200ms,transform 360ms cubic-bezier(0.34,1.56,0.64,1)',
                            boxShadow:isAdded?'0 8px 28px rgba(0,0,0,0.38)':'none',
                          }}/>
                          <div style={{position:'relative',display:'flex',alignItems:'center',gap:14,padding:'12px 16px',margin:'3px 0',borderRadius:14,
                            background:isAdded?'transparent':'rgba(255,255,255,0.04)',minHeight:64}}>
                            <div style={{width:42,height:42,borderRadius:11,background:inv.bg,color:inv.fg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,flexShrink:0,fontFamily:'Inter,system-ui,sans-serif'}}>
                              {inv.ticker.length>4?inv.ticker.slice(0,4):inv.ticker}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:15,fontWeight:500,letterSpacing:-0.2,fontFamily:'Inter,system-ui,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                                color:isAdded?'#09090B':'#fff',transition:'color 180ms'}}>{inv.name}</div>
                              <div style={{fontSize:12,marginTop:2,fontFamily:'Inter,system-ui,sans-serif',
                                color:isAdded?'rgba(0,0,0,0.4)':'rgba(255,255,255,0.4)',transition:'color 180ms'}}>{inv.type} · {inv.ticker}</div>
                            </div>
                            <Radio selected={isAdded}/>
                          </div>
                        </button>
                      );
                    })
                  }
                  {investQuery.trim() && INVESTMENTS.filter(inv=>inv.ticker.toLowerCase().includes(investQuery.toLowerCase())||inv.name.toLowerCase().includes(investQuery.toLowerCase())).length===0&&(
                    <div style={{padding:'60px 24px 40px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
                      <div style={{color:'rgba(255,255,255,0.4)',fontSize:14,fontFamily:'Inter,system-ui,sans-serif'}}>No investments match "{investQuery}"</div>
                      <button className="phone-btn" onClick={()=>{ setInvestRequestName(investQuery.trim()); setInvestRequestSent(false); setShowInvestRequest(true); }}
                        style={{all:'unset',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:7,padding:'10px 16px',borderRadius:999,border:'0.5px solid rgba(37,99,235,0.3)',color:'rgba(255,255,255,0.6)',fontSize:13,fontWeight:500,fontFamily:'Inter,system-ui,sans-serif'}}>
                        Can't find your investment? <span style={{color:'#2563EB',fontWeight:600}}>Let us know </span><Ph icon="arrowRight" size={10} color="#2563EB" style={{verticalAlign:"middle",marginBottom:1}}/>
                      </button>
                    </div>
                  )}
                </div>

                {/* Added investments — shown by default */}
                <div ref={investScrollRef} className="ms-scroll" onScroll={e=>setInvestScrolled(e.currentTarget.scrollTop>0)} style={{position:'absolute',inset:0,overflowY:'auto',padding:'0 16px 180px',
                  opacity:(investSearchFocused||investQuery)?0:1,
                  pointerEvents:(investSearchFocused||investQuery)?'none':'auto',
                  transition:'opacity 200ms',
                }}>
                  {addedInvestments.length===0?(
                    <div style={{paddingTop:32,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
                      <button className="phone-btn" onClick={()=>{ setInvestSearchFocused(true); investSearchRef.current?.focus(); }}
                        onPointerDown={e=>e.currentTarget.style.transform='scale(0.9)'}
                        onPointerUp={e=>e.currentTarget.style.transform='scale(1)'}
                        onPointerLeave={e=>e.currentTarget.style.transform='scale(1)'}
                        style={{all:'unset',cursor:'pointer',width:48,height:48,borderRadius:'50%',background:'rgba(37,99,235,0.12)',display:'flex',alignItems:'center',justifyContent:'center',transition:'transform 220ms cubic-bezier(0.34,1.56,0.64,1)'}}>
                        <Ph icon="plus" size={20} color="#2563EB"/>
                      </button>
                      <div style={{fontSize:15,fontWeight:500,color:'rgba(255,255,255,0.4)',fontFamily:'Inter,system-ui,sans-serif'}}>Search to add investments</div>
                    </div>
                  ):(
                    addedInvestments.map((inv,i)=>(
                      <div key={inv.id} style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',margin:'3px 0',borderRadius:14,background:'rgba(255,255,255,0.04)',minHeight:64,
                        animation:`rowIn 360ms cubic-bezier(0.22,1,0.36,1) backwards`,
                        cursor:'pointer',
                      }}
                      onClick={()=>{ setInvestSheet(inv); setSharesHeld(inv.shares||''); setCurrentValue(inv.value||''); }}>
                        <div style={{width:42,height:42,borderRadius:11,background:inv.bg,color:inv.fg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,flexShrink:0,fontFamily:'Inter,system-ui,sans-serif'}}>
                          {inv.ticker.length>4?inv.ticker.slice(0,4):inv.ticker}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:15,fontWeight:500,color:'#fff',letterSpacing:-0.2,fontFamily:'Inter,system-ui,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{inv.name}</div>
                          <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:2,fontFamily:'Inter,system-ui,sans-serif'}}>
                            {inv.ticker}{inv.shares?` · ${inv.shares} shares`:''} · <span style={{color:'rgba(255,255,255,0.65)'}}>£{inv.value}</span>
                          </div>
                        </div>
                        <button className="phone-btn" onClick={()=>setAddedInvestments(prev=>prev.filter(a=>a.id!==inv.id))}
                          style={{all:'unset',cursor:'pointer',width:24,height:24,borderRadius:'50%',background:'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <Ph icon="x" size={8} color="rgba(255,255,255,0.5)"/>
                        </button>
                      </div>
                    ))
                  )}
                  {addedInvestments.length>0&&(
                    <p style={{margin:'8px 8px 0',fontSize:12,color:'rgba(255,255,255,0.25)',fontFamily:'Inter,system-ui,sans-serif',textAlign:'center'}}>
                      You can update these anytime from your account.
                    </p>
                  )}
                </div>

                <div style={{position:'absolute',left:0,right:0,top:74,height:80,background:'linear-gradient(to bottom,#09090B 0%,rgba(9,9,11,0.85) 40%,rgba(9,9,11,0.4) 70%,transparent 100%)',pointerEvents:'none',zIndex:3,opacity:investScrolled?1:0,transition:'opacity 300ms ease'}}/>
                <div style={{position:'absolute',left:0,right:0,bottom:0,height:160,background:'linear-gradient(to bottom,transparent,#09090B 60%)',pointerEvents:'none'}}/>
              </div>
            </div>
            <div style={{position:'absolute',inset:0,overflow:'hidden',display:'flex',flexDirection:'column',padding:'16px 16px 0',transform:'translateX('+((6-screen)*100)+'%)',transition:'transform 420ms cubic-bezier(0.32,0.72,0,1)',willChange:'transform'}}>
              <div className="ms-scroll" style={{flex:1,overflowY:'auto',paddingBottom:120,display:'flex',flexDirection:'column',gap:8}}>

                {/* Manual */}
                {[
                  {id:'manual',   icon:'✏️',  iconBg:'#1A1040', title:'Manual',    badge:null,                      sub:'I\'ll log each trade myself',       desc:'Most accurate. Full control over every entry.'},
                  {id:'scheduled',icon:'📅',  iconBg:'#0A2520', title:'Scheduled', badge:null,                      sub:'I invest on a fixed schedule',      desc:'Set an amount and date. We\'ll log it each month.'},
                  {id:'ai',       icon:'✦',   iconBg:'#1A0A30', title:'AI',        badge:'Pro',                     sub:'Let AI do it',                      desc:'Forward your portfolio reports. AI reads and logs your trades.'},
                ].map(opt=>{
                  const isSelected = contribMethod===opt.id;
                  const isLocked = opt.id==='ai';
                  const isDimmed = contribMethod!==null && !isSelected && !isLocked;
                  return (
                    <button key={opt.id} className="phone-btn"
                      onClick={()=>!isLocked&&setContribMethod(prev=>prev===opt.id?null:opt.id)}
                      style={{all:'unset',boxSizing:'border-box',display:'block',width:'100%',position:'relative',isolation:'isolate',cursor:isLocked?'default':'pointer',
                        opacity:isDimmed?0.36:isLocked&&contribMethod?0.36:1,
                        filter:isDimmed?'saturate(0.85)':'none',
                        transition:'opacity 300ms,filter 300ms',
                        animation:`rowIn 460ms cubic-bezier(0.22,1,0.36,1) backwards`,
                      }}>
                      {/* Gradient border for AI card */}
                      {isLocked&&(
                        <div style={{position:'absolute',inset:0,borderRadius:17,padding:1.5,
                          background:'linear-gradient(135deg,#6B21A8,#9333EA,#EC4899,#FB923C)',
                          WebkitMask:'linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0)',
                          WebkitMaskComposite:'xor',
                          maskComposite:'exclude',
                          opacity:0.7,
                        }}/>
                      )}
                      {/* White card bg when selected */}
                      <div style={{position:'absolute',left:0,right:0,top:3,bottom:3,borderRadius:14,background:'#fff',
                        opacity:isSelected?1:0,transform:isSelected?'scale(1)':'scale(0.93)',
                        transition:isSelected?'opacity 200ms,transform 360ms cubic-bezier(0.34,1.56,0.64,1)':'opacity 180ms,transform 200ms',
                        boxShadow:isSelected?'0 8px 28px rgba(0,0,0,0.38)':'none',
                        willChange:'transform,opacity',
                      }}/>
                      <div style={{position:'relative',display:'flex',alignItems:'flex-start',gap:12,padding:'10px 14px',margin:'3px 0',borderRadius:14,
                        background:isLocked?'rgba(107,33,168,0.06)':isSelected?'transparent':'rgba(255,255,255,0.04)',
                      }}>
                        {/* Icon */}
                        <div style={{width:44,height:44,borderRadius:12,background:opt.iconBg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0,marginTop:2}}>
                          {opt.icon}
                        </div>
                        {/* Text */}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                            <span style={{fontSize:16,fontWeight:600,color:isSelected?'#09090B':'#fff',letterSpacing:-0.2,fontFamily:'Inter,system-ui,sans-serif',transition:'color 180ms'}}>{opt.title}</span>
                            {opt.badge&&(
                              <span style={{fontSize:11,fontWeight:700,color:'#fff',
                                background:'linear-gradient(135deg,#6B21A8,#9333EA,#EC4899,#FB923C)',
                                padding:'2px 8px',borderRadius:999,fontFamily:'Inter,system-ui,sans-serif',letterSpacing:0.3,
                                boxShadow:'0 2px 8px rgba(147,51,234,0.4)',
                              }}>
                                Pro
                              </span>
                            )}
                          </div>
                          <div style={{fontSize:13,fontWeight:500,color:isSelected?'rgba(0,0,0,0.7)':'rgba(255,255,255,0.7)',marginBottom:4,fontFamily:'Inter,system-ui,sans-serif',transition:'color 180ms'}}>{opt.sub}</div>
                          <div style={{fontSize:12,color:isSelected?'rgba(0,0,0,0.45)':'rgba(255,255,255,0.35)',lineHeight:1.5,fontFamily:'Inter,system-ui,sans-serif',transition:'color 180ms'}}>{opt.desc}</div>
                        </div>
                        {/* Radio */}
                        {!isLocked&&<Radio selected={isSelected}/>}
                        {isLocked&&(
                          <div style={{width:22,height:22,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <Ph icon="lock" size={15} color="rgba(168,85,247,0.55)" fillRule="evenodd"/>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
        </div>

        <div className="safe-bottom" style={{position:'absolute',left:0,right:0,bottom:0,padding:'0 20px 36px',zIndex:50,
          opacity:focused?0:screen<=2?0:1,
          pointerEvents:focused||screen<=2?'none':'auto',transform:focused?'translateY(20px)':'translateY(0)',
          transition:'opacity 240ms,transform 300ms',
          background:'linear-gradient(to bottom,transparent,#09090B 30%)',paddingTop:24,
        }}>
          <BottomCTA
            active={ctaActive[screen-1]}
            label={ctaLabels[screen-1]}
            onClick={screen<6?()=>setScreen(s=>s+1):()=>{}}
          />
          {screen!==6&&(
            <button className="phone-btn" onClick={()=>setScreen(6)}
              style={{all:'unset',cursor:'pointer',display:'block',width:'100%',textAlign:'center',
                fontSize:12,color:'rgba(255,255,255,0.25)',fontFamily:'Inter,system-ui,sans-serif',
                padding:'8px 0 0',letterSpacing:-0.1,
              }}>
              Skip to contributions
            </button>
          )}
        </div>

        {/* ── Investment card overlay ── */}
        <div onClick={()=>setInvestSheet(null)}
          style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',zIndex:72,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 20px',
            opacity:investSheet?1:0,pointerEvents:investSheet?'auto':'none',
            transition:'opacity 280ms ease',
          }}>
          {investSheet&&(
            <div onClick={e=>e.stopPropagation()}
              onKeyDown={e=>{ if(e.key==='Tab'){ e.preventDefault(); } }}
              style={{width:'100%',background:'#09090B',borderRadius:24,padding:'20px 20px 20px',
                border:'0.5px solid rgba(255,255,255,0.18)',
                transform:investSheet?'scale(1) translateY(0)':'scale(0.94) translateY(16px)',
                transition:'transform 320ms cubic-bezier(0.34,1.56,0.64,1)',
                boxShadow:'0 32px 64px rgba(0,0,0,0.5)',
              }}>
              {/* Header */}
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
                <div style={{width:44,height:44,borderRadius:12,background:investSheet.bg,color:investSheet.fg,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12,fontFamily:'Inter,system-ui,sans-serif',flexShrink:0}}>
                  {investSheet.ticker.length>4?investSheet.ticker.slice(0,4):investSheet.ticker}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:600,color:'#fff',letterSpacing:-0.2,fontFamily:'Inter,system-ui,sans-serif',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{investSheet.name}</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginTop:2,fontFamily:'Inter,system-ui,sans-serif'}}>{investSheet.type} · {investSheet.ticker}</div>
                </div>
                <button className="phone-btn" onClick={()=>setInvestSheet(null)}
                  style={{all:'unset',cursor:'pointer',width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Ph icon="x" size={10} color="rgba(255,255,255,0.5)"/>
                </button>
              </div>

              {/* Divider */}
              <div style={{height:'0.5px',background:'rgba(255,255,255,0.07)',marginBottom:20}}/>

              {/* Fields */}
              <div style={{display:'flex',gap:10,marginBottom:8}}>
                <div style={{width:'calc(50% - 5px)'}}>
                  <div style={{fontSize:11,fontWeight:500,color:'rgba(255,255,255,0.4)',letterSpacing:0.8,textTransform:'uppercase',marginBottom:8,fontFamily:'Inter,system-ui,sans-serif'}}>Shares held</div>
                  <div style={{height:48,borderRadius:12,background:'rgba(255,255,255,0.05)',border:'0.5px solid rgba(255,255,255,0.18)',display:'flex',alignItems:'center',padding:'0 14px'}}>
                    <input className="phone-input" type="number" inputMode="decimal" value={sharesHeld} onChange={e=>setSharesHeld(e.target.value)}
                      placeholder="14.856432"
                      style={{all:'unset',width:'100%',fontSize:15,color:'#fff',fontFamily:'Inter,system-ui,sans-serif'}}/>
                  </div>
                </div>
                <div style={{width:'calc(50% - 5px)'}}>
                  <div style={{fontSize:11,fontWeight:500,color:'rgba(255,255,255,0.4)',letterSpacing:0.8,textTransform:'uppercase',marginBottom:8,fontFamily:'Inter,system-ui,sans-serif'}}>Total value</div>
                  <div style={{height:48,borderRadius:12,background:'rgba(255,255,255,0.05)',border:'0.5px solid rgba(255,255,255,0.18)',display:'flex',alignItems:'center',padding:'0 14px',gap:4}}>
                    <span style={{fontSize:15,color:'rgba(255,255,255,0.45)',fontFamily:'Inter,system-ui,sans-serif'}}>£</span>
                    <input className="phone-input" type="number" inputMode="decimal" value={currentValue} onChange={e=>setCurrentValue(e.target.value)}
                      placeholder="1,240.50"
                      style={{all:'unset',flex:1,fontSize:15,color:'#fff',fontFamily:'Inter,system-ui,sans-serif'}}/>
                  </div>
                </div>
              </div>

              {/* Implied price + accuracy nudge */}
              {sharesHeld&&currentValue&&parseFloat(sharesHeld)>0?(
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                  <p style={{margin:0,fontSize:12,color:'rgba(255,255,255,0.35)',fontFamily:'Inter,system-ui,sans-serif'}}>
                    Avg. price per share: <span style={{color:'rgba(255,255,255,0.55)'}}>£{(parseFloat(currentValue)/parseFloat(sharesHeld)).toFixed(2)}</span>
                  </p>
                </div>
              ):null}

              {/* Accuracy nudge */}
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:14,padding:'8px 12px',borderRadius:10,background:'rgba(255,255,255,0.03)'}}>
                <Ph icon="arrowBendUpRight" size={14} color="#fff" style={{flexShrink:0,transform:'rotate(90deg) scaleX(-1) scaleY(-1)'}}/>
                <p style={{margin:0,fontSize:12,color:'rgba(255,255,255,0.35)',fontFamily:'Inter,system-ui,sans-serif',lineHeight:1.4}}>
                  The more accurate you can be, the better.
                </p>
              </div>

              {/* Where do I find this — centred */}
              <div style={{textAlign:'center',marginBottom:14}}>
                <button className="phone-btn" onClick={()=>setShowShareHelp(h=>!h)}
                  style={{all:'unset',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:999,border:'0.5px solid rgba(37,99,235,0.3)',color:'#2563EB',fontSize:12,fontWeight:500,fontFamily:'Inter,system-ui,sans-serif'}}>
                  Where do I find this?
                  <Ph icon="caretDown" size={11} color="#2563EB" style={{transform:showShareHelp?'rotate(180deg)':"rotate(0deg)",transition:"transform 240ms"}}/>
                </button>
              </div>
              <div style={{overflow:'hidden',maxHeight:showShareHelp?'300px':'0',transition:'max-height 360ms cubic-bezier(0.4,0,0.2,1)',marginBottom:showShareHelp?14:0}}>
                <div style={{borderRadius:12,background:'rgba(255,255,255,0.04)',padding:'14px',display:'flex',flexDirection:'column',gap:10}}>
                  <p style={{margin:0,fontSize:13,color:'rgba(255,255,255,0.5)',fontFamily:'Inter,system-ui,sans-serif',lineHeight:1.5}}>
                    You'll find this in your investment app within each investment. It may be listed as <span style={{color:'rgba(255,255,255,0.8)'}}>"Value of holding"</span> and <span style={{color:'rgba(255,255,255,0.8)'}}>"Shares/Units"</span>.
                  </p>
                  {/* Illustrated screenshot */}
                  <div style={{borderRadius:10,background:'#fff',padding:'14px 16px',display:'flex',flexDirection:'column',gap:14}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      {/* Value of holding highlighted */}
                      <div style={{position:'relative'}}>
                        <div style={{position:'absolute',inset:-4,borderRadius:6,border:'2px solid #2563EB',pointerEvents:'none'}}/>
                        <div style={{fontSize:16,fontWeight:700,color:'#111',fontFamily:'Inter,system-ui,sans-serif'}}>£64,972.41</div>
                        <div style={{fontSize:11,color:'#888',fontFamily:'Inter,system-ui,sans-serif',marginTop:2}}>Value of holding</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:15,fontWeight:600,color:'#22c55e',fontFamily:'Inter,system-ui,sans-serif'}}>+42.15%</div>
                        <div style={{fontSize:11,color:'#888',fontFamily:'Inter,system-ui,sans-serif',marginTop:2}}>Total return</div>
                      </div>
                    </div>
                    <div style={{height:'0.5px',background:'#eee'}}/>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      {/* Shares highlighted */}
                      <div style={{position:'relative'}}>
                        <div style={{position:'absolute',inset:-4,borderRadius:6,border:'2px solid #2563EB',pointerEvents:'none'}}/>
                        <div style={{fontSize:16,fontWeight:700,color:'#111',fontFamily:'Inter,system-ui,sans-serif'}}>583.864284</div>
                        <div style={{fontSize:11,color:'#888',fontFamily:'Inter,system-ui,sans-serif',marginTop:2}}>Shares</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:16,fontWeight:700,color:'#111',fontFamily:'Inter,system-ui,sans-serif'}}>£83.49</div>
                        <div style={{fontSize:11,color:'#888',fontFamily:'Inter,system-ui,sans-serif',marginTop:2}}>Avg. purchase price</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add button */}
              <button className="phone-btn"
                onClick={()=>{
                  if(!currentValue) return;
                  setAddedInvestments(prev=>[...prev.filter(a=>a.id!==investSheet.id),{...investSheet,shares:sharesHeld,value:currentValue}]);
                  setInvestSheet(null);
                  setInvestQuery('');
                  setInvestSearchFocused(false);
                }}
                style={{all:'unset',boxSizing:'border-box',width:'100%',height:52,borderRadius:999,
                  background:currentValue?'#fff':'rgba(255,255,255,0.08)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:15,fontWeight:600,letterSpacing:-0.2,
                  color:currentValue?'#09090B':'rgba(255,255,255,0.25)',
                  cursor:currentValue?'pointer':'default',
                  transition:'background 220ms,color 220ms',
                  fontFamily:'Inter,system-ui,sans-serif',
                }}>
                Add investment
              </button>
            </div>
          )}
        </div>

        {/* ── Investment request sheet backdrop ── */}
        <div onClick={()=>setShowInvestRequest(false)} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)',zIndex:85,
          opacity:showInvestRequest?1:0,pointerEvents:showInvestRequest?'auto':'none',transition:'opacity 300ms',
        }}/>
        {/* ── Investment request sheet ── */}
        <div style={{position:'absolute',left:0,right:0,bottom:0,zIndex:86,
          transform:showInvestRequest?'translateY(0)':'translateY(100%)',
          transition:'transform 420ms cubic-bezier(0.32,0.72,0,1)',willChange:'transform',
        }}>
          <div style={{background:'#09090B',borderRadius:'28px 28px 0 0',padding:'12px 24px 48px',border:'0.5px solid rgba(255,255,255,0.18)',borderBottom:'none'}}>
            <div style={{width:36,height:4,borderRadius:2,background:'rgba(255,255,255,0.2)',margin:'0 auto 28px'}}/>
            {investRequestSent?(
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14,padding:'16px 0 24px'}}>
                <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(37,99,235,0.15)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13L9 17L19 7" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                      style={{strokeDasharray:28,strokeDashoffset:0,transition:'stroke-dashoffset 400ms cubic-bezier(0.65,0,0.35,1)'}}/>
                  </svg>
                </div>
                <div style={{fontSize:17,fontWeight:600,color:'#fff',fontFamily:'Inter,system-ui,sans-serif'}}>Thanks, we'll look into it</div>
              </div>
            ):(
              <>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:19,fontWeight:700,color:'#fff',letterSpacing:-0.3,marginBottom:6,fontFamily:'Inter,system-ui,sans-serif'}}>Request an investment</div>
                  <div style={{fontSize:14,color:'rgba(255,255,255,0.45)',lineHeight:1.5,fontFamily:'Inter,system-ui,sans-serif'}}>Missing an investment? Let us know and we'll look into it!</div>
                </div>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.4)',letterSpacing:0.3,textTransform:'uppercase',marginBottom:8,fontFamily:'Inter,system-ui,sans-serif'}}>Investment name or ticker</div>
                  <div style={{borderRadius:12,background:'rgba(255,255,255,0.05)',border:'0.5px solid rgba(255,255,255,0.18)',padding:'0 16px',height:50,display:'flex',alignItems:'center'}}>
                    <input className="phone-input" value={investRequestName} onChange={e=>setInvestRequestName(e.target.value)}
                      placeholder="e.g. VWRP or Vanguard All-World"
                      style={{all:'unset',flex:1,fontSize:15,color:'#fff',fontFamily:'Inter,system-ui,sans-serif',letterSpacing:-0.1}}/>
                    {investRequestName&&(
                      <button className="phone-btn" onClick={()=>setInvestRequestName('')} style={{all:'unset',cursor:'pointer',width:20,height:20,borderRadius:'50%',background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,lineHeight:0}}>
                        <Ph icon="x" size={8} color="#fff" style={{display:"block"}}/>
                      </button>
                    )}
                  </div>
                </div>
                <button className="phone-btn" onClick={()=>{ if(!investRequestName.trim()) return; setInvestRequestSent(true); setTimeout(()=>setShowInvestRequest(false),3000); }}
                  style={{all:'unset',boxSizing:'border-box',width:'100%',height:52,borderRadius:999,
                    background:investRequestName.trim()?'#fff':'rgba(255,255,255,0.08)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:16,fontWeight:600,letterSpacing:-0.2,
                    color:investRequestName.trim()?'#09090B':'rgba(255,255,255,0.25)',
                    cursor:investRequestName.trim()?'pointer':'default',
                    transition:'background 220ms,color 220ms',
                    fontFamily:'Inter,system-ui,sans-serif',
                  }}>
                  Send request
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Sheet backdrop ── */}
        <div onClick={()=>setShowSheet(false)} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)',zIndex:70,
          opacity:showSheet?1:0,pointerEvents:showSheet?'auto':'none',transition:'opacity 300ms',
        }}/>

        {/* ── Request sheet ── */}
        <div style={{position:'absolute',left:0,right:0,bottom:0,zIndex:80,
          transform:showSheet?'translateY(0)':'translateY(100%)',
          transition:'transform 420ms cubic-bezier(0.32,0.72,0,1)',willChange:'transform',
        }}>
          <div style={{background:'#111114',borderRadius:'28px 28px 0 0',padding:'12px 24px 48px',border:'0.5px solid rgba(255,255,255,0.18)',borderBottom:'none'}}>
            <div style={{width:36,height:4,borderRadius:2,background:'rgba(255,255,255,0.2)',margin:'0 auto 28px'}}/>
            {sent?(
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14,padding:'16px 0 24px'}}>
                <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(37,99,235,0.15)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13L9 17L19 7" stroke="#2563EB" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                      style={{strokeDasharray:28,strokeDashoffset:0,transition:'stroke-dashoffset 400ms cubic-bezier(0.65,0,0.35,1)'}}/>
                  </svg>
                </div>
                <div style={{fontSize:17,fontWeight:600,color:'#fff'}}>Thanks, we'll look into it</div>
              </div>
            ):(
              <>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:19,fontWeight:700,color:'#fff',letterSpacing:-0.3,marginBottom:6}}>Request a platform</div>
                  <div style={{fontSize:14,color:'rgba(255,255,255,0.45)',lineHeight:1.5}}>Missing a platform? Let us know and we'll get it added to the list.</div>
                </div>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.4)',letterSpacing:0.3,textTransform:'uppercase',marginBottom:8}}>Platform name</div>
                  <div style={{borderRadius:12,background:'rgba(255,255,255,0.06)',border:'0.5px solid rgba(255,255,255,0.1)',padding:'0 16px',height:50,display:'flex',alignItems:'center'}}>
                    <input className="phone-input" value={sheetName} onChange={e=>setSheetName(e.target.value)}
                      placeholder="e.g. Dodl by AJ Bell"
                      style={{all:'unset',flex:1,fontSize:15,color:'#fff',fontFamily:'Inter,system-ui,sans-serif',letterSpacing:-0.1}}/>
                    {sheetName&&(
                      <button className="phone-btn" onClick={()=>setSheetName('')} style={{all:'unset',cursor:'pointer',width:20,height:20,borderRadius:'50%',background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,lineHeight:0}}>
                        <Ph icon="x" size={8} color="#fff" style={{display:"block"}}/>
                      </button>
                    )}
                  </div>
                </div>
                <button className="phone-btn" onClick={handleSend}
                  style={{all:'unset',boxSizing:'border-box',width:'100%',height:52,borderRadius:999,
                    background:sheetName.trim()?'#fff':'rgba(255,255,255,0.08)',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:16,fontWeight:600,letterSpacing:-0.2,
                    color:sheetName.trim()?'#09090B':'rgba(255,255,255,0.25)',
                    cursor:sheetName.trim()?'pointer':'default',
                    transition:'background 220ms,color 220ms',
                  }}>
                  Send request
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Help modal ── */}
        <div onClick={()=>setShowHelpModal(false)}
          style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',zIndex:90,
            opacity:showHelpModal?1:0,pointerEvents:showHelpModal?'auto':'none',
            transition:'opacity 280ms ease',display:'flex',alignItems:'center',justifyContent:'center',padding:'0 20px',
          }}>
          <div onClick={e=>e.stopPropagation()}
            style={{width:'100%',background:'#09090B',borderRadius:24,padding:'20px',
              border:'0.5px solid rgba(255,255,255,0.18)',
              transform:showHelpModal?'scale(1) translateY(0)':'scale(0.94) translateY(16px)',
              transition:'transform 320ms cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow:'0 32px 64px rgba(0,0,0,0.5)',
            }}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <div style={{fontSize:17,fontWeight:600,color:'#fff',letterSpacing:-0.2,fontFamily:'Inter,system-ui,sans-serif'}}>Help & Support</div>
              <button className="phone-btn" onClick={()=>setShowHelpModal(false)}
                style={{all:'unset',cursor:'pointer',width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Ph icon="x" size={10} color="rgba(255,255,255,0.5)"/>
              </button>
            </div>
            <div style={{height:'0.5px',background:'rgba(255,255,255,0.07)',marginBottom:16}}/>
            <div style={{fontSize:14,color:'rgba(255,255,255,0.4)',lineHeight:1.6,fontFamily:'Inter,system-ui,sans-serif',textAlign:'center',padding:'16px 0'}}>
              Support coming soon.
            </div>
          </div>
        </div>

      </div>
  );
}
