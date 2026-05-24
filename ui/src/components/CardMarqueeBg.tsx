import { useState, useEffect } from 'react'

/* ── shared micro-styles ───────────────────────────────────── */
const B:    React.CSSProperties = { borderRadius:16, backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', cursor:'default' }
const CAP:  React.CSSProperties = { fontSize:11.5, color:'rgba(241,245,249,0.88)', lineHeight:1.55 }
const TAGS: React.CSSProperties = { fontSize:9.5, color:'rgba(167,139,250,0.7)', fontWeight:700 }
const GCTA: React.CSSProperties = { flex:1, background:'linear-gradient(90deg,rgba(124,58,237,0.92),rgba(6,182,212,0.88))', borderRadius:20, padding:'5px 0', textAlign:'center' as const, fontSize:9.5, fontWeight:700, color:'#fff', border:'1px solid rgba(255,255,255,0.18)' }
const TW_I = <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
const YT_I = <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#1a0505"/></svg>

/* ── micro-components ─────────────────────────────────────── */
function Live() {
  return <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:'#10B981', fontWeight:800 }}><span style={{ width:5, height:5, borderRadius:'50%', background:'#10B981', display:'inline-block' }} />LIVE</span>
}
function IGAv({ size=32 }: { size?: number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', padding:2, background:'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)', flexShrink:0 }}>
      <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#1a0a2e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.round(size*0.38), fontWeight:900, color:'#f472b6' }}>H</div>
    </div>
  )
}
function IGHdr({ label='Instagram' }: { label?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
      <IGAv />
      <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:800, color:'#f1f5f9' }}>housing.com</div><div style={{ fontSize:9.5, color:'#64748b' }}>{label}</div></div>
      <Live />
    </div>
  )
}
function IGMed({ gradient, body, cta, children }: { gradient:string; body?:string; cta?:string; children:React.ReactNode }) {
  return (
    <div style={{ aspectRatio:'1/1', borderRadius:10, background:gradient, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column' }}>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,rgba(0,0,0,0.06) 0%,rgba(0,0,0,0.56) 100%)' }} />
      <div style={{ height:26, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative', zIndex:2 }}>
        <span style={{ fontSize:7.5, letterSpacing:'.22em', fontWeight:700, color:'rgba(196,181,253,0.92)', textTransform:'uppercase' }}>HOUSING.COM</span>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1, padding:'0 12px' }}>
        <div style={{ fontSize:17, fontWeight:900, color:'#fff', lineHeight:1.28, textAlign:'center' }}>{children}</div>
        {body && <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.68)', fontWeight:400, marginTop:9, lineHeight:1.45, textAlign:'center' }}>{body}</div>}
      </div>
      <div style={{ height:34, display:'flex', alignItems:'center', padding:'0 10px', position:'relative', zIndex:2, flexShrink:0 }}>
        {cta ? <div style={GCTA}>{cta}</div> : <div style={{ flex:1, textAlign:'right', fontSize:7.5, color:'rgba(255,255,255,0.28)', fontWeight:600 }}>housing.com</div>}
      </div>
    </div>
  )
}
function Dots({ n, a, c }: { n:number; a:number; c:string }) {
  return (
    <div style={{ display:'flex', gap:5, justifyContent:'center', marginTop:7 }}>
      {Array.from({length:n}).map((_,i) => <div key={i} style={{ width:i===a?14:5, height:5, borderRadius:i===a?3:10, background:i===a?c:'rgba(255,255,255,0.2)', transition:'all 0.35s' }} />)}
    </div>
  )
}
function TWBase({ handle, tags, children }: { handle:string; tags:string; children:React.ReactNode }) {
  return (
    <div style={{ ...B, width:200, padding:'13px 14px', background:'rgba(7,7,30,0.9)', border:'1px solid rgba(96,165,250,0.2)', boxShadow:'0 6px 24px rgba(96,165,250,0.1)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(96,165,250,0.12)', border:'1px solid rgba(96,165,250,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#60a5fa' }}>{TW_I}</div>
        <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:800, color:'#f1f5f9' }}>Housing.com</div><div style={{ fontSize:9.5, color:'#475569' }}>{handle}</div></div>
        <Live />
      </div>
      <div style={{ ...CAP, fontSize:12, marginBottom:8 }}>{children}</div>
      <div style={TAGS}>{tags}</div>
    </div>
  )
}

