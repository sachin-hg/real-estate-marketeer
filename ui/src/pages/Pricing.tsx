import { Link } from 'react-router-dom'
import { useBrandName } from '../lib/useBrandName'
import { SEO } from '../components/SEO'

const PRICES = {
  spark:  { monthly: 39,  annual: 31,  annualTotal: 372  },
  growth: { monthly: 129, annual: 99,  annualTotal: 1188 },
  scale:  { monthly: 449, annual: 349, annualTotal: 4188 },
} as const

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.pricing-root{
  --bg:#07071a;--surf:rgba(255,255,255,.04);--bord:rgba(255,255,255,.09);
  --purple:#8B5CF6;--indigo:#6366F1;--cyan:#06B6D4;--green:#10B981;--amber:#F59E0B;
  --text:#f1f5f9;--muted:#64748b;--dim:#334155;
  --grad:linear-gradient(90deg,#C4B5FD 0%,#818CF8 38%,#38BDF8 72%,#67E8F9 100%);
  font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);
  min-height:100vh;overflow-x:hidden;
}
.pricing-root html{scroll-behavior:smooth}
.pricing-root .orb{position:fixed;border-radius:50%;pointer-events:none;z-index:0}
.pricing-root .orb-a{width:700px;height:700px;top:-250px;left:-150px;background:radial-gradient(circle,rgba(139,92,246,.14) 0%,transparent 70%);animation:pr-float-a 22s ease-in-out infinite}
.pricing-root .orb-b{width:600px;height:600px;top:40%;right:-160px;background:radial-gradient(circle,rgba(6,182,212,.1) 0%,transparent 70%);animation:pr-float-b 26s ease-in-out infinite}
.pricing-root .orb-c{width:500px;height:500px;bottom:10%;left:30%;background:radial-gradient(circle,rgba(99,102,241,.09) 0%,transparent 70%);animation:pr-float-c 20s ease-in-out infinite}
.pricing-root .dot-grid{position:fixed;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.045) 1px,transparent 1px);background-size:32px 32px;pointer-events:none;z-index:0}
@keyframes pr-float-a{0%,100%{transform:translate(0,0)}33%{transform:translate(50px,-60px)}66%{transform:translate(-40px,35px)}}
@keyframes pr-float-b{0%,100%{transform:translate(0,0)}40%{transform:translate(-45px,40px)}70%{transform:translate(30px,-40px)}}
@keyframes pr-float-c{0%,100%{transform:translate(0,0)}50%{transform:translate(25px,50px)}}
@keyframes pr-pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.5)}}
@keyframes pr-slide-up{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}
@keyframes pr-comp-in{from{opacity:0;transform:translateY(-14px) scale(.985);transform-origin:top}to{opacity:1;transform:translateY(0) scale(1)}}
.pricing-root .grad-text{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
/* NAV */
.pricing-root .pr-nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:14px 48px;border-bottom:1px solid rgba(255,255,255,.06);backdrop-filter:blur(16px);background:rgba(7,7,26,.75)}
.pricing-root .nav-left{display:flex;align-items:center;gap:20px}
.pricing-root .nav-logo{font-weight:900;font-size:32px;letter-spacing:-.03em;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-decoration:none}
.pricing-root .back-btn{display:flex;align-items:center;gap:6px;padding:7px 16px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:transparent;color:rgba(255,255,255,.6);font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;transition:all .2s}
.pricing-root .back-btn:hover{border-color:rgba(255,255,255,.28);color:rgba(255,255,255,.9);background:rgba(255,255,255,.04)}
.pricing-root .nav-cta{display:flex;align-items:center;gap:12px}
.pricing-root .nav-link{color:var(--muted);font-size:13px;font-weight:700;text-decoration:none;padding:9px 16px;border-radius:9px;transition:color .2s}
.pricing-root .nav-link:hover{color:var(--text)}
.pricing-root .nav-primary{background:linear-gradient(135deg,#8B5CF6,#6366F1);color:#fff !important;padding:9px 22px;border-radius:9px;font-size:13px;font-weight:700;text-decoration:none;box-shadow:0 4px 20px rgba(139,92,246,.3);transition:all .2s}
.pricing-root .nav-primary:hover{opacity:.9;transform:translateY(-1px)}
/* MAIN */
.pricing-root main{position:relative;z-index:1;padding-top:80px}
/* HERO */
.pricing-root .pricing-hero{text-align:center;padding:80px 24px 56px;max-width:800px;margin:0 auto}
.pricing-root .beta-pill{display:inline-flex;align-items:center;gap:7px;padding:5px 14px 5px 10px;border-radius:100px;background:rgba(139,92,246,.14);border:1px solid rgba(139,92,246,.32);font-size:11px;font-weight:700;color:#c4b5fd;letter-spacing:.06em;margin-bottom:28px}
.pricing-root .beta-dot{width:6px;height:6px;border-radius:50%;background:#a78bfa;animation:pr-pulse-dot 2s ease-in-out infinite;flex-shrink:0}
.pricing-root .hero-h1{font-size:clamp(36px,5vw,64px);font-weight:900;letter-spacing:-.035em;line-height:1.08;margin-bottom:18px;color:#fff}
.pricing-root .hero-sub{font-size:17px;color:var(--muted);line-height:1.65;max-width:560px;margin:0 auto}
/* MODE TABS */
.pricing-root .mode-tabs-wrap{display:flex;justify-content:center;margin:40px 0 0;position:relative;z-index:2}
.pricing-root .mode-tabs{display:inline-flex;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:4px;gap:4px}
.pricing-root .mode-tab{padding:10px 28px;border-radius:10px;border:none;background:transparent;color:var(--muted);font-family:'Inter',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .25s;letter-spacing:.01em}
.pricing-root .mode-tab.active{background:rgba(139,92,246,.2);border:1px solid rgba(139,92,246,.4);color:#c4b5fd}
/* BILLING TOGGLE */
.pricing-root .billing-toggle-wrap{display:flex;align-items:center;justify-content:center;gap:14px;margin:36px 0 0}
.pricing-root .toggle-label{font-size:14px;font-weight:600;color:var(--muted);transition:color .2s}
.pricing-root .toggle-label.active-lbl{color:var(--text)}
.pricing-root .toggle-switch{width:48px;height:26px;background:rgba(255,255,255,.12);border-radius:13px;cursor:pointer;position:relative;border:1px solid rgba(255,255,255,.14);transition:background .3s;flex-shrink:0}
.pricing-root .toggle-switch.annual{background:linear-gradient(135deg,rgba(139,92,246,.6),rgba(99,102,241,.6))}
.pricing-root .toggle-knob{width:20px;height:20px;background:#fff;border-radius:50%;position:absolute;top:2px;left:3px;transition:transform .3s cubic-bezier(.34,1.56,.64,1);box-shadow:0 1px 6px rgba(0,0,0,.4)}
.pricing-root .toggle-switch.annual .toggle-knob{transform:translateX(22px)}
.pricing-root .save-badge{background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);color:#34d399;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;letter-spacing:.04em}
/* SECTION */
.pricing-root .section{max-width:1300px;margin:0 auto;padding:0 32px}
.pricing-root #tab-subscription{padding-bottom:100px}
.pricing-root #tab-payg{padding-bottom:100px}
/* PLANS GRID */
.pricing-root .plans-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:52px;align-items:stretch}
/* PLAN CARD — flex column for CTA alignment */
.pricing-root .plan-card{border-radius:20px;padding:32px 28px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);backdrop-filter:blur(16px);position:relative;transition:transform .3s,box-shadow .3s,border-color .3s;display:flex;flex-direction:column}
.pricing-root .plan-card:hover{transform:translateY(-5px);box-shadow:0 20px 60px rgba(0,0,0,.4);border-color:rgba(255,255,255,.18)}
.pricing-root .plan-card.featured{background:rgba(139,92,246,.07);border:1px solid rgba(139,92,246,.35);box-shadow:0 0 40px rgba(139,92,246,.15),0 20px 60px rgba(0,0,0,.5);overflow:hidden}
.pricing-root .plan-card.featured::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--grad)}
.pricing-root .plan-card.featured:hover{transform:translateY(-8px);box-shadow:0 0 60px rgba(139,92,246,.25),0 30px 80px rgba(0,0,0,.55)}
.pricing-root .plan-tags{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:12px}
.pricing-root .plan-badge{display:inline-flex;align-items:center;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:.08em}
.pricing-root .plan-badge.popular{background:rgba(99,102,241,.18);border:1px solid rgba(99,102,241,.35);color:#a5b4fc}
.pricing-root .plan-badge.most-popular{background:linear-gradient(90deg,rgba(196,181,253,.18),rgba(103,232,249,.18));border:1px solid rgba(196,181,253,.4);color:#c4b5fd}
.pricing-root .plan-badge.enterprise{background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.3);color:#fbbf24}
.pricing-root .plan-name{font-size:24px;font-weight:900;letter-spacing:-.02em;color:#fff;margin-bottom:8px}
.pricing-root .plan-tier-tag{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:2px 9px;border-radius:10px;display:inline-flex;align-items:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.45)}
.pricing-root .plan-desc{font-size:13px;color:var(--muted);line-height:1.55;margin-bottom:20px;min-height:60px}
.pricing-root .plan-price-wrap{margin-bottom:8px}
.pricing-root .plan-price{display:flex;align-items:baseline;gap:4px}
.pricing-root .price-dollar{font-size:42px;font-weight:900;letter-spacing:-.04em;color:#fff;line-height:1;transition:all .3s}
.pricing-root .price-period{font-size:14px;color:var(--muted);font-weight:500}
.pricing-root .price-custom{font-size:28px;font-weight:900;color:#fff}
.pricing-root .annual-note{font-size:12px;color:var(--muted);margin-bottom:10px;min-height:18px;transition:opacity .3s}
.pricing-root .per-post-chip{font-size:11px;font-weight:700;padding:5px 13px;border-radius:20px;display:inline-flex;align-items:center;gap:5px;margin-bottom:18px;border:1px solid rgba(103,232,249,.22);background:rgba(103,232,249,.07);color:rgba(103,232,249,.85)}
.pricing-root .per-post-chip.grad{border-color:rgba(196,181,253,.3);background:rgba(196,181,253,.09);color:rgba(196,181,253,.95)}
.pricing-root .per-post-chip.hidden{visibility:hidden}
/* SPACER pushes CTA to same vertical position across all cards */
.pricing-root .plan-spacer{flex:1;min-height:0}
.pricing-root .plan-cta{display:inline-flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:13px 20px;border-radius:11px;border:none;font-family:'Inter',sans-serif;font-size:14px;font-weight:700;cursor:pointer;text-align:center;text-decoration:none;transition:all .25s;margin-top:20px}
.pricing-root .cta-outline{background:transparent;border:1px solid rgba(255,255,255,.18);color:var(--text)}
.pricing-root .cta-outline:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.32)}
.pricing-root .cta-gradient{background:linear-gradient(135deg,#8B5CF6,#6366F1);color:#fff;box-shadow:0 6px 24px rgba(139,92,246,.35)}
.pricing-root .cta-gradient:hover{opacity:.9;transform:translateY(-1px);box-shadow:0 10px 36px rgba(139,92,246,.5)}
.pricing-root .cta-amber{background:linear-gradient(135deg,#F59E0B,#D97706);color:#fff;box-shadow:0 6px 24px rgba(245,158,11,.3)}
.pricing-root .cta-amber:hover{opacity:.9;transform:translateY(-1px)}
.pricing-root .plan-divider{height:1px;background:rgba(255,255,255,.07);margin-bottom:24px}
.pricing-root .plan-features{list-style:none;display:flex;flex-direction:column;gap:10px}
.pricing-root .plan-features li{display:flex;align-items:flex-start;gap:9px;font-size:13px;color:rgba(241,245,249,.82);line-height:1.45}
.pricing-root .feat-check{width:16px;height:16px;border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;font-size:9px;font-weight:900}
.pricing-root .feat-check.yes{background:rgba(16,185,129,.15);color:#34d399;border:1px solid rgba(16,185,129,.25)}
.pricing-root .feat-check.grad{background:linear-gradient(135deg,rgba(196,181,253,.2),rgba(103,232,249,.2));border:1px solid rgba(196,181,253,.3);color:#c4b5fd}
/* VALUE LADDER */
.pricing-root .value-ladder{margin:60px 0 48px;padding:24px 28px;border-radius:18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)}
.pricing-root .value-ladder-label{text-align:center;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.28);margin-bottom:6px}
.pricing-root .value-ladder-sub{text-align:center;font-size:13px;color:rgba(255,255,255,.35);margin-bottom:22px}
.pricing-root .value-ladder-grid{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;gap:12px}
.pricing-root .vl-col{text-align:center;padding:14px 12px;border-radius:12px}
.pricing-root .vl-col.basic{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)}
.pricing-root .vl-col.mid{background:rgba(255,255,255,.04);border:1px solid rgba(99,102,241,.2)}
.pricing-root .vl-col.top{background:linear-gradient(135deg,rgba(196,181,253,.08),rgba(103,232,249,.06));border:1px solid rgba(196,181,253,.25)}
.pricing-root .vl-name{font-size:13px;font-weight:800;margin-bottom:6px}
.pricing-root .vl-items{font-size:11px;color:rgba(255,255,255,.45);line-height:1.6}
.pricing-root .vl-arrow{font-size:18px;color:rgba(255,255,255,.2);font-weight:300;text-align:center}
.pricing-root .value-ladder-footer{text-align:center;margin-top:14px;font-size:11px;color:rgba(255,255,255,.52)}
/* COMPARISON */
.pricing-root .comparison-section{padding:0 0 0}
.pricing-root .comp-toggle-btn{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 auto;padding:13px 32px;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:var(--text);font-family:'Inter',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .25s;backdrop-filter:blur(8px)}
.pricing-root .comp-toggle-btn:hover{border-color:rgba(139,92,246,.4);background:rgba(139,92,246,.06);color:#c4b5fd}
.pricing-root .comp-icon{transition:transform .3s;opacity:.6}
.pricing-root .comp-toggle-btn:hover .comp-icon{opacity:1}
.pricing-root .comp-toggle-btn.open .comp-icon{transform:rotate(180deg)}
.pricing-root .comp-wrap{animation:pr-comp-in .38s cubic-bezier(.22,1,.36,1) both;margin-top:32px;overflow-x:auto;border-radius:16px;border:1px solid rgba(255,255,255,.09)}
.pricing-root .comp-table{width:100%;border-collapse:collapse;font-size:13px}
.pricing-root .comp-table th{padding:16px 18px;text-align:left;font-weight:700;font-size:12px;background:rgba(255,255,255,.05);border-bottom:1px solid rgba(255,255,255,.09);position:sticky;top:0;white-space:nowrap}
.pricing-root .comp-table th:first-child{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.pricing-root .comp-table th:not(:first-child){color:#fff;font-size:14px;font-weight:800;text-align:center}
.pricing-root .comp-table th.featured-col{background:rgba(139,92,246,.1);color:#c4b5fd}
.pricing-root .comp-section-row td{background:rgba(255,255,255,.025);padding:10px 18px;font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;border-top:1px solid rgba(255,255,255,.06)}
.pricing-root .comp-table td{padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.04);color:var(--text);vertical-align:middle}
.pricing-root .comp-table td:not(:first-child){text-align:center;font-weight:600}
.pricing-root .comp-table td.featured-col{background:rgba(139,92,246,.04)}
.pricing-root .comp-table tr:hover td{background:rgba(255,255,255,.02)}
.pricing-root .comp-table tr:hover td.featured-col{background:rgba(139,92,246,.07)}
.pricing-root .check-yes{color:#34d399;font-size:15px}
.pricing-root .check-no{color:var(--dim);font-size:15px}
.pricing-root .comp-table td:first-child{color:rgba(241,245,249,.8);font-weight:500}
/* PAYG */
.pricing-root .wallet-hero{text-align:center;padding:56px 0 36px}
.pricing-root .wallet-hero h2{font-size:clamp(28px,3.5vw,44px);font-weight:900;letter-spacing:-.03em;margin-bottom:12px;color:#fff}
.pricing-root .wallet-hero p{font-size:15px;color:var(--muted);max-width:480px;margin:0 auto 20px}
.pricing-root .wallet-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.25);border-radius:20px;font-size:12px;font-weight:700;color:#34d399}
.pricing-root .recharge-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:56px}
.pricing-root .recharge-card{border-radius:16px;padding:22px 16px 20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);text-align:center;position:relative;cursor:pointer;transition:all .25s;opacity:0;transform:translateY(20px);display:flex;flex-direction:column}
.pricing-root .recharge-card.animated{opacity:1;transform:translateY(0)}
.pricing-root .recharge-card:hover{border-color:rgba(139,92,246,.35);transform:translateY(-3px);box-shadow:0 12px 36px rgba(0,0,0,.35)}
.pricing-root .recharge-card.popular{background:rgba(139,92,246,.07);border:1px solid rgba(139,92,246,.35);box-shadow:0 0 28px rgba(139,92,246,.12)}
.pricing-root .recharge-card.best{background:rgba(6,182,212,.05);border:1px solid rgba(6,182,212,.3)}
.pricing-root .recharge-badge{font-size:9px;font-weight:800;letter-spacing:.08em;padding:2px 9px;border-radius:10px;margin-bottom:10px;display:inline-block}
.pricing-root .recharge-badge.pop{background:rgba(139,92,246,.2);border:1px solid rgba(139,92,246,.4);color:#c4b5fd}
.pricing-root .recharge-badge.bst{background:rgba(6,182,212,.15);border:1px solid rgba(6,182,212,.35);color:#67e8f9}
.pricing-root .recharge-amount{font-size:32px;font-weight:900;letter-spacing:-.03em;color:#fff;margin-bottom:3px}
.pricing-root .recharge-gets{font-size:13px;color:var(--muted);margin-bottom:12px}
.pricing-root .recharge-gets strong{color:var(--text)}
.pricing-root .recharge-bonus{font-size:11px;font-weight:700;color:#34d399;background:rgba(16,185,129,.1);border-radius:6px;padding:3px 8px;display:inline-block;margin-bottom:14px}
.pricing-root .recharge-cta{display:block;width:100%;padding:9px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:var(--text);font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;margin-top:auto}
.pricing-root .recharge-cta:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.3)}
.pricing-root .recharge-card.popular .recharge-cta{background:linear-gradient(135deg,#8B5CF6,#6366F1);border-color:transparent;color:#fff;box-shadow:0 4px 16px rgba(139,92,246,.35)}
.pricing-root .action-pricing-section{margin-bottom:60px}
.pricing-root .action-pricing-header{margin-bottom:28px;display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px}
.pricing-root .action-pricing-header h3{font-size:clamp(20px,2.5vw,28px);font-weight:900;letter-spacing:-.02em;color:#fff;margin:0}
.pricing-root .action-pricing-header p{font-size:13px;color:var(--muted);margin:0}
.pricing-root .action-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.pricing-root .action-card{padding:20px 18px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);transition:all .2s}
.pricing-root .action-card:hover{border-color:rgba(139,92,246,.25);background:rgba(139,92,246,.04)}
.pricing-root .action-type{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px}
.pricing-root .action-name{font-size:15px;font-weight:800;color:#fff;margin-bottom:4px}
.pricing-root .action-price{font-size:26px;font-weight:900;letter-spacing:-.03em;color:#fff}
.pricing-root .action-price span{font-size:12px;font-weight:600;color:var(--muted)}
.pricing-root .action-desc{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.5}
.pricing-root .addons-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.pricing-root .addon-row-item{padding:14px 16px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:10px}
.pricing-root .addon-row-plus{width:24px;height:24px;border-radius:50%;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:800;color:#a78bfa;line-height:1}
.pricing-root .addon-row-name{font-size:13px;font-weight:700;color:var(--text)}
.pricing-root .addon-row-price{font-size:12px;color:#a78bfa;font-weight:700}
.pricing-root .example-section{margin-bottom:60px;padding:28px 32px;border-radius:20px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08)}
.pricing-root .example-title{font-size:16px;font-weight:800;color:var(--text);margin-bottom:18px}
.pricing-root .example-rows{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
.pricing-root .example-row{display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:10px 14px;border-radius:8px;background:rgba(255,255,255,.03)}
.pricing-root .example-row-label{color:rgba(241,245,249,.75)}
.pricing-root .example-row-price{font-weight:700;color:#f1f5f9}
.pricing-root .example-total{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-radius:10px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.25);font-weight:800;font-size:15px}
.pricing-root .example-total-label{color:#c4b5fd}
.pricing-root .example-total-vs{font-size:12px;color:var(--muted);font-weight:500}
.pricing-root .example-vs-agency{margin-top:10px;padding:10px 14px;border-radius:8px;background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);font-size:12px;color:#34d399;font-weight:700;display:flex;align-items:center;gap:8px}
/* ADD-ONS SECTION */
.pricing-root .addons-section{padding:80px 0 0}
.pricing-root .section-label{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#818CF8;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.pricing-root .section-label::before{content:'';display:block;width:24px;height:2px;background:linear-gradient(90deg,#8B5CF6,#818CF8);border-radius:1px}
.pricing-root .section-title{font-size:clamp(24px,3vw,38px);font-weight:900;letter-spacing:-.03em;margin-bottom:10px}
.pricing-root .section-desc{font-size:15px;color:var(--muted);margin-bottom:40px;max-width:520px}
.pricing-root .addons-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.pricing-root .addon-card{border-radius:16px;padding:22px 24px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);transition:all .25s}
.pricing-root .addon-card:hover{border-color:rgba(139,92,246,.3);transform:translateY(-2px);background:rgba(139,92,246,.04)}
.pricing-root .addon-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.pricing-root .addon-name{font-size:15px;font-weight:800;color:#fff;margin-bottom:5px}
.pricing-root .addon-price{font-size:22px;font-weight:900;letter-spacing:-.02em;margin-bottom:6px}
.pricing-root .addon-desc{font-size:12px;color:var(--muted);line-height:1.55}
.pricing-root .addon-compat{margin-top:10px;font-size:11px;font-weight:700;color:#818CF8;background:rgba(129,140,248,.1);border:1px solid rgba(129,140,248,.2);padding:3px 8px;border-radius:6px;display:inline-block}
/* ENTERPRISE */
.pricing-root .enterprise-section{padding:80px 0 0}
.pricing-root .enterprise-card{border-radius:24px;padding:56px 64px;background:rgba(255,255,255,.025);position:relative;overflow:hidden}
.pricing-root .enterprise-card::before{content:'';position:absolute;inset:0;border-radius:24px;padding:1.5px;background:var(--grad);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.pricing-root .enterprise-card::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 70% 50%,rgba(139,92,246,.1) 0%,transparent 60%);pointer-events:none}
.pricing-root .ent-inner{position:relative;z-index:1;display:grid;grid-template-columns:1fr auto;align-items:center;gap:48px}
.pricing-root .ent-tag{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#818CF8;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.pricing-root .ent-tag::before{content:'';display:block;width:20px;height:2px;background:linear-gradient(90deg,#8B5CF6,#818CF8);border-radius:1px}
.pricing-root .ent-title{font-size:clamp(24px,3.5vw,42px);font-weight:900;letter-spacing:-.03em;margin-bottom:14px;line-height:1.1}
.pricing-root .ent-desc{font-size:15px;color:var(--muted);line-height:1.65;margin-bottom:20px}
.pricing-root .ent-proof{display:flex;align-items:center;gap:12px;padding:14px 18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:12px;max-width:520px}
.pricing-root .ent-proof-logo{width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#F97316,#EF4444);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;flex-shrink:0}
.pricing-root .ent-proof-text{font-size:13px;line-height:1.5}
.pricing-root .ent-proof-text strong{color:#fff;font-weight:700}
.pricing-root .ent-proof-text span{color:var(--muted);font-size:12px}
.pricing-root .ent-cta{flex-shrink:0;text-align:center}
.pricing-root .ent-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:16px 36px;border-radius:12px;background:linear-gradient(135deg,#8B5CF6,#6366F1);color:#fff;font-size:16px;font-weight:800;text-decoration:none;transition:all .25s;box-shadow:0 8px 32px rgba(139,92,246,.4);white-space:nowrap}
.pricing-root .ent-btn:hover{opacity:.9;transform:translateY(-2px);box-shadow:0 14px 48px rgba(139,92,246,.55)}
.pricing-root .ent-sub{margin-top:10px;font-size:12px;color:var(--muted);text-align:center}
/* FAQ */
.pricing-root .faq-section{padding:80px 0 100px;max-width:760px;margin:0 auto}
.pricing-root .faq-item{border-bottom:1px solid rgba(255,255,255,.07);overflow:hidden}
.pricing-root .faq-question{width:100%;background:none;border:none;color:var(--text);font-family:'Inter',sans-serif;font-size:16px;font-weight:700;text-align:left;padding:22px 0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;transition:color .2s}
.pricing-root .faq-question:hover{color:#c4b5fd}
.pricing-root .faq-icon{font-size:20px;color:var(--muted);transition:transform .35s cubic-bezier(.34,1.56,.64,1),color .2s;flex-shrink:0;font-weight:400;line-height:1}
/* SCROLL REVEAL — CSS-only: animate in on render, no JS required */
.pricing-root .reveal{animation:pr-slide-up .6s cubic-bezier(.22,1,.36,1) both}
/* RESPONSIVE */
@media(max-width:1100px){.pricing-root .plans-grid{grid-template-columns:repeat(2,1fr)}.pricing-root .packs-grid,.pricing-root .recharge-grid{grid-template-columns:repeat(3,1fr)}.pricing-root .ent-inner{grid-template-columns:1fr}.pricing-root .addons-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){.pricing-root .pr-nav{padding:12px 20px}.pricing-root .plans-grid{grid-template-columns:1fr}.pricing-root .section{padding:0 20px}.pricing-root .enterprise-card{padding:36px 28px}.pricing-root .addons-grid{grid-template-columns:1fr}.pricing-root .value-ladder-grid{grid-template-columns:1fr}}
@media(max-width:640px){.pricing-root .pr-nav{padding:12px 16px}.pricing-root .nav-logo{font-size:24px}.pricing-root .pricing-hero{padding:52px 16px 36px}.pricing-root .hero-h1{font-size:clamp(28px,8vw,44px)}.pricing-root .comp-table th:first-child,.pricing-root .comp-table td:first-child{position:sticky;left:0;background:#07071a;z-index:2;min-width:120px}.pricing-root .nav-link{display:none}.pricing-root .nav-primary{padding:8px 14px;font-size:12px}}
@media(max-width:560px){.pricing-root .recharge-grid{grid-template-columns:repeat(2,1fr)}.pricing-root .action-grid{grid-template-columns:1fr}.pricing-root .addons-row{grid-template-columns:1fr}}

/* ── CSS-only interactive controls ─────────────────────────────────── */
.pr-state{display:none;position:absolute}

/* Mode tabs: both sections hidden by default, shown via :checked */
#tab-subscription,#tab-payg{display:none}
#mode-sub:checked~#tab-subscription{display:block}
#mode-payg:checked~#tab-payg{display:block}
#mode-sub:checked~.mode-tabs-wrap label[for="mode-sub"]{background:rgba(139,92,246,.2);border:1px solid rgba(139,92,246,.4);color:#c4b5fd}
#mode-payg:checked~.mode-tabs-wrap label[for="mode-payg"]{background:rgba(139,92,246,.2);border:1px solid rgba(139,92,246,.4);color:#c4b5fd}
.pricing-root .mode-tab{cursor:pointer;display:block}

/* Billing toggle labels */
.lbl-monthly{color:var(--text);transition:color .2s}
.lbl-annual{color:var(--muted);transition:color .2s}
.price-annual-val{display:none}.note-annual{display:none}.note-monthly{display:block}
#billing-annual:checked~#tab-subscription .toggle-switch{background:linear-gradient(135deg,rgba(139,92,246,.6),rgba(99,102,241,.6))}
#billing-annual:checked~#tab-subscription .toggle-knob{transform:translateX(22px)}
#billing-annual:checked~#tab-subscription .lbl-monthly{color:var(--muted)}
#billing-annual:checked~#tab-subscription .lbl-annual{color:var(--text)}
#billing-annual:checked~#tab-subscription .price-annual-val{display:inline}
#billing-annual:checked~#tab-subscription .price-monthly-val{display:none}
#billing-annual:checked~#tab-subscription .note-annual{display:block}
#billing-annual:checked~#tab-subscription .note-monthly{display:none}
label.toggle-switch{cursor:pointer}

/* Compare toggle */
.comp-wrap{display:none}.comp-lbl-hide{display:none}
#comp-open:checked~#tab-subscription .comp-wrap{display:block;animation:pr-comp-in .38s cubic-bezier(.22,1,.36,1) both}
#comp-open:checked~#tab-subscription .comp-lbl-show{display:none}
#comp-open:checked~#tab-subscription .comp-lbl-hide{display:inline}
#comp-open:checked~#tab-subscription .comp-icon{transform:rotate(180deg);opacity:1}
#comp-open:checked~#tab-subscription label.comp-toggle-btn{border-color:rgba(139,92,246,.4);background:rgba(139,92,246,.06);color:#c4b5fd}
label.comp-toggle-btn{cursor:pointer}

/* Plan card entrance via CSS (no JS observer needed) */
.pricing-root .plans-grid .plan-card{opacity:1;transform:none;animation:pr-slide-up .55s cubic-bezier(.22,1,.36,1) both}
.pricing-root .plans-grid>.plan-card:nth-child(1){animation-delay:0ms}
.pricing-root .plans-grid>.plan-card:nth-child(2){animation-delay:90ms}
.pricing-root .plans-grid>.plan-card:nth-child(3){animation-delay:180ms}
.pricing-root .plans-grid>.plan-card:nth-child(4){animation-delay:270ms}
.pricing-root .recharge-card{opacity:1;transform:none}

/* FAQ via <details>/<summary> */
details.faq-item{border-bottom:1px solid rgba(255,255,255,.07)}
details.faq-item summary{list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;width:100%;padding:22px 0;cursor:pointer;background:none;color:var(--text);font-family:'Inter',system-ui,sans-serif;font-size:16px;font-weight:700;transition:color .2s}
details.faq-item summary::-webkit-details-marker,details.faq-item summary::marker{display:none}
details.faq-item summary:hover,details.faq-item[open] summary{color:#c4b5fd}
details.faq-item[open] .faq-icon{transform:rotate(45deg);color:#c4b5fd}
/* Height accordion via grid 0fr→1fr (animates both open and close) */
details.faq-item .faq-body{display:grid;grid-template-rows:0fr;overflow:hidden;transition:grid-template-rows .38s cubic-bezier(.22,1,.36,1)}
details.faq-item[open] .faq-body{grid-template-rows:1fr}
/* Content: starts hidden, transitions in on open; @starting-style drives enter animation */
details.faq-item .faq-answer-inner{min-height:0;overflow:hidden;padding-bottom:20px;font-size:14px;color:var(--muted);line-height:1.75;opacity:0;transform:translateY(-10px);transition:opacity .3s ease,transform .3s ease}
details.faq-item[open] .faq-answer-inner{opacity:1;transform:translateY(0)}
@starting-style{details.faq-item[open] .faq-body{grid-template-rows:0fr}details.faq-item[open] .faq-answer-inner{opacity:0;transform:translateY(-10px)}}
`

const ChevronSvg = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
)

const CheckSvg = ({ cls = 'yes' }: { cls?: string }) => (
  <span className={`feat-check ${cls}`}>✓</span>
)
const CY = () => <span className="check-yes">✓</span>
const CN = () => <span className="check-no">✗</span>

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="comp-icon">
    <rect x="2" y="2" width="6" height="6" rx="1"/><rect x="12" y="2" width="6" height="6" rx="1"/>
    <rect x="2" y="12" width="6" height="6" rx="1"/><rect x="12" y="12" width="6" height="6" rx="1"/>
  </svg>
)

export default function Pricing() {
  const brand = useBrandName()

  const email = (subj: string) => `mailto:a.sachin533@gmail.com?subject=${encodeURIComponent(subj)}`

  return (
    <>
      <SEO
        title={`${brand} Pricing — From $31/month · AI Trend-Jacking Engine`}
        description={`${brand} plans from $31/month (yearly). Spark, Growth, Scale, and Pay As You Go credits. Flexible add-ons for any need. 14-day free trial. No credit card required.`}
        canonical="/pricing"
        keywords={`${brand} pricing, AI social media pricing, trend jacking cost, content automation plans, social media AI pricing`}
        structuredData={[
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              { '@type': 'Question', name: `Can I switch ${brand} plans anytime?`, acceptedAnswer: { '@type': 'Answer', text: 'Yes — upgrade or downgrade at any time. Upgrades are prorated; downgrades are credited to your next invoice. No lock-in, no penalty.' } },
              { '@type': 'Question', name: 'Do Pay As You Go credits expire?', acceptedAnswer: { '@type': 'Answer', text: 'Never. PAYG credits are yours indefinitely — publish this week or save them for a campaign months from now.' } },
              { '@type': 'Question', name: 'Is there a free trial?', acceptedAnswer: { '@type': 'Answer', text: `Yes — Spark and Growth plans include a 14-day free trial with no credit card required.` } },
              { '@type': 'Question', name: `What counts as one post in ${brand}?`, acceptedAnswer: { '@type': 'Answer', text: 'Each publish event to a single platform = 1 base credit. Publishing to 3 platforms simultaneously = 3 base credits.' } },
            ],
          },
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `${brand} Pricing Plans`,
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Spark', description: '$39/month — ~150 posts/month. 14-day free trial.' },
              { '@type': 'ListItem', position: 2, name: 'Growth', description: '$129/month — ~500 posts/month. 14-day free trial.' },
              { '@type': 'ListItem', position: 3, name: 'Scale', description: '$449/month — ~2,000 posts/month. API access included.' },
              { '@type': 'ListItem', position: 4, name: 'Pay As You Go', description: 'Buy credits anytime. Credits never expire.' },
            ],
          },
        ]}
      />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pricing-root">
        <div className="orb orb-a"/><div className="orb orb-b"/><div className="orb orb-c"/>
        <div className="dot-grid"/>

        {/* NAV */}
        <nav className="pr-nav">
          <div className="nav-left">
            <Link to="/" className="nav-logo">{brand}</Link>
          </div>
          <div className="nav-cta">
            <a href="#faq" className="nav-link">FAQ</a>
            <a href="#enterprise" className="nav-link">Enterprise</a>
            <a href={email('Get Started')} className="nav-primary">Get Started</a>
          </div>
        </nav>

        <main>
          {/* CSS state inputs — must precede all controlled siblings */}
          <input type="radio" id="mode-sub" name="pmode" className="pr-state" defaultChecked />
          <input type="radio" id="mode-payg" name="pmode" className="pr-state" />
          <input type="checkbox" id="billing-annual" className="pr-state" />
          <input type="checkbox" id="comp-open" className="pr-state" />

          {/* HERO */}
          <div className="pricing-hero">
            <div className="beta-pill"><span className="beta-dot"/>&nbsp;Currently in Private Beta</div>
            <h1 className="hero-h1">
              Stop overpaying<br/>
              <span className="grad-text">for content.</span>
            </h1>
            <p className="hero-sub">AI-powered publishing from $31/month. Trend to live post in under 90 seconds, across 5 platforms. First 14 days free.</p>
          </div>

          {/* MODE TABS — labels control hidden radio inputs above */}
          <div className="mode-tabs-wrap">
            <div className="mode-tabs">
              <label htmlFor="mode-sub" className="mode-tab">Subscription</label>
              <label htmlFor="mode-payg" className="mode-tab">Pay As You Go</label>
            </div>
          </div>

          {/* SUBSCRIPTION */}
          <div id="tab-subscription">
              <div className="section">
                <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)', marginTop: 12 }}>All plans include: trend detection · AI writing · QA · multi-platform publishing · analytics</p>

                {/* BILLING TOGGLE — label controls hidden #billing-annual checkbox */}
                <div className="billing-toggle-wrap">
                  <span className="toggle-label lbl-monthly">Monthly</span>
                  <label htmlFor="billing-annual" className="toggle-switch">
                    <div className="toggle-knob"/>
                  </label>
                  <span className="toggle-label lbl-annual">Annual</span>
                  <span className="save-badge">Save 20%</span>
                </div>

                {/* PLAN CARDS */}
                <div className="plans-grid">
                  {/* SPARK */}
                  <div className="plan-card" data-delay="0">
                    <div className="plan-name">Spark</div>
                    <div className="plan-tags">
                      <div className="plan-tier-tag">Local Focus</div>
                    </div>
                    <div className="plan-desc">Text + image posts for local markets. Single language. Entry-level AI content on 2 platforms.</div>
                    <div className="plan-price-wrap">
                      <div className="plan-price">
                        <span className="price-dollar"><span className="price-monthly-val">${PRICES.spark.monthly}</span><span className="price-annual-val">${PRICES.spark.annual}</span></span>
                        <span className="price-period">/mo</span>
                      </div>
                    </div>
                    <div className="annual-note"><span className="note-monthly">&nbsp;</span><span className="note-annual">Billed ${PRICES.spark.annualTotal.toLocaleString()}/yr</span></div>
                    <div className="per-post-chip">≈ $0.26 / post · 170× cheaper than agency</div>
                    <div className="plan-divider"/>
                    <ul className="plan-features">
                      <li><CheckSvg/>150 posts / month</li>
                      <li><CheckSvg/>2 platforms</li>
                      <li><CheckSvg/>Text posts + Image with text overlay</li>
                      <li><CheckSvg/>Local coverage — 1 city or region</li>
                      <li><CheckSvg/>Single language (English or regional)</li>
                      <li><CheckSvg/>2 automated pipeline runs / day</li>
                      <li><CheckSvg/>14-day free trial — no credit card</li>
                    </ul>
                    <div className="plan-spacer"/>
                    <a href={email('Spark Plan')} className="plan-cta cta-outline">Start Free Trial <ChevronSvg/></a>
                  </div>

                  {/* GROWTH */}
                  <div className="plan-card" data-delay="80">
                    <div className="plan-name">Growth</div>
                    <div className="plan-tags">
                      <div className="plan-tier-tag">Country-Wide</div>
                      <div className="plan-badge popular">POPULAR</div>
                    </div>
                    <div className="plan-desc">National reach. 2 languages. Memes, Stories &amp; smart scheduling on 3 platforms.</div>
                    <div className="plan-price-wrap">
                      <div className="plan-price">
                        <span className="price-dollar"><span className="price-monthly-val">${PRICES.growth.monthly}</span><span className="price-annual-val">${PRICES.growth.annual}</span></span>
                        <span className="price-period">/mo</span>
                      </div>
                    </div>
                    <div className="annual-note"><span className="note-monthly">&nbsp;</span><span className="note-annual">Billed ${PRICES.growth.annualTotal.toLocaleString()}/yr</span></div>
                    <div className="per-post-chip">≈ $0.22 / post · more reach, more formats</div>
                    <div className="plan-divider"/>
                    <ul className="plan-features">
                      <li><CheckSvg/>600 posts / month</li>
                      <li><CheckSvg/>3 platforms</li>
                      <li><CheckSvg/>Text, Images, Meme overlays, Instagram Stories</li>
                      <li><CheckSvg/>Country-wide coverage — national trends</li>
                      <li><CheckSvg/>2 languages (e.g. English + Hindi)</li>
                      <li><CheckSvg/>5 automated runs / day</li>
                      <li><CheckSvg/>Smart scheduling (platform-optimal windows)</li>
                    </ul>
                    <div className="plan-spacer"/>
                    <a href={email('Growth Plan')} className="plan-cta cta-gradient">Start Free Trial <ChevronSvg/></a>
                  </div>

                  {/* SCALE */}
                  <div className="plan-card featured" data-delay="160">
                    <div className="plan-name grad-text">Scale</div>
                    <div className="plan-tags">
                      <div className="plan-tier-tag" style={{ background: 'rgba(196,181,253,.1)', borderColor: 'rgba(196,181,253,.25)', color: 'rgba(196,181,253,.7)' }}>Global Reach</div>
                      <div className="plan-badge most-popular">MOST POPULAR</div>
                    </div>
                    <div className="plan-desc">Every format, all 5 platforms, global trends, unlimited languages &amp; dialects. Maximum output.</div>
                    <div className="plan-price-wrap">
                      <div className="plan-price">
                        <span className="price-dollar"><span className="price-monthly-val">${PRICES.scale.monthly}</span><span className="price-annual-val">${PRICES.scale.annual}</span></span>
                        <span className="price-period">/mo</span>
                      </div>
                    </div>
                    <div className="annual-note"><span className="note-monthly">&nbsp;</span><span className="note-annual">Billed ${PRICES.scale.annualTotal.toLocaleString()}/yr</span></div>
                    <div className="per-post-chip grad">≈ $0.18 / post · best value per post</div>
                    <div className="plan-divider"/>
                    <ul className="plan-features">
                      <li><CheckSvg cls="grad"/>2,500 posts / month</li>
                      <li><CheckSvg cls="grad"/>All 5 platforms</li>
                      <li><CheckSvg cls="grad"/>ALL content types: Text, Image, Memes, IG Stories, IG Carousel, YouTube Shorts</li>
                      <li><CheckSvg cls="grad"/>Global coverage — worldwide trend scanning</li>
                      <li><CheckSvg cls="grad"/>Unlimited languages + dialects (Hinglish, formal, casual)</li>
                      <li><CheckSvg cls="grad"/>Viral timing optimization</li>
                      <li><CheckSvg cls="grad"/>API access (5,000 calls / month)</li>
                    </ul>
                    <div className="plan-spacer"/>
                    <a href={email('Scale Plan')} className="plan-cta cta-gradient">Get Scale <ChevronSvg/></a>
                  </div>

                  {/* COMMAND */}
                  <div className="plan-card" data-delay="240">
                    <div className="plan-name">Command</div>
                    <div className="plan-tags">
                      <div className="plan-tier-tag">Custom Scale</div>
                      <div className="plan-badge enterprise">ENTERPRISE</div>
                    </div>
                    <div className="plan-desc">For enterprises that need it all, their way.</div>
                    <div className="plan-price-wrap">
                      <div className="plan-price">
                        <span className="price-custom">Custom</span>
                      </div>
                    </div>
                    <div className="annual-note">Starting from $1,999 / mo</div>
                    <div className="per-post-chip hidden">placeholder</div>
                    <div className="plan-divider"/>
                    <ul className="plan-features">
                      <li><CheckSvg/>Unlimited posts</li>
                      <li><CheckSvg/>White-label deployment option</li>
                      <li><CheckSvg/>Dedicated Account Manager</li>
                      <li><CheckSvg/>Custom integrations + dedicated API (unlimited + webhooks)</li>
                      <li><CheckSvg/>99.9% uptime SLA + NDA / MSA</li>
                      <li><CheckSvg/>Multi-team access + role-based permissions</li>
                    </ul>
                    <div className="plan-spacer"/>
                    <a href={email('Command Enterprise Plan')} className="plan-cta cta-amber">Talk to Sales <ChevronSvg/></a>
                  </div>
                </div>

                {/* VALUE LADDER */}
                <div className="value-ladder">
                  <div className="value-ladder-label">Unlock more as you grow</div>
                  <div className="value-ladder-sub">Each plan isn't just bigger — it's a richer toolkit</div>
                  <div className="value-ladder-grid">
                    <div className="vl-col basic">
                      <div className="vl-name" style={{ color: '#fff' }}>Spark</div>
                      <div className="vl-items">Local coverage<br/>Single language<br/>2 platforms · Text &amp; image</div>
                    </div>
                    <div className="vl-arrow">→</div>
                    <div className="vl-col mid">
                      <div className="vl-name" style={{ color: '#a5b4fc' }}>Growth</div>
                      <div className="vl-items">Country-wide<br/>2 languages · Hinglish-ready<br/>+ Memes, Stories, scheduling</div>
                    </div>
                    <div className="vl-arrow">→</div>
                    <div className="vl-col top">
                      <div className="vl-name grad-text">Scale</div>
                      <div className="vl-items" style={{ color: 'rgba(255,255,255,.55)' }}>Global · All languages + dialects<br/>All 5 platforms · Viral timing<br/>Carousels, Shorts · $0.18/post</div>
                    </div>
                  </div>
                  <div className="value-ladder-footer">Higher engagement formats justify higher plans — your reach compounds</div>
                </div>

                {/* COMPARISON */}
                <div className="comparison-section reveal" style={{ paddingBottom: 80 }}>
                  <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <label htmlFor="comp-open" className="comp-toggle-btn">
                      <GridIcon/>
                      <span className="comp-lbl-show">Compare all features</span>
                      <span className="comp-lbl-hide">Hide comparison</span>
                    </label>
                  </div>
                  <div className="comp-wrap">
                      <table className="comp-table">
                        <thead>
                          <tr>
                            <th style={{ width: 260 }}>Feature</th>
                            <th>Spark</th><th>Growth</th>
                            <th className="featured-col">Scale</th>
                            <th>Command</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="comp-section-row"><td colSpan={5}>Content &amp; Publishing</td></tr>
                          <tr><td>Posts per month</td><td>150</td><td>600</td><td className="featured-col">2,500</td><td>Unlimited</td></tr>
                          <tr><td>Platforms</td><td>2</td><td>3</td><td className="featured-col">All 5</td><td>All + custom</td></tr>
                          <tr><td>Text posts</td><td><CY/></td><td><CY/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr><td>Image + text overlay</td><td><CY/></td><td><CY/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr><td>Meme overlays</td><td><CN/></td><td><CY/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr><td>Instagram Stories</td><td><CN/></td><td><CY/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr><td>IG Carousel</td><td><CN/></td><td><CN/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr><td>YouTube Shorts</td><td><CN/></td><td><CN/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr><td>Custom content formats</td><td><CN/></td><td><CN/></td><td className="featured-col"><CN/></td><td><CY/></td></tr>
                          <tr className="comp-section-row"><td colSpan={5}>Automation &amp; Scheduling</td></tr>
                          <tr><td>Automated runs / day</td><td>2</td><td>5</td><td className="featured-col">Unlimited</td><td>Unlimited</td></tr>
                          <tr><td>Manual "run now" trigger</td><td><CY/></td><td><CY/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr><td>Smart scheduling</td><td><CN/></td><td><CY/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr><td>Viral timing optimization</td><td><CN/></td><td><CN/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr><td>Priority processing (3× faster)</td><td><CN/></td><td><CN/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr className="comp-section-row"><td colSpan={5}>Regional Coverage &amp; Language</td></tr>
                          <tr><td>Geographic reach</td><td>Local (1 city/region)</td><td>Country-wide</td><td className="featured-col">Global</td><td>Custom multi-market</td></tr>
                          <tr><td>Languages</td><td>1 language</td><td>2 languages</td><td className="featured-col">Unlimited</td><td>Unlimited + custom</td></tr>
                          <tr><td>Dialect support (Hinglish etc.)</td><td><CN/></td><td><CN/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr><td>Formal / casual tone switching</td><td><CN/></td><td><CY/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr className="comp-section-row"><td colSpan={5}>Trend Intelligence</td></tr>
                          <tr><td>Trend volume access</td><td>High only</td><td>Medium + High</td><td className="featured-col">All volumes</td><td>Custom filters</td></tr>
                          <tr><td>Domain-specific focus</td><td><CN/></td><td>1 category</td><td className="featured-col">Up to 5</td><td>Unlimited</td></tr>
                          <tr><td>Brand profiles</td><td>1</td><td>1</td><td className="featured-col">2</td><td>Unlimited</td></tr>
                          <tr className="comp-section-row"><td colSpan={5}>Analytics &amp; Support</td></tr>
                          <tr><td>Analytics depth</td><td>Basic</td><td>Advanced</td><td className="featured-col">Full suite</td><td>Custom + BI</td></tr>
                          <tr><td>Analytics export</td><td><CN/></td><td><CN/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr><td>Engagement tracking</td><td><CN/></td><td><CY/></td><td className="featured-col"><CY/></td><td><CY/></td></tr>
                          <tr><td>Support channel</td><td>Email</td><td>Chat + Email</td><td className="featured-col">Priority + Slack</td><td>Dedicated AM</td></tr>
                          <tr><td>Support SLA</td><td>48hr</td><td>12hr</td><td className="featured-col">4hr</td><td>Custom</td></tr>
                          <tr className="comp-section-row"><td colSpan={5}>Infrastructure</td></tr>
                          <tr><td>API access</td><td><CN/></td><td>Add-on</td><td className="featured-col">5,000 calls/mo</td><td>Unlimited + webhooks</td></tr>
                          <tr><td>White-label deployment</td><td><CN/></td><td><CN/></td><td className="featured-col"><CN/></td><td><CY/></td></tr>
                          <tr><td>99.9% uptime SLA</td><td><CN/></td><td><CN/></td><td className="featured-col"><CN/></td><td><CY/></td></tr>
                          <tr><td>Multi-team + RBAC</td><td><CN/></td><td><CN/></td><td className="featured-col"><CN/></td><td><CY/></td></tr>
                          <tr><td>NDA / MSA available</td><td><CN/></td><td><CN/></td><td className="featured-col"><CN/></td><td><CY/></td></tr>
                        </tbody>
                      </table>
                    </div>
                </div>
              </div>
          </div>

          {/* PAY AS YOU GO */}
          <div id="tab-payg">
              <div className="section">
                <div className="wallet-hero reveal">
                  <h2>Top up. Create. That's it.</h2>
                  <p>No monthly commitment. Recharge your {brand} wallet and pay only for what you publish.</p>
                  <div className="wallet-badge">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Balance never expires
                  </div>
                </div>
                <div className="recharge-grid">
                  {[
                    { amt: '$20', gets: '$20', bonus: null, delay: 0, cls: '' },
                    { amt: '$50', gets: '$52.50', bonus: '+5% bonus', delay: 60, cls: '' },
                    { amt: '$100', gets: '$110', bonus: '+10% bonus', delay: 120, cls: 'popular', badge: { cls: 'pop', text: 'MOST POPULAR' } },
                    { amt: '$250', gets: '$287.50', bonus: '+15% bonus', delay: 180, cls: '' },
                    { amt: '$500', gets: '$600', bonus: '+20% bonus', delay: 240, cls: 'best', badge: { cls: 'bst', text: 'BEST VALUE' } },
                  ].map((r, i) => (
                    <div key={i} className={`recharge-card${r.cls ? ' ' + r.cls : ''}`} data-delay={r.delay}>
                      {r.badge ? <div className={`recharge-badge ${r.badge.cls}`}>{r.badge.text}</div> : <div style={{ height: 18 }}/>}
                      <div className="recharge-amount">{r.amt}</div>
                      <div className="recharge-gets">Get <strong>{r.gets}</strong> balance</div>
                      {r.bonus ? <div className="recharge-bonus">{r.bonus}</div> : <div className="recharge-bonus" style={{ visibility: 'hidden' }}>—</div>}
                      <button className="recharge-cta">Top Up</button>
                    </div>
                  ))}
                </div>
                <div className="action-pricing-section reveal">
                  <div className="action-pricing-header">
                    <h3>What each action costs</h3>
                    <p>Charged from your wallet balance on publish</p>
                  </div>
                  <div className="action-grid">
                    {[
                      { type: 'Text Post', name: 'Any Platform', price: '$2', unit: '/ post', desc: 'Twitter, LinkedIn, Instagram caption, News article' },
                      { type: 'Image Post', name: 'AI-Generated Visual', price: '$3', unit: '/ post', desc: 'Text + AI-generated image or branded overlay' },
                      { type: 'Rich Format', name: 'IG Stories / Meme', price: '$3.50', unit: '/ post', desc: 'Meme templates, Instagram Stories with branding' },
                      { type: 'Premium Format', name: 'IG Carousel / YT Shorts', price: '$5', unit: '/ post', desc: 'Multi-slide carousels (AI images) or YouTube Shorts scripts' },
                    ].map((a, i) => (
                      <div key={i} className="action-card">
                        <div className="action-type">{a.type}</div>
                        <div className="action-name">{a.name}</div>
                        <div className="action-price">{a.price} <span>{a.unit}</span></div>
                        <div className="action-desc">{a.desc}</div>
                      </div>
                    ))}
                  </div>
                  <div className="addons-row">
                    {[
                      { name: 'Extra platform', price: '+$0.50 / post' },
                      { name: 'Viral timing optimizer', price: '+$0.75 / post' },
                      { name: 'Domain intelligence', price: '+$0.25 / post' },
                      { name: 'Priority processing', price: '+$0.50 / post' },
                    ].map((a, i) => (
                      <div key={i} className="addon-row-item">
                        <div className="addon-row-plus">+</div>
                        <div><div className="addon-row-name">{a.name}</div><div className="addon-row-price">{a.price}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="example-section reveal">
                  <div className="example-title">Example: 10 posts this week</div>
                  <div className="example-rows">
                    {[
                      ['5 text posts × Twitter + LinkedIn', '$12.50'],
                      ['3 image posts × Instagram', '$9.00'],
                      ['2 IG Carousels', '$10.00'],
                      ['Viral timing optimizer (all posts)', '$7.50'],
                    ].map(([label, price], i) => (
                      <div key={i} className="example-row">
                        <span className="example-row-label">{label}</span>
                        <span className="example-row-price">{price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="example-total">
                    <span className="example-total-label">Your {brand} wallet spend</span>
                    <div style={{ textAlign: 'right' }}>
                      <div>$39.00</div>
                      <div className="example-total-vs">vs $450 at an agency</div>
                    </div>
                  </div>
                  <div className="example-vs-agency">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    11× cheaper than agency rates — no subscription required
                  </div>
                </div>
              </div>
          </div>

          {/* ADD-ONS */}
          <div className="addons-section">
            <div className="section">
              <div className="reveal">
                <div className="section-label">Add-ons</div>
                <h2 className="section-title">Extend your plan</h2>
                <p className="section-desc">Mix and match capabilities without upgrading your entire plan.</p>
              </div>
              <div className="addons-grid">
                {[
                  { iconBg: 'rgba(139,92,246,.15)', iconColor: '#a78bfa', iconPath: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>, name: 'Viral Timing Module', price: '+$29', per: '/mo', desc: 'AI-powered peak virality window detection. Publishes at exactly the right moment for maximum reach.', compat: 'Available for Spark' },
                  { iconBg: 'rgba(6,182,212,.12)', iconColor: '#22d3ee', iconPath: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>, name: 'Extra Platform Slot', price: '+$15', per: '/mo per platform', desc: 'Add additional publishing channels beyond your plan limit. Any supported platform.', compat: 'Spark & Growth' },
                  { iconBg: 'rgba(16,185,129,.12)', iconColor: '#34d399', iconPath: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>, name: 'Domain Intelligence Pack', price: '+$25', per: '/mo per domain', desc: 'Add additional industry-specific trend intelligence categories beyond your plan\'s domains.', compat: 'Growth' },
                  { iconBg: 'rgba(245,158,11,.12)', iconColor: '#fbbf24', iconPath: <><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4M19 17v4M3 5h4M17 19h4"/></>, name: 'Image Generation Suite', price: '+$39', per: '/mo', desc: 'Premium AI-generated visuals powered by diffusion models. Brand-consistent imagery at scale.', compat: 'All plans' },
                  { iconBg: 'rgba(99,102,241,.12)', iconColor: '#818cf8', iconPath: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>, name: 'Team Seat', price: '+$19', per: '/mo per user', desc: 'Invite collaborators to view analytics, review posts, and manage platform settings.', compat: 'Growth & Scale' },
                  { iconBg: 'rgba(56,189,248,.12)', iconColor: '#38bdf8', iconPath: <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>, name: 'API Access', price: '+$49', per: '/mo', desc: `Unlock programmatic access to ${brand}'s pipeline. Trigger runs, fetch posts, and build custom workflows.`, compat: 'Growth add-on' },
                ].map((a, i) => (
                  <div key={i} className="addon-card reveal">
                    <div className="addon-icon" style={{ background: a.iconBg }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{a.iconPath}</svg>
                    </div>
                    <div className="addon-name">{a.name}</div>
                    <div className="addon-price grad-text">{a.price}<span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>{a.per}</span></div>
                    <div className="addon-desc">{a.desc}</div>
                    <div className="addon-compat">{a.compat}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ENTERPRISE */}
          <div className="enterprise-section" id="enterprise">
            <div className="section">
              <div className="enterprise-card reveal">
                <div className="ent-inner">
                  <div>
                    <div className="ent-tag">Enterprise</div>
                    <h2 className="ent-title">Need something custom?<br/><span className="grad-text">Let's build it together.</span></h2>
                    <p className="ent-desc">White-label deployment, dedicated infrastructure, custom integrations, and a team that moves at your speed. {brand} adapts to enterprise publishing workflows — not the other way around.</p>
                    <div className="ent-proof">
                      <div className="ent-proof-logo">H.</div>
                      <div className="ent-proof-text">
                        <strong>Currently powering Housing.com's content engine</strong><br/>
                        <span>India's #1 real estate platform · 50M+ monthly users</span>
                      </div>
                    </div>
                  </div>
                  <div className="ent-cta">
                    <a href={email('Enterprise Inquiry — Command Plan')} className="ent-btn">Talk to our team <ChevronSvg/></a>
                    <div className="ent-sub">Usually responds within 4 hours</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div id="faq">
            <div className="section">
              <div className="faq-section">
                <div className="reveal" style={{ textAlign: 'center', marginBottom: 52 }}>
                  <div className="section-label" style={{ justifyContent: 'center' }}>FAQ</div>
                  <h2 className="section-title" style={{ textAlign: 'center' }}>Questions? We have answers.</h2>
                </div>
                {[
                  { q: 'Can I switch plans anytime?', a: 'Yes — upgrade or downgrade at any time. When you upgrade, you\'re charged a prorated amount for the remainder of your billing cycle. When you downgrade, the difference is credited to your next invoice. No lock-in, no penalty.' },
                  { q: 'Do Pay As You Go credits expire?', a: 'Never. Credits you purchase are yours indefinitely. Publish a thousand posts this week or save them for a campaign six months from now — your balance stays exactly where you left it.' },
                  { q: 'What exactly counts as one "post"?', a: 'Each publish event to a single platform counts as 1 base credit unit. Publishing the same piece of content to 3 platforms simultaneously = 3 base credits (+ any applicable modifiers like viral timing or domain focus).' },
                  { q: 'Can I use the API on Spark or Growth?', a: <span>API access is included natively on <strong>Scale</strong> (5,000 calls/month) and <strong>Command</strong> (unlimited + webhooks). Growth plan customers can unlock API access with the <strong>API Access add-on</strong> for +$49/mo. Spark does not support API access.</span> },
                  { q: 'Is there a free trial?', a: <span>Yes — both <strong>Spark</strong> and <strong>Growth</strong> include a <strong>14-day free trial</strong> with no credit card required. You get full access to the plan's features so you can see real posts go live before committing.</span> },
                  { q: `Which platforms does ${brand} support?`, a: <span>{brand} currently supports: <strong>Twitter / X</strong>, <strong>Instagram</strong> (Feed, Stories, Carousels), <strong>LinkedIn</strong>, <strong>YouTube Shorts</strong>, and <strong>Housing News</strong> — our proprietary distribution channel reaching 50M+ monthly users on Housing.com.</span> },
                ].map((item, i) => (
                  <details key={i} className="faq-item reveal">
                    <summary className="faq-question">
                      {item.q}
                      <span className="faq-icon">+</span>
                    </summary>
                    <div className="faq-body">
                      <div className="faq-answer-inner">{item.a}</div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
