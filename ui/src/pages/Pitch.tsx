import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBrandName } from '../lib/useBrandName'

const TOTAL_SLIDES = 10

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
.pitch-root {
  --bg:#07071a;--surf:rgba(255,255,255,0.04);--bord:rgba(255,255,255,0.09);
  --purple:#8B5CF6;--indigo:#6366F1;--cyan:#06B6D4;--green:#10B981;
  --amber:#F59E0B;--text:#f1f5f9;--muted:#64748b;--dim:#334155;
  --grad:linear-gradient(90deg,#C4B5FD 0%,#818CF8 38%,#38BDF8 72%,#67E8F9 100%);
  font-family:'Inter',system-ui,sans-serif;
  background:var(--bg);color:var(--text);
  position:fixed;inset:0;overflow:hidden;
}
.pitch-root *,.pitch-root *::before,.pitch-root *::after{box-sizing:border-box;margin:0;padding:0}
/* AMBIENT */
.pitch-root .orb{position:fixed;border-radius:50%;pointer-events:none;z-index:0}
.pitch-root .orb-a{width:600px;height:600px;top:-200px;left:-100px;background:radial-gradient(circle,rgba(139,92,246,.16) 0%,transparent 70%);animation:pt-float-a 20s ease-in-out infinite}
.pitch-root .orb-b{width:500px;height:500px;top:30%;right:-120px;background:radial-gradient(circle,rgba(6,182,212,.12) 0%,transparent 70%);animation:pt-float-b 24s ease-in-out infinite}
.pitch-root .orb-c{width:400px;height:400px;bottom:5%;left:35%;background:radial-gradient(circle,rgba(99,102,241,.10) 0%,transparent 70%);animation:pt-float-c 18s ease-in-out infinite}
.pitch-root .dot-grid{position:fixed;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.05) 1px,transparent 1px);background-size:32px 32px;pointer-events:none;z-index:0}
@keyframes pt-float-a{0%,100%{transform:translate(0,0)}33%{transform:translate(40px,-50px)}66%{transform:translate(-30px,30px)}}
@keyframes pt-float-b{0%,100%{transform:translate(0,0)}40%{transform:translate(-40px,35px)}70%{transform:translate(25px,-35px)}}
@keyframes pt-float-c{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,45px)}}
/* PROGRESS BAR */
.pitch-root .pt-progress{position:fixed;top:0;left:0;right:0;height:3px;z-index:200;background:rgba(255,255,255,.06)}
.pitch-root .pt-progress-fill{height:100%;background:linear-gradient(90deg,#8B5CF6,#6366F1,#06B6D4);transition:width .4s cubic-bezier(.22,1,.36,1)}
/* TOP UI */
.pitch-root .pt-topbar{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:18px 40px 0;pointer-events:none}
.pitch-root .pt-topbar-left{pointer-events:auto;display:flex;align-items:center;gap:10px}
.pitch-root .pt-brand{font-weight:900;font-size:22px;letter-spacing:-.03em;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.pitch-root .pt-confidential{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:3px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04)}
.pitch-root .pt-exit-btn{pointer-events:auto;display:flex;align-items:center;gap:6px;padding:8px 18px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:rgba(255,255,255,.7);font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;backdrop-filter:blur(8px);transition:all .2s}
.pitch-root .pt-exit-btn:hover{border-color:rgba(255,255,255,.28);color:#fff;background:rgba(255,255,255,.07)}
/* SLIDE TRACK */
.pitch-root .pt-track{position:fixed;inset:0;z-index:1;display:flex;transition:transform .5s cubic-bezier(.4,0,.2,1)}
/* SLIDE */
.pitch-root .pt-slide{width:100vw;height:100vh;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:80px 60px 100px;overflow:hidden}
/* GRAD TEXT */
.pitch-root .grad-text{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
/* BOTTOM NAV */
.pitch-root .pt-bottom{position:fixed;bottom:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 40px 24px;pointer-events:none}
.pitch-root .pt-nav-arrows{pointer-events:auto;display:flex;gap:10px;align-items:center}
.pitch-root .pt-arrow{width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:rgba(255,255,255,.7);display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(8px);transition:all .2s}
.pitch-root .pt-arrow:hover:not(:disabled){border-color:rgba(139,92,246,.5);color:#fff;background:rgba(139,92,246,.12)}
.pitch-root .pt-arrow:disabled{opacity:.25;cursor:default}
.pitch-root .pt-dots{pointer-events:auto;display:flex;gap:6px;align-items:center}
.pitch-root .pt-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.2);border:none;padding:0;cursor:pointer;transition:all .3s cubic-bezier(.22,1,.36,1)}
.pitch-root .pt-dot.active{width:22px;border-radius:4px;background:linear-gradient(90deg,#8B5CF6,#06B6D4)}
.pitch-root .pt-counter{pointer-events:none;font-size:13px;font-weight:700;color:var(--muted);letter-spacing:.04em}
/* GLASS CARD */
.pitch-root .glass-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:28px;backdrop-filter:blur(16px)}
/* SLIDE CONTENTS — layout helpers */
.pitch-root .slide-inner{position:relative;z-index:2;width:100%;max-width:1100px;text-align:center}
.pitch-root .slide-inner.left{text-align:left}
.pitch-root .slide-tag{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#818CF8;margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:8px}
.pitch-root .slide-tag::before,.pitch-root .slide-tag::after{content:'';display:block;flex:1;max-width:40px;height:1.5px;background:linear-gradient(90deg,transparent,#8B5CF6)}
.pitch-root .slide-tag.left-tag{justify-content:flex-start}
.pitch-root .slide-tag.left-tag::before{display:none}
.pitch-root .slide-tag::after{background:linear-gradient(90deg,#8B5CF6,transparent)}
.pitch-root .slide-h1{font-size:clamp(36px,4.5vw,64px);font-weight:900;letter-spacing:-.03em;line-height:1.08;margin-bottom:14px;color:#fff}
.pitch-root .slide-h2{font-size:clamp(26px,3vw,44px);font-weight:900;letter-spacing:-.025em;line-height:1.1;margin-bottom:10px;color:#fff}
.pitch-root .slide-sub{font-size:clamp(14px,1.5vw,18px);color:var(--muted);line-height:1.65;max-width:640px;margin:0 auto 32px}
/* SLIDE 1 — TITLE */
.pitch-root .s1-brand{font-size:clamp(52px,9vw,110px);font-weight:900;letter-spacing:-.04em;line-height:1;margin-bottom:16px;display:block}
.pitch-root .s1-subtitle{font-size:clamp(18px,2.2vw,26px);font-weight:700;color:rgba(255,255,255,.85);margin-bottom:14px}
.pitch-root .s1-tagline{font-size:clamp(14px,1.6vw,19px);color:var(--muted);margin-bottom:48px;font-weight:500}
.pitch-root .s1-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 16px;border-radius:100px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);font-size:12px;font-weight:700;color:rgba(255,255,255,.4);letter-spacing:.06em;text-transform:uppercase}
/* SLIDE 2 — PROBLEM */
.pitch-root .pain-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:32px 0}
.pitch-root .pain-card{border-radius:18px;padding:28px 24px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);text-align:left;position:relative;overflow:hidden}
.pitch-root .pain-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
.pitch-root .pain-card.red::before{background:linear-gradient(90deg,#ef4444,#f97316)}
.pitch-root .pain-card.amber::before{background:linear-gradient(90deg,#F59E0B,#eab308)}
.pitch-root .pain-card.blue::before{background:linear-gradient(90deg,#3b82f6,#06B6D4)}
.pitch-root .pain-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.pitch-root .pain-title{font-size:19px;font-weight:800;color:#fff;margin-bottom:8px}
.pitch-root .pain-body{font-size:14px;color:var(--muted);line-height:1.65}
.pitch-root .pain-stat{margin-top:32px;padding:16px 24px;border-radius:14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);font-size:15px;color:rgba(255,255,255,.7);line-height:1.6;text-align:center}
.pitch-root .pain-stat strong{color:#fca5a5;font-weight:800}
/* SLIDE 3 — SOLUTION */
.pitch-root .pipeline-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:16px;margin:32px 0}
.pitch-root .pip-node{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;position:relative}
.pitch-root .pip-node:not(:last-child)::after{content:'';position:absolute;top:24px;left:calc(50% + 26px);width:calc(100% - 52px);height:2px;background:linear-gradient(90deg,rgba(139,92,246,.4),rgba(6,182,212,.3))}
.pitch-root .pip-icon-wrap{width:52px;height:52px;border-radius:14px;border:1.5px solid rgba(139,92,246,.4);background:rgba(139,92,246,.1);display:flex;align-items:center;justify-content:center;position:relative}
.pitch-root .pip-icon-wrap svg{width:22px;height:22px;color:#a78bfa}
.pitch-root .pip-num{position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#8B5CF6,#06B6D4);border:2px solid var(--bg);font-size:8px;font-weight:900;color:#fff;display:flex;align-items:center;justify-content:center}
.pitch-root .pip-label{font-size:12px;font-weight:800;color:#c4b5fd}
.pitch-root .pip-desc{font-size:11px;color:var(--muted);line-height:1.5;max-width:110px}
.pitch-root .sol-footer{font-size:16px;font-weight:700;color:rgba(255,255,255,.7);margin-top:8px}
.pitch-root .sol-footer span{color:#67e8f9}
/* SLIDE 4 — PERFORMANCE */
.pitch-root .big-stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:28px 0}
.pitch-root .big-stat{text-align:center;padding:20px 12px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
.pitch-root .big-stat-val{font-size:clamp(28px,3.5vw,42px);font-weight:900;letter-spacing:-.03em;display:block;margin-bottom:4px}
.pitch-root .big-stat-lbl{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.pitch-root .result-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:8px}
.pitch-root .result-card{border-radius:16px;padding:20px 22px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);text-align:left}
.pitch-root .result-topic{font-size:13px;font-weight:800;color:#c4b5fd;margin-bottom:12px;display:flex;align-items:center;gap:7px}
.pitch-root .result-metrics{display:flex;flex-wrap:wrap;gap:8px}
.pitch-root .result-metric{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:rgba(241,245,249,.8)}
.pitch-root .result-metric .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.pitch-root .perf-footer{margin-top:14px;text-align:center;font-size:14px;font-weight:700;color:var(--muted)}
.pitch-root .perf-footer span{color:#34d399}
/* SLIDE 5 — MARKET */
.pitch-root .market-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:28px 0}
.pitch-root .market-card{border-radius:18px;padding:26px 22px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);text-align:left}
.pitch-root .market-card.featured{background:rgba(139,92,246,.07);border-color:rgba(139,92,246,.3)}
.pitch-root .market-icon{width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.pitch-root .market-title{font-size:18px;font-weight:800;color:#fff;margin-bottom:8px}
.pitch-root .market-body{font-size:13px;color:var(--muted);line-height:1.65}
.pitch-root .market-footer{margin-top:28px;padding:14px 20px;border-radius:12px;background:rgba(6,182,212,.08);border:1px solid rgba(6,182,212,.2);font-size:14px;color:rgba(255,255,255,.7);text-align:center;line-height:1.55}
.pitch-root .market-footer strong{color:#67e8f9}
/* SLIDE 6 — PRICING */
.pitch-root .pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:24px 0}
.pitch-root .pr-card{border-radius:18px;padding:24px 20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);text-align:left;position:relative;overflow:hidden}
.pitch-root .pr-card.featured{background:rgba(139,92,246,.07);border-color:rgba(139,92,246,.35)}
.pitch-root .pr-card.featured::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--grad)}
.pitch-root .pr-badge{display:inline-flex;padding:2px 10px;border-radius:12px;font-size:9px;font-weight:800;letter-spacing:.08em;margin-bottom:10px;background:rgba(99,102,241,.18);border:1px solid rgba(99,102,241,.35);color:#a5b4fc}
.pitch-root .pr-name{font-size:22px;font-weight:900;color:#fff;margin-bottom:4px}
.pitch-root .pr-price{font-size:36px;font-weight:900;letter-spacing:-.03em;color:#fff;margin-bottom:12px}
.pitch-root .pr-price span{font-size:14px;font-weight:500;color:var(--muted)}
.pitch-root .pr-features{list-style:none;display:flex;flex-direction:column;gap:7px;font-size:13px;color:rgba(241,245,249,.75)}
.pitch-root .pr-features li{display:flex;align-items:center;gap:8px}
.pitch-root .pr-check{width:15px;height:15px;border-radius:4px;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pitch-root .pr-feat-table{margin-top:24px;width:100%;border-collapse:collapse;font-size:13px}
.pitch-root .pr-feat-table th{padding:8px 14px;text-align:left;font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.07)}
.pitch-root .pr-feat-table th:not(:first-child){text-align:center}
.pitch-root .pr-feat-table td{padding:9px 14px;border-bottom:1px solid rgba(255,255,255,.04);color:rgba(241,245,249,.8)}
.pitch-root .pr-feat-table td:not(:first-child){text-align:center;font-weight:700;color:#c4b5fd}
/* SLIDE 7 — BUSINESS MODEL */
.pitch-root .biz-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:28px 0;width:100%;max-width:860px;margin-left:auto;margin-right:auto}
.pitch-root .biz-card{border-radius:18px;padding:26px 24px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);text-align:left}
.pitch-root .biz-val{font-size:38px;font-weight:900;letter-spacing:-.03em;margin-bottom:4px}
.pitch-root .biz-label{font-size:14px;font-weight:700;color:var(--muted);margin-bottom:10px}
.pitch-root .biz-desc{font-size:13px;color:rgba(255,255,255,.55);line-height:1.6}
.pitch-root .biz-upsell{margin-top:28px;padding:20px 24px;border-radius:16px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.25);max-width:860px;margin-left:auto;margin-right:auto;width:100%}
.pitch-root .biz-upsell-title{font-size:14px;font-weight:800;color:#c4b5fd;margin-bottom:10px}
.pitch-root .biz-upsell-row{display:flex;align-items:center;gap:12px;font-size:13px;color:rgba(255,255,255,.65)}
.pitch-root .upsell-step{padding:6px 14px;border-radius:20px;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.3);color:#c4b5fd;font-weight:700;font-size:12px;white-space:nowrap}
.pitch-root .upsell-arrow{color:rgba(139,92,246,.5);font-size:16px}
/* SLIDE 8 — TRACTION */
.pitch-root .traction-layout{display:grid;grid-template-columns:1fr 1fr;gap:28px;width:100%;max-width:900px;margin:0 auto}
.pitch-root .traction-done{border-radius:18px;padding:28px 24px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);text-align:left}
.pitch-root .traction-next{border-radius:18px;padding:28px 24px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);text-align:left}
.pitch-root .traction-section-title{font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px}
.pitch-root .traction-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:14px;color:rgba(241,245,249,.8)}
.pitch-root .traction-item:last-child{border-bottom:none}
.pitch-root .traction-check{width:20px;height:20px;border-radius:6px;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.pitch-root .traction-circle{width:20px;height:20px;border-radius:50%;background:rgba(139,92,246,.15);border:1.5px solid rgba(139,92,246,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
/* SLIDE 9 — ASK */
.pitch-root .ask-center{max-width:760px;margin:0 auto;width:100%}
.pitch-root .ask-amount{font-size:clamp(48px,7vw,80px);font-weight:900;letter-spacing:-.04em;line-height:1;display:block;margin-bottom:6px}
.pitch-root .ask-equiv{font-size:18px;font-weight:600;color:var(--muted);margin-bottom:36px}
.pitch-root .use-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:28px}
.pitch-root .use-card{border-radius:16px;padding:22px 18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);text-align:left}
.pitch-root .use-pct{font-size:36px;font-weight:900;letter-spacing:-.03em;margin-bottom:6px}
.pitch-root .use-title{font-size:15px;font-weight:800;color:#fff;margin-bottom:6px}
.pitch-root .use-desc{font-size:13px;color:var(--muted);line-height:1.55}
/* SLIDE 10 — CLOSE */
.pitch-root .close-inner{max-width:700px;margin:0 auto;width:100%}
.pitch-root .close-cta-row{display:flex;gap:14px;justify-content:center;margin:32px 0}
.pitch-root .close-btn{display:inline-flex;align-items:center;gap:8px;padding:14px 32px;border-radius:12px;font-family:'Inter',sans-serif;font-size:15px;font-weight:800;cursor:pointer;text-decoration:none;transition:all .25s}
.pitch-root .close-btn.primary{background:linear-gradient(135deg,#8B5CF6,#6366F1);color:#fff;border:none;box-shadow:0 8px 32px rgba(139,92,246,.4)}
.pitch-root .close-btn.primary:hover{opacity:.9;transform:translateY(-2px);box-shadow:0 14px 48px rgba(139,92,246,.55)}
.pitch-root .close-btn.secondary{background:transparent;color:rgba(255,255,255,.75);border:1px solid rgba(255,255,255,.18)}
.pitch-root .close-btn.secondary:hover{border-color:rgba(255,255,255,.35);color:#fff;background:rgba(255,255,255,.05)}
.pitch-root .close-contact{font-size:16px;color:var(--muted);margin-top:8px}
.pitch-root .close-contact a{color:#a78bfa;text-decoration:none;font-weight:700}
.pitch-root .close-contact a:hover{text-decoration:underline}
/* KEYBOARD HINT */
.pitch-root .kbd-hint{font-size:11px;color:var(--dim);display:flex;align-items:center;gap:6px}
.pitch-root .kbd{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;padding:0 5px;border-radius:4px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);font-size:10px;font-weight:700;color:rgba(255,255,255,.5)}
`

/* ---- SVG ICONS ---- */
const IconTrendPulse = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/>
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12" y2="20"/>
  </svg>
)
const IconResearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconStrategy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
)
const IconCreate = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
  </svg>
)
const IconQA = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
  </svg>
)
const IconPublish = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
const IconCheck = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const IconArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
)
const IconArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
)
const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
)
const IconCircleDot = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
  </svg>
)
const IconBuilding = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)
const IconDollar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
)
const IconGlobe = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

/* ---- SLIDES ---- */

function Slide1({ brand }: { brand: string }) {
  return (
    <div className="slide-inner" style={{ textAlign: 'center' }}>
      <div className="slide-tag">Investor Briefing · 2026</div>
      <span className="s1-brand grad-text">{brand}</span>
      <div className="s1-subtitle">The AI Content Engine for Real Estate Publishers</div>
      <div className="s1-tagline">Trend to published post — 5 platforms — under 90 seconds.</div>
      <div className="s1-badge">Confidential · For Accredited Investors Only</div>
    </div>
  )
}

function Slide2() {
  return (
    <div className="slide-inner" style={{ textAlign: 'left', maxWidth: 1000 }}>
      <div className="slide-tag left-tag">The Problem</div>
      <h2 className="slide-h2">Real estate publishers are stuck in 2015.</h2>
      <div className="pain-grid">
        <div className="pain-card red">
          <div className="pain-icon" style={{ background: 'rgba(239,68,68,.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div className="pain-title">Manual &amp; Slow</div>
          <div className="pain-body">A content team takes 4–6 hours per trend. By the time they publish, the trend is dead.</div>
        </div>
        <div className="pain-card amber">
          <div className="pain-icon" style={{ background: 'rgba(245,158,11,.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div className="pain-title">Expensive</div>
          <div className="pain-body">Agency: $45/post · In-house writer: $22/post · 5 platforms = $110–225 per topic. Every. Single. Day.</div>
        </div>
        <div className="pain-card blue">
          <div className="pain-icon" style={{ background: 'rgba(59,130,246,.12)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="pain-title">Generic</div>
          <div className="pain-body">Same copy, same angle, same hashtags. No platform-native voice. Engagement tanks.</div>
        </div>
      </div>
      <div className="pain-stat">
        <strong>Real estate publishers spend 60% of marketing budget</strong> on content that performs <strong>40% below industry benchmark.</strong>
      </div>
    </div>
  )
}

function Slide3({ brand }: { brand: string }) {
  const stages = [
    { num: 1, Icon: IconTrendPulse, label: 'Trend Pulse', desc: 'Scans 15 sources for breaking trends' },
    { num: 2, Icon: IconResearch, label: 'Research', desc: 'Extracts story intelligence from news' },
    { num: 3, Icon: IconStrategy, label: 'Strategy', desc: 'Crafts platform-specific angles' },
    { num: 4, Icon: IconCreate, label: 'Create', desc: 'Generates native posts for each platform' },
    { num: 5, Icon: IconQA, label: 'Quality Gate', desc: 'Brand safety + quality scoring' },
    { num: 6, Icon: IconPublish, label: 'Publish', desc: 'Live across 5 platforms in one run' },
  ]
  return (
    <div className="slide-inner" style={{ textAlign: 'left', maxWidth: 1080 }}>
      <div className="slide-tag left-tag">Our Solution</div>
      <h2 className="slide-h2">Introduce <span className="grad-text">{brand}.</span></h2>
      <p style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 0, maxWidth: 600 }}>
        An autonomous AI content pipeline purpose-built for real estate.
      </p>
      <div className="pipeline-grid">
        {stages.map(({ num, Icon, label, desc }) => (
          <div className="pip-node" key={num}>
            <div className="pip-icon-wrap">
              <span className="pip-num">{num}</span>
              <Icon />
            </div>
            <div className="pip-label">{label}</div>
            <div className="pip-desc">{desc}</div>
          </div>
        ))}
      </div>
      <div className="sol-footer" style={{ textAlign: 'center' }}>
        End-to-end. Fully automated. <span>Always on.</span>
      </div>
    </div>
  )
}

function Slide4() {
  return (
    <div className="slide-inner" style={{ textAlign: 'left', maxWidth: 1000 }}>
      <div className="slide-tag left-tag">Live Results</div>
      <h2 className="slide-h2">Numbers from actual pipeline runs.</h2>
      <div className="big-stat-row">
        <div className="big-stat">
          <span className="big-stat-val grad-text">97s</span>
          <div className="big-stat-lbl">Total run time</div>
        </div>
        <div className="big-stat">
          <span className="big-stat-val" style={{ color: '#34d399' }}>8.9/10</span>
          <div className="big-stat-lbl">Avg quality score</div>
        </div>
        <div className="big-stat">
          <span className="big-stat-val" style={{ color: '#a78bfa' }}>321×</span>
          <div className="big-stat-lbl">Cheaper than agency</div>
        </div>
        <div className="big-stat">
          <span className="big-stat-val" style={{ color: '#38bdf8' }}>5</span>
          <div className="big-stat-lbl">Platforms per run</div>
        </div>
      </div>
      <div className="result-grid">
        <div className="result-card">
          <div className="result-topic">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
            #RERA Notice — Maharashtra
          </div>
          <div className="result-metrics">
            <div className="result-metric"><div className="dot" style={{ background: '#1da1f2' }} />Twitter · 1.2K likes</div>
            <div className="result-metric"><div className="dot" style={{ background: '#e1306c' }} />Instagram · 3.8K likes</div>
            <div className="result-metric"><div className="dot" style={{ background: '#0a66c2' }} />LinkedIn · 2.4K reactions</div>
            <div className="result-metric"><div className="dot" style={{ background: '#06B6D4' }} />97s total</div>
          </div>
        </div>
        <div className="result-card">
          <div className="result-topic">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
            IPL × Real Estate angle
          </div>
          <div className="result-metrics">
            <div className="result-metric"><div className="dot" style={{ background: '#1da1f2' }} />Twitter · 48K impressions</div>
            <div className="result-metric"><div className="dot" style={{ background: '#0a66c2' }} />LinkedIn · 312 shares</div>
          </div>
        </div>
      </div>
      <div className="perf-footer">Zero human hours. <span>Zero editorial oversight needed.</span></div>
    </div>
  )
}

function Slide5() {
  return (
    <div className="slide-inner" style={{ textAlign: 'left', maxWidth: 1000 }}>
      <div className="slide-tag left-tag">Market Opportunity</div>
      <h2 className="slide-h2">A <span className="grad-text">$2B+</span> manual process waiting to be automated.</h2>
      <div className="market-grid">
        <div className="market-card featured">
          <div className="market-icon" style={{ background: 'rgba(139,92,246,.15)' }}>
            <IconBuilding />
          </div>
          <div className="market-title">Real Estate Media</div>
          <div className="market-body">8,000+ property portals globally. Each publishing 50–200 posts/month. Content is their #1 growth lever.</div>
        </div>
        <div className="market-card">
          <div className="market-icon" style={{ background: 'rgba(6,182,212,.12)' }}>
            <IconDollar />
          </div>
          <div className="market-title">PropTech Marketing</div>
          <div className="market-body">$42B RE marketing spend in India alone. Content is the fastest-growing line item.</div>
        </div>
        <div className="market-card">
          <div className="market-icon" style={{ background: 'rgba(16,185,129,.12)' }}>
            <IconGlobe />
          </div>
          <div className="market-title">Adjacent Markets</div>
          <div className="market-body">Auto, travel, BFSI — every vertical with high-volume, trend-driven content needs.</div>
        </div>
      </div>
      <div className="market-footer">
        We're starting with real estate. <strong>Expanding to every trend-driven vertical.</strong>
      </div>
    </div>
  )
}

function Slide6({ brand }: { brand: string }) {
  const plans = [
    {
      name: 'Spark', price: 39, features: ['150 posts/mo', 'Single region', 'Single language'],
      badge: null, featured: false,
    },
    {
      name: 'Growth', price: 129, features: ['600 posts/mo', 'Country-wide coverage', '2 languages'],
      badge: 'POPULAR', featured: true,
    },
    {
      name: 'Scale', price: 449, features: ['2,500 posts/mo', 'Global coverage', 'Unlimited languages + dialects'],
      badge: 'BEST VALUE', featured: false,
    },
  ]
  return (
    <div className="slide-inner" style={{ textAlign: 'left', maxWidth: 1000 }}>
      <div className="slide-tag left-tag">Pricing</div>
      <h2 className="slide-h2">Pricing built to scale with the publisher.</h2>
      <div className="pricing-grid">
        {plans.map(p => (
          <div className={`pr-card${p.featured ? ' featured' : ''}`} key={p.name}>
            {p.badge && <div className="pr-badge">{p.badge}</div>}
            <div className="pr-name" style={p.featured ? { background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } : {}}>
              {p.name}
            </div>
            <div className="pr-price">${p.price}<span>/mo</span></div>
            <ul className="pr-features">
              {p.features.map(f => (
                <li key={f}>
                  <div className="pr-check"><IconCheck /></div>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table className="pr-feat-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Spark</th>
              <th>Growth</th>
              <th>Scale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ color: 'var(--muted)' }}>Regional coverage</td>
              <td>Local</td><td>Country</td><td>Global</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--muted)' }}>Language</td>
              <td>Single</td><td>2 languages</td><td>Unlimited + dialects</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--muted)' }}>Per-post rate</td>
              <td>$0.26</td><td>$0.22</td><td>$0.18</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: 'var(--dim)', marginTop: 10, textAlign: 'center' }}>
        {brand} is 321× cheaper than agency rates at every tier.
      </p>
    </div>
  )
}

function Slide7() {
  return (
    <div className="slide-inner" style={{ textAlign: 'center', maxWidth: 900 }}>
      <div className="slide-tag">Business Model</div>
      <h2 className="slide-h2">SaaS + Usage. Sticky. Scalable.</h2>
      <div className="biz-grid">
        <div className="biz-card">
          <div className="biz-val grad-text">$12,900</div>
          <div className="biz-label">MRR @ 100 Growth customers</div>
          <div className="biz-desc">Average contract value grows as publishers scale from local to national to global coverage.</div>
        </div>
        <div className="biz-card">
          <div className="biz-val" style={{ color: '#34d399' }}>~82%</div>
          <div className="biz-label">Gross margin</div>
          <div className="biz-desc">AI compute + API costs per run ≈ $0.04/post. Most cost is fixed infra, not variable compute.</div>
        </div>
        <div className="biz-card">
          <div className="biz-val" style={{ color: '#a78bfa' }}>3×</div>
          <div className="biz-label">Avg upsell multiplier</div>
          <div className="biz-desc">Regional publishers naturally expand to national as they see ROI — ACV triples within 12 months.</div>
        </div>
        <div className="biz-card">
          <div className="biz-val" style={{ color: '#38bdf8' }}>321×</div>
          <div className="biz-label">vs. agency cost</div>
          <div className="biz-desc">At $0.18/post on Scale, customers save $225 per topic vs. agency rates. ROI sells itself.</div>
        </div>
      </div>
      <div className="biz-upsell">
        <div className="biz-upsell-title">Natural upsell path — no sales pressure needed</div>
        <div className="biz-upsell-row">
          <span className="upsell-step">Regional · Spark</span>
          <span className="upsell-arrow">→</span>
          <span className="upsell-step">National · Growth</span>
          <span className="upsell-arrow">→</span>
          <span className="upsell-step">Global · Scale</span>
          <span className="upsell-arrow">→</span>
          <span className="upsell-step">Enterprise · Command</span>
        </div>
      </div>
    </div>
  )
}

function Slide8() {
  const done = [
    'Pipeline built and running end-to-end',
    '5 platform integrations (Twitter, Instagram, LinkedIn, YouTube, News)',
    'Quality scoring system with auto-revision',
    'Multi-region + multi-language support',
    'Web dashboard with analytics + live feed',
  ]
  const next = [
    'Sales motion — first 50 publisher contracts',
    'Enterprise feature set + white-label option',
    'Public API product + developer docs',
    'Global expansion beyond India',
  ]
  return (
    <div className="slide-inner" style={{ textAlign: 'center', maxWidth: 900 }}>
      <div className="slide-tag">Traction</div>
      <h2 className="slide-h2">Built. Tested. <span className="grad-text">Real.</span></h2>
      <div className="traction-layout">
        <div className="traction-done">
          <div className="traction-section-title" style={{ color: '#34d399' }}>
            <span style={{ marginRight: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            Completed
          </div>
          {done.map(item => (
            <div className="traction-item" key={item}>
              <div className="traction-check"><IconCheck /></div>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className="traction-next">
          <div className="traction-section-title" style={{ color: '#a78bfa' }}>
            <span style={{ marginRight: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </span>
            Funded Milestones
          </div>
          {next.map(item => (
            <div className="traction-item" key={item}>
              <div className="traction-circle">
                <IconCircleDot />
              </div>
              <span style={{ color: 'var(--muted)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Slide9() {
  const buckets = [
    {
      pct: '40%', color: '#8B5CF6',
      title: 'Sales & GTM',
      desc: 'First 50 publisher contracts, content marketing, conference presence, outbound motion.',
    },
    {
      pct: '35%', color: '#06B6D4',
      title: 'Product',
      desc: 'Enterprise features, public API, white-label offering, multi-tenant architecture.',
    },
    {
      pct: '25%', color: '#10B981',
      title: 'Infrastructure & Scale',
      desc: 'Global CDN, 99.9% uptime SLA, compliance, security audits, DevOps headcount.',
    },
  ]
  return (
    <div className="slide-inner" style={{ textAlign: 'center' }}>
      <div className="slide-tag">The Ask</div>
      <h2 className="slide-h2">What we need to win.</h2>
      <div className="ask-center">
        <span className="ask-amount grad-text">Seed Round · ₹2 Cr</span>
        <div className="ask-equiv">~$250,000 USD</div>
        <div className="use-grid">
          {buckets.map(b => (
            <div className="use-card" key={b.title}>
              <div className="use-pct" style={{ color: b.color }}>{b.pct}</div>
              <div className="use-title">{b.title}</div>
              <div className="use-desc">{b.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7 }}>
          Target: 50 paying publisher contracts within 6 months of close.<br />
          Path to $150K ARR in Year 1 at current pricing.
        </div>
      </div>
    </div>
  )
}

function Slide10({ brand }: { brand: string }) {
  return (
    <div className="slide-inner" style={{ textAlign: 'center' }}>
      <div className="slide-tag">Let's Build</div>
      <h1 className="slide-h1" style={{ maxWidth: 700, margin: '0 auto 14px' }}>
        Let's build the future of<br />
        <span className="grad-text">real estate publishing.</span>
      </h1>
      <p className="slide-sub">
        The pipeline is live. The results are real. We're ready to scale.
      </p>
      <div className="close-inner">
        <div className="close-cta-row">
          <a href="/demo" className="close-btn primary">
            View Live Demo <IconChevronRight />
          </a>
          <a href="/" className="close-btn secondary">
            Back to Homepage
          </a>
        </div>
        <div className="close-contact">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--muted)' }}>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <a href="mailto:a.sachin533@gmail.com">a.sachin533@gmail.com</a>
        </div>
        <div style={{ marginTop: 40, fontSize: 12, color: 'var(--dim)', letterSpacing: '.04em' }}>
          {brand} · Confidential · For Accredited Investors Only
        </div>
      </div>
    </div>
  )
}

/* ---- MAIN COMPONENT ---- */

export default function Pitch() {
  const brand = useBrandName()
  const navigate = useNavigate()
  const [currentSlide, setCurrentSlide] = useState(0)

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= TOTAL_SLIDES) return
    setCurrentSlide(idx)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'j') goTo(currentSlide + 1)
      if (e.key === 'ArrowLeft' || e.key === 'k') goTo(currentSlide - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentSlide])

  const slides = [
    <Slide1 brand={brand} key={0} />,
    <Slide2 key={1} />,
    <Slide3 brand={brand} key={2} />,
    <Slide4 key={3} />,
    <Slide5 key={4} />,
    <Slide6 brand={brand} key={5} />,
    <Slide7 key={6} />,
    <Slide8 key={7} />,
    <Slide9 key={8} />,
    <Slide10 brand={brand} key={9} />,
  ]

  const progressPct = ((currentSlide + 1) / TOTAL_SLIDES) * 100

  return (
    <div className="pitch-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* AMBIENT BACKGROUND */}
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />
      <div className="dot-grid" />

      {/* PROGRESS BAR */}
      <div className="pt-progress">
        <div className="pt-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* TOP BAR */}
      <div className="pt-topbar">
        <div className="pt-topbar-left">
          <span className="pt-brand">{brand}</span>
          <span className="pt-confidential">Investor Deck</span>
        </div>
        <button
          className="pt-exit-btn"
          onClick={() => navigate('/dashboard')}
          title="Exit presentation"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Exit
        </button>
      </div>

      {/* SLIDE TRACK */}
      <div
        className="pt-track"
        style={{ transform: `translateX(${-currentSlide * 100}vw)` }}
      >
        {slides.map((slide, i) => (
          <div className="pt-slide" key={i}>
            {slide}
          </div>
        ))}
      </div>

      {/* BOTTOM NAV */}
      <div className="pt-bottom">
        <div className="kbd-hint">
          <span className="kbd">←</span><span className="kbd">→</span>
          &nbsp;or&nbsp;
          <span className="kbd">j</span><span className="kbd">k</span>
          &nbsp;to navigate
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div className="pt-dots">
            {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
              <button
                key={i}
                className={`pt-dot${i === currentSlide ? ' active' : ''}`}
                onClick={() => goTo(i)}
                title={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <div className="pt-nav-arrows">
            <button
              className="pt-arrow"
              onClick={() => goTo(currentSlide - 1)}
              disabled={currentSlide === 0}
              title="Previous slide"
            >
              <IconArrowLeft />
            </button>
            <button
              className="pt-arrow"
              onClick={() => goTo(currentSlide + 1)}
              disabled={currentSlide === TOTAL_SLIDES - 1}
              title="Next slide"
            >
              <IconArrowRight />
            </button>
          </div>
        </div>

        <div className="pt-counter">
          {currentSlide + 1} / {TOTAL_SLIDES}
        </div>
      </div>
    </div>
  )
}