/* ── card components (16 unique) ─────────────────────────── */
function IG1() {
  return (
    <div style={{ ...B, width:205, padding:'12px 12px 11px', background:'linear-gradient(#07071a,#07071a) padding-box, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045) border-box', border:'1px solid transparent', boxShadow:'0 8px 32px rgba(244,114,182,0.22)' }}>
      <IGHdr /><IGMed gradient="linear-gradient(135deg,#1a0a2e,#7c3aed,#db2777)" body="Lekin ghar zaroor diya. This Father's Day." cta="Find your home →">Papa ne kabhi<br/>'I love you'<br/>nahi bola 🏠</IGMed>
      <div style={{ ...TAGS, marginTop:8 }}>#FathersDay #HousingDotCom</div>
    </div>
  )
}
function IG2() {
  return (
    <div style={{ ...B, width:205, padding:'12px 12px 11px', background:'linear-gradient(#07071a,#07071a) padding-box, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045) border-box', border:'1px solid transparent', boxShadow:'0 8px 32px rgba(244,114,182,0.18)' }}>
      <IGHdr /><IGMed gradient="linear-gradient(135deg,#0c0a1e,#5b21b6,#7c3aed)" body="Kirayedaar ki balcony nahi. Apni shaam, apna ghar." cta="Explore homes →">Apni chai.<br/>Apni balcony.<br/>Apna ghar ☕</IGMed>
      <div style={{ ...TAGS, marginTop:8 }}>#InternationalTeaDay #HousingDotCom</div>
    </div>
  )
}
function IG3() {
  return (
    <div style={{ ...B, width:205, padding:'12px 12px 11px', background:'linear-gradient(#07071a,#07071a) padding-box, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045) border-box', border:'1px solid transparent', boxShadow:'0 8px 32px rgba(99,102,241,0.22)' }}>
      <IGHdr /><IGMed gradient="linear-gradient(135deg,#0c1838,#1d4ed8,#7c3aed)" body="Wahi ₹15L = down payment for your own home." cta="housing.com/emi →">5 saal ka<br/>rent = ₹15L.<br/>Gone. 🤯</IGMed>
      <div style={{ ...TAGS, marginTop:8 }}>#RentVsBuy #HomeLoan #HousingDotCom</div>
    </div>
  )
}
function IG4() {
  return (
    <div style={{ ...B, width:205, padding:'12px 12px 11px', background:'linear-gradient(#07071a,#07071a) padding-box, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045) border-box', border:'1px solid transparent', boxShadow:'0 8px 32px rgba(34,197,94,0.18)' }}>
      <IGHdr /><IGMed gradient="linear-gradient(135deg,#0f1f0a,#15803d,#16a34a)" body="Every champion needs a home base. Find yours on housing.com." cta="housing.com/search →">Kohli's ground:<br/>Chinnaswamy.<br/>Tera? 🏏</IGMed>
      <div style={{ ...TAGS, marginTop:8 }}>#IPL2026 #ViratKohli #HousingDotCom</div>
    </div>
  )
}

const STORY_SL = [
  { g:'linear-gradient(160deg,#7c2d12,#dc2626)', head:'48°C mein\nbhago mat 🥵', body:'Broker ke peeche daudna band karo', cta:'Ghar pe khojo →' },
  { g:'linear-gradient(160deg,#1e3a5f,#0891b2)', head:'AC on karo\n🧊 aur socho', body:'5km ke andar smart listings', cta:'Housing.com kholo →' },
  { g:'linear-gradient(160deg,#4c1d95,#7c3aed)', head:'Zero broker\ndrama 🏠', body:'Real prices. Verified listings.', cta:'Search now →' },
  { g:'linear-gradient(160deg,#064e3b,#059669)', head:'EMI from\n₹8,999/mo 🏡', body:'Home loans made simple', cta:'Check eligibility →' },
  { g:'linear-gradient(160deg,#1e1b4b,#6d28d9)', head:'Apna ghar\napni shaam ☕', body:'Stay cool. Buy smart. #BandaHeatwave', cta:'Explore now →' },
]
function Story() {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(s => (s+1) % STORY_SL.length), 2400); return () => clearInterval(t) }, [])
  const s = STORY_SL[i]
  return (
    <div style={{ ...B, width:190, padding:'10px 10px 11px', background:'rgba(7,7,26,0.92)', border:'1px solid rgba(244,114,182,0.28)', boxShadow:'0 8px 32px rgba(244,114,182,0.18)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7 }}><IGAv size={26} /><div style={{ fontSize:10.5, fontWeight:800, color:'#f1f5f9', flex:1 }}>housing.com</div><Live /></div>
      <div style={{ borderRadius:10, background:s.g, height:282, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', marginBottom:8 }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.56))' }} />
        <div style={{ height:26, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative', zIndex:2 }}><span style={{ fontSize:7.5, letterSpacing:'.2em', fontWeight:700, color:'rgba(196,181,253,0.88)', textTransform:'uppercase' }}>HOUSING.COM</span></div>
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1, padding:'0 12px' }}>
          <div style={{ fontSize:18, fontWeight:900, color:'#fff', lineHeight:1.28, textAlign:'center', whiteSpace:'pre-line' }}>{s.head}</div>
          <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.68)', fontWeight:400, marginTop:9, lineHeight:1.45, textAlign:'center' }}>{s.body}</div>
        </div>
        <div style={{ height:36, display:'flex', alignItems:'center', padding:'0 10px', flexShrink:0, position:'relative', zIndex:2 }}><div style={GCTA}>{s.cta}</div></div>
      </div>
      <div style={{ fontSize:9.5, color:'rgba(167,139,250,0.7)', textAlign:'center', fontWeight:700 }}>#BandaHeatwave #HousingDotCom</div>
    </div>
  )
}

const YT_SC = [
  { label:'HOOK', g:'linear-gradient(160deg,#1a0505,#7f1d1d)', head:'Telangana RERA\nfined 5 devs', body:'🔥 ₹15.2 lakh fine each' },
  { label:'BODY', g:'linear-gradient(160deg,#0f0505,#b91c1c)', head:'Suvarnabhoomi\nInfra exposed', body:'Buyers delayed 3+ years 😤' },
  { label:'CTA',  g:'linear-gradient(160deg,#1a0505,#991b1b)', head:'Check RERA\nbefore you buy', body:'Verify before you invest 👉' },
]
function YT() {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(s => (s+1) % YT_SC.length), 2600); return () => clearInterval(t) }, [])
  const sc = YT_SC[i]
  return (
    <div style={{ ...B, width:190, padding:'10px 10px 11px', background:'rgba(12,5,5,0.92)', border:'1px solid rgba(248,113,113,0.25)', boxShadow:'0 8px 32px rgba(248,113,113,0.18)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:9 }}><div style={{ width:28, height:28, borderRadius:6, background:'#ff0000', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{YT_I}</div><div style={{ fontSize:10.5, fontWeight:800, color:'#f87171', flex:1 }}>Shorts</div><Live /></div>
      <div style={{ borderRadius:10, background:sc.g, height:282, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', marginBottom:9 }}>
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.18)' }} />
        <div style={{ height:30, display:'flex', alignItems:'center', padding:'0 10px', flexShrink:0, position:'relative', zIndex:2 }}><span style={{ fontSize:7.5, fontWeight:900, color:'rgba(255,120,120,0.95)', letterSpacing:'.14em', textTransform:'uppercase', background:'rgba(0,0,0,0.5)', padding:'2px 8px', borderRadius:5 }}>{sc.label}</span></div>
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1, padding:'0 12px' }}>
          <div style={{ fontSize:17, fontWeight:900, color:'#fff', lineHeight:1.28, textAlign:'center', whiteSpace:'pre-line' }}>{sc.head}</div>
          <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.68)', fontWeight:400, marginTop:9, lineHeight:1.45, textAlign:'center' }}>{sc.body}</div>
        </div>
        <div style={{ height:40, display:'flex', alignItems:'center', padding:'0 10px', gap:8, flexShrink:0, position:'relative', zIndex:2 }}><div style={{ ...GCTA }}>housing.com/rera →</div></div>
      </div>
      <div style={{ fontSize:9.5, color:'rgba(167,139,250,0.7)', textAlign:'center', fontWeight:700 }}>#RERA #TelanganaPropTech</div>
    </div>
  )
}

function LI1() {
  return (
    <div style={{ ...B, width:222, padding:'13px 14px 13px', background:'rgba(5,10,28,0.92)', border:'1px solid rgba(147,197,253,0.22)', boxShadow:'0 8px 28px rgba(147,197,253,0.08)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:11 }}>
        <div style={{ width:38, height:38, borderRadius:8, background:'linear-gradient(135deg,#1e3a5f,#0a66c2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><span style={{ fontSize:16, fontWeight:900, color:'#fff' }}>H</span></div>
        <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:800, color:'#f1f5f9', lineHeight:1.2 }}>Housing.com</div><div style={{ fontSize:9.5, color:'#64748b' }}>PropTech · 500K+ followers</div></div>
        <Live />
      </div>
      <div style={{ ...CAP, fontSize:11.5 }}>#ITLayoffs handed 50,000+ pink slips this year.<br/><br/>Real estate handed out ₹5.68L Cr in sales.<br/><br/>The asset class doesn't bench people. It builds them.<br/><br/>👉 housing.com/listings</div>
      <div style={{ ...TAGS, marginTop:9 }}>#ITLayoffs #RealEstate #PropTech</div>
    </div>
  )
}
function LI2() {
  return (
    <div style={{ ...B, width:222, padding:'13px 14px 13px', background:'rgba(5,10,28,0.92)', border:'1px solid rgba(147,197,253,0.22)', boxShadow:'0 8px 28px rgba(147,197,253,0.08)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:11 }}>
        <div style={{ width:38, height:38, borderRadius:8, background:'linear-gradient(135deg,#1e3a5f,#0a66c2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><span style={{ fontSize:16, fontWeight:900, color:'#fff' }}>H</span></div>
        <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:800, color:'#f1f5f9', lineHeight:1.2 }}>Housing.com</div><div style={{ fontSize:9.5, color:'#64748b' }}>PropTech · 500K+ followers</div></div>
        <Live />
      </div>
      <div style={{ ...CAP, fontSize:11.5 }}>Landlord ne rent 20% badhaya. 😣<br/><br/>Maine housing.com pe ek 2BHK dhundha.<br/>EMI: ₹9,200/mo. Purana rent: ₹14,000/mo.<br/><br/>Plot twist: I'm paying less to OWN.<br/><br/>👉 housing.com/home-loan</div>
      <div style={{ ...TAGS, marginTop:9 }}>#HomeLoan #RentVsBuy #FirstHome</div>
    </div>
  )
}

const CAR_SL = [
  { g:'linear-gradient(135deg,#1f2937,#92400e)', l1:'Rasgulla vs', l2:'Idli? 🍡', body:'Asli debate toh alag hai...' },
  { g:'linear-gradient(135deg,#1e3a5f,#3b82f6)', l1:'Delhi 2BHK vs', l2:'Hyderabad Villa?', body:'₹95L vs ₹1.2Cr — you decide' },
  { g:'linear-gradient(135deg,#064e3b,#10b981)', l1:'Delhi:', l2:'₹95L 2BHK Noida 🏙️', body:'3BHK Dwarka: ₹1.4Cr' },
  { g:'linear-gradient(135deg,#0d3d30,#0f766e)', l1:'Hyderabad:', l2:'₹1.2Cr Villa 🏡', body:'Gachibowli, ready to move' },
  { g:'linear-gradient(135deg,#2d1b69,#7c3aed)', l1:'Tu kis', l2:'side hai? 🗳️', body:'Comment karo 👇' },
]
function Car() {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(s => (s+1) % CAR_SL.length), 2000); return () => clearInterval(t) }, [])
  const cs = CAR_SL[i]
  return (
    <div style={{ ...B, width:205, padding:'12px 12px 11px', background:'linear-gradient(#07071a,#07071a) padding-box, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045) border-box', border:'1px solid transparent', boxShadow:'0 8px 32px rgba(244,114,182,0.16)' }}>
      <IGHdr label="Carousel · Swipe →" />
      <div key={i}>
        <IGMed gradient={cs.g} body={cs.body}>{cs.l1}<br/>{cs.l2}</IGMed>
      </div>
      <div style={{ ...CAP, marginTop:8, fontSize:10.5 }}>Rasgulla vs Idli chhodo 🍡 asli debate: Delhi 2BHK ya Hyderabad villa?</div>
      <Dots n={5} a={i} c="#f472b6" />
    </div>
  )
}

function TW1() { return <TWBase handle="@HousingDotCom" tags="#ITLayoffs #TechLayoffs">HR ne meeting bulayi 😨<br/>Ghar ne kabhi nahi bulayi 🏠<br/><br/>Job switch hoti rahegi. Ghar nahi jaata.<br/><br/>housing.com/search</TWBase> }
function TW2() { return <TWBase handle="@HousingDotCom" tags="#SRHvsRCB #IPL2026">SRH ne @RCBTweets ko ghar pe haraya 🔥<br/><br/>Match haar sakte ho, ghar nahi 🏠<br/><br/>Hyderabad ya Bengaluru — apna ghar dhoondho.<br/>housing.com/search</TWBase> }
function TW3() { return <TWBase handle="@HousingDotCom" tags="#DhurandharOnJiohotstar">Plot twist dekhne mein dhurandhar ho? 🎭<br/><br/>Ghar dhundhne mein bhi bano — smart filters,<br/>real prices, zero broker drama.<br/><br/>housing.com/search</TWBase> }
function TW4() { return <TWBase handle="@HousingDotCom" tags="#InternationalTeaDay #HousingDotCom">International Tea Day ☕<br/><br/>Chai piyo kisi bhi balcony pe.<br/>Bas apni balcony honi chahiye.<br/><br/>housing.com/search 🏠</TWBase> }
function TW5() { return <TWBase handle="@HousingDotCom" tags="#Swiggy #GharKhojo">@Swiggy delivers in 10 mins 🍕<br/>Housing.com: 0 sec property search 🏠<br/><br/>Ek pe ₹5 delivery fee. Doosra bilkul FREE.<br/><br/>Sochna kya hai? housing.com/search</TWBase> }
function TW6() { return <TWBase handle="@HousingDotCom" tags="#ZomatoIN #RealEstate">.@ZomatoIN review: "Pizza thanda tha ⭐"<br/><br/>Housing.com review: "Verified listing,<br/>moved in 2 weeks ⭐⭐⭐⭐⭐"<br/><br/>housing.com — India's most trusted property platform 🏠</TWBase> }
function TW7() { return <TWBase handle="@HousingDotCom" tags="#Blinkit #HousingDotCom">@blinkit ne anda deliver kiya 🥚<br/>Lekin mujhe ghar chahiye 🏠<br/><br/>10 seconds mein — 1 lakh+ listings.<br/>Zero broker. Zero drama.<br/><br/>housing.com/search</TWBase> }

/* ── 8 column pairs (16 unique cards) ─────────────────────── */
const COLS: Array<[() => JSX.Element, () => JSX.Element]> = [
  [() => <IG1 />,   () => <LI1 />],
  [() => <TW1 />,   () => <Car />],
  [() => <IG2 />,   () => <TW4 />],
  [() => <Story />, () => <TW2 />],
  [() => <YT />,    () => <TW3 />],
  [() => <TW5 />,   () => <IG3 />],
  [() => <TW6 />,   () => <LI2 />],
  [() => <IG4 />,   () => <TW7 />],
]

/* ── Brownian motion configs per column (cycles through 8) ── */
const BM: Array<{ anim:string; dur:number; delay:number }> = [
  { anim:'cmb-bm1', dur:12, delay:-3  },
  { anim:'cmb-bm2', dur:14, delay:-7  },
  { anim:'cmb-bm3', dur:11, delay:-6  },
  { anim:'cmb-bm4', dur:13, delay:-9  },
  { anim:'cmb-bm5', dur:15, delay:-4  },
  { anim:'cmb-bm1', dur:15, delay:-5  },
  { anim:'cmb-bm2', dur:12, delay:-2  },
  { anim:'cmb-bm3', dur:13, delay:-4  },
]
const BM2: Array<{ anim:string; dur:number; delay:number }> = [
  { anim:'cmb-bm4', dur:15, delay:-5  },
  { anim:'cmb-bm5', dur:12, delay:-2  },
  { anim:'cmb-bm1', dur:13, delay:-8  },
  { anim:'cmb-bm2', dur:10, delay:-1  },
  { anim:'cmb-bm3', dur:16, delay:-6  },
  { anim:'cmb-bm4', dur:14, delay:-3  },
  { anim:'cmb-bm5', dur:11, delay:-7  },
  { anim:'cmb-bm1', dur:13, delay:-4  },
]

/* ── CSS (namespaced to avoid conflicts) ──────────────────── */
const CSS = `
@keyframes cmb-slide{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes cmb-bm1{0%,100%{transform:translate(0,0)}25%{transform:translate(8px,-14px)}50%{transform:translate(-6px,10px)}75%{transform:translate(12px,6px)}}
@keyframes cmb-bm2{0%,100%{transform:translate(0,0)}30%{transform:translate(-10px,-8px)}60%{transform:translate(6px,16px)}80%{transform:translate(-8px,-4px)}}
@keyframes cmb-bm3{0%,100%{transform:translate(0,0)}20%{transform:translate(14px,6px)}55%{transform:translate(-8px,-12px)}85%{transform:translate(4px,10px)}}
@keyframes cmb-bm4{0%,100%{transform:translate(0,0)}35%{transform:translate(-12px,10px)}65%{transform:translate(8px,-8px)}90%{transform:translate(-4px,14px)}}
@keyframes cmb-bm5{0%,100%{transform:translate(0,0)}40%{transform:translate(10px,-16px)}70%{transform:translate(-14px,8px)}95%{transform:translate(6px,-6px)}}
.cmb-track{display:flex;flex-wrap:nowrap;align-items:flex-start;animation:cmb-slide 60s linear infinite;padding:28px 0}
.cmb-col{display:flex;flex-direction:column;gap:14px;flex-shrink:0;margin-right:14px}
.cmb-overlay{position:absolute;inset:0;background:radial-gradient(ellipse 46% 60% at 50% 46%,rgba(7,7,26,0.96) 0%,rgba(7,7,26,0.90) 25%,rgba(7,7,26,0.62) 48%,rgba(7,7,26,0.18) 68%,transparent 84%)}
@media(max-width:767px){
  .cmb-overlay{background:
    linear-gradient(to bottom,transparent 0%,transparent 76%,rgba(7,7,26,0.88) 88%,rgba(7,7,26,1) 100%),
    radial-gradient(ellipse 84% 46% at 50% 52%,rgba(7,7,26,0.96) 0%,rgba(7,7,26,0.88) 28%,rgba(7,7,26,0.55) 52%,rgba(7,7,26,0.10) 72%,transparent 86%)
  }
}
`

/* ── exported component ───────────────────────────────────── */
export function CardMarqueeBg({ cardOpacity = 0.38 }: { cardOpacity?: number }) {
  return (
    <div style={{ position:'absolute', inset:0, overflow:'hidden', zIndex:0, pointerEvents:'none' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Cards layer with per-card Brownian motion */}
      <div style={{ opacity:cardOpacity, height:'100%', display:'flex', alignItems:'center' }}>
        <div className="cmb-track">
          {[...COLS, ...COLS].map(([Top, Bot], i) => {
            const ci = i % 8
            const t = BM[ci],  b = BM2[ci]
            return (
              <div key={i} className="cmb-col">
                <div style={{ animation:`${t.anim} ${t.dur}s ${t.delay}s ease-in-out infinite` }}><Top /></div>
                <div style={{ animation:`${b.anim} ${b.dur}s ${b.delay}s ease-in-out infinite` }}><Bot /></div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Overlay: tight on desktop, wide on mobile to cover full text area */}
      <div className="cmb-overlay" />
    </div>
  )
}
