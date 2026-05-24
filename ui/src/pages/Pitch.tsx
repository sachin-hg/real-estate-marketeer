import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBrandName } from '../lib/useBrandName'

const TOTAL_SLIDES = 11

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
.pitch-root .pt-track{position:fixed;inset:0;z-index:2;display:flex;transition:transform .5s cubic-bezier(.4,0,.2,1)}
/* SLIDE */
.pitch-root .pt-slide{width:100vw;height:100vh;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:80px 60px 100px;overflow:hidden;position:relative}
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
.pitch-root .s1-inner::before{content:'';position:absolute;inset:-55% -65%;background:radial-gradient(ellipse at center,rgba(7,7,26,.98) 0%,rgba(7,7,26,.93) 28%,rgba(7,7,26,.72) 52%,rgba(7,7,26,.28) 72%,transparent 88%);z-index:-1;pointer-events:none}
.pitch-root .demo-title-box::before{content:'';position:absolute;inset:-32px -56px -40px;background:radial-gradient(ellipse at center,rgba(7,7,26,.93) 0%,rgba(7,7,26,.78) 38%,rgba(7,7,26,.38) 65%,transparent 85%);z-index:-1;pointer-events:none;border-radius:40%}
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
.pitch-root .traction-section-title{font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:6px}
.pitch-root .traction-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:14px;color:rgba(241,245,249,.8)}
.pitch-root .traction-item:last-child{border-bottom:none}
.pitch-root .traction-check{width:20px;height:20px;border-radius:6px;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.pitch-root .traction-circle{width:20px;height:20px;border-radius:50%;background:rgba(139,92,246,.15);border:1.5px solid rgba(139,92,246,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
/* SLIDE 9 — ASK */
.pitch-root .ask-center{max-width:760px;margin:0 auto;width:100%}
.pitch-root .ask-amount{font-size:clamp(48px,7vw,80px);font-weight:900;letter-spacing:-.04em;line-height:1;display:block;margin-bottom:6px}
.pitch-root .ask-equiv{font-size:18px;font-weight:600;color:var(--muted);margin-bottom:36px}
.pitch-root .use-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-bottom:28px}
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
/* BROWNIAN MOTION — SLIDE DEMO */
@keyframes bm1{0%{transform:translate(0px,0px) rotate(0deg)}20%{transform:translate(18px,-13px) rotate(.8deg)}40%{transform:translate(6px,21px) rotate(-.6deg)}60%{transform:translate(-15px,8px) rotate(.4deg)}80%{transform:translate(11px,-17px) rotate(-.3deg)}100%{transform:translate(0px,0px) rotate(0deg)}}
@keyframes bm2{0%{transform:translate(0px,0px) rotate(0deg)}25%{transform:translate(-17px,15px) rotate(-1deg)}50%{transform:translate(21px,-11px) rotate(.5deg)}75%{transform:translate(-9px,19px) rotate(-.7deg)}100%{transform:translate(0px,0px) rotate(0deg)}}
@keyframes bm3{0%{transform:translate(0px,0px) rotate(0deg)}33%{transform:translate(15px,19px) rotate(.6deg)}66%{transform:translate(-21px,-9px) rotate(-.8deg)}100%{transform:translate(0px,0px) rotate(0deg)}}
@keyframes bm4{0%{transform:translate(0px,0px) rotate(0deg)}20%{transform:translate(-22px,-11px) rotate(-1.2deg)}50%{transform:translate(11px,17px) rotate(.9deg)}80%{transform:translate(19px,-9px) rotate(-.4deg)}100%{transform:translate(0px,0px) rotate(0deg)}}
@keyframes bm5{0%{transform:translate(0px,0px) rotate(0deg)}30%{transform:translate(17px,23px) rotate(.7deg)}60%{transform:translate(-13px,-17px) rotate(-1deg)}100%{transform:translate(0px,0px) rotate(0deg)}}
@keyframes bm6{0%{transform:translate(0px,0px) rotate(0deg)}25%{transform:translate(-19px,13px) rotate(-.5deg)}50%{transform:translate(23px,7px) rotate(.9deg)}75%{transform:translate(-7px,-21px) rotate(-.6deg)}100%{transform:translate(0px,0px) rotate(0deg)}}
@keyframes bm7{0%{transform:translate(0px,0px) rotate(0deg)}20%{transform:translate(13px,-23px) rotate(1deg)}40%{transform:translate(-19px,11px) rotate(-.7deg)}60%{transform:translate(21px,17px) rotate(.4deg)}80%{transform:translate(-9px,-13px) rotate(-.9deg)}100%{transform:translate(0px,0px) rotate(0deg)}}
@keyframes bm8{0%{transform:translate(0px,0px) rotate(0deg)}33%{transform:translate(-21px,-15px) rotate(-.8deg)}66%{transform:translate(17px,21px) rotate(.6deg)}100%{transform:translate(0px,0px) rotate(0deg)}}
@keyframes bm9{0%{transform:translate(0px,0px) rotate(0deg)}25%{transform:translate(21px,11px) rotate(.5deg)}50%{transform:translate(-15px,-21px) rotate(-1deg)}75%{transform:translate(9px,19px) rotate(.8deg)}100%{transform:translate(0px,0px) rotate(0deg)}}
.pitch-root .demo-space{position:relative;flex:1;width:100%;overflow:hidden;display:flex;align-items:center}
.pitch-root .demo-card{position:absolute;width:196px;padding:12px 14px;border-radius:14px;background:rgba(7,7,26,0.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);cursor:default;transition:box-shadow .3s}
.pitch-root .demo-card:hover{z-index:10}
.pitch-root .demo-platform{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;letter-spacing:.02em}
.pitch-root .demo-live{display:flex;align-items:center;gap:4px;font-size:9px;font-weight:800;color:#10B981}
.pitch-root .demo-dot{width:5px;height:5px;border-radius:50%;background:#10B981;animation:pulse-dot 2s ease-in-out infinite}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.7)}}
@keyframes story-bar-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes carousel-fade-in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}
.pitch-root .demo-text{font-size:11.5px;color:rgba(241,245,249,.88);line-height:1.55;margin:8px 0 10px}
.pitch-root .demo-stats{display:flex;gap:10px;font-size:10px;color:#475569;border-top:1px solid rgba(255,255,255,.06);padding-top:8px;align-items:center}
.pitch-root .demo-stat{display:flex;align-items:center;gap:3px}
@keyframes sd-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.pitch-root .demo-mob{display:none}
.pitch-root .sd-marquee-track{display:flex;flex-wrap:nowrap;align-items:flex-start;animation:sd-marquee 60s linear infinite;padding:28px 0}
.pitch-root .sd-marquee-col{display:flex;flex-direction:column;gap:14px;flex-shrink:0;margin-right:14px}
/* ---- MOBILE ---- */
@media (max-width:768px){
  .pitch-root .pt-topbar{padding:10px 16px 0}
  .pitch-root .pt-brand{font-size:17px}
  .pitch-root .pt-confidential{display:none}
  .pitch-root .pt-exit-btn{padding:6px 12px;font-size:12px}
  .pitch-root .pt-track{transform:none !important;display:block !important;overflow-y:scroll;scroll-snap-type:y mandatory;-webkit-overflow-scrolling:touch}
  .pitch-root .pt-slide{padding:60px 20px 80px;align-items:flex-start;justify-content:flex-start;overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always}
  .pitch-root .slide-inner{margin-top:auto;margin-bottom:auto}
  .pitch-root .pt-bottom{padding:0 16px 10px}
  .pitch-root .pt-arrow{width:36px;height:36px}
  .pitch-root .pt-dots{gap:4px}
  .pitch-root .pt-dot{width:5px;height:5px}
  .pitch-root .pt-dot.active{width:14px}
  .pitch-root .kbd-hint{display:none}
  .pitch-root .pt-counter{font-size:11px}
  .pitch-root .slide-tag{margin-bottom:10px;font-size:10px}
  .pitch-root .slide-sub{margin-bottom:14px;font-size:13px}
  .pitch-root .s1-tagline{margin-bottom:20px;font-size:11px}
  .pitch-root .s1-badge{font-size:9px;padding:4px 10px;letter-spacing:.04em}
  /* Problem */
  .pitch-root .pain-grid{grid-template-columns:1fr;gap:10px;margin:12px 0}
  .pitch-root .pain-card{padding:16px 14px;border-radius:14px;display:grid;grid-template-columns:36px 1fr;column-gap:10px;row-gap:4px;align-items:center}
  .pitch-root .pain-icon{width:36px;height:36px;border-radius:10px;margin-bottom:0}
  .pitch-root .pain-title{font-size:14px;margin-bottom:0}
  .pitch-root .pain-body{font-size:12px;line-height:1.5;grid-column:1/-1}
  .pitch-root .pain-stat{margin-top:12px;padding:12px 16px;font-size:12px}
  /* Solution */
  .pitch-root .pipeline-grid{grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
  .pitch-root .pip-node:not(:last-child)::after{display:none}
  .pitch-root .pip-icon-wrap{width:44px;height:44px;border-radius:12px}
  .pitch-root .pip-label{font-size:10px}
  .pitch-root .pip-desc{font-size:9px;max-width:80px}
  .pitch-root .sol-feedback-body{display:none}
  .pitch-root .sol-footer{font-size:12px;margin-top:8px}
  /* Performance */
  .pitch-root .big-stat-row{grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 0}
  .pitch-root .big-stat{padding:10px 8px}
  .pitch-root .big-stat-lbl{font-size:9px;letter-spacing:.05em}
  .pitch-root .result-metric{font-size:10px;padding:3px 8px}
  .pitch-root .result-grid{grid-template-columns:1fr;gap:10px}
  .pitch-root .result-card{padding:14px 16px}
  .pitch-root .perf-footer{margin-top:10px;font-size:12px}
  /* Market */
  .pitch-root .market-grid{grid-template-columns:1fr;gap:10px;margin:12px 0}
  .pitch-root .market-card{padding:14px 14px;border-radius:14px;display:grid;grid-template-columns:34px 1fr;column-gap:10px;row-gap:4px;align-items:center}
  .pitch-root .market-icon{width:34px;height:34px;border-radius:10px;margin-bottom:0}
  .pitch-root .market-title{font-size:14px;margin-bottom:0}
  .pitch-root .market-body{font-size:12px;line-height:1.5;grid-column:1/-1}
  .pitch-root .market-footer{padding:10px 14px;font-size:12px;margin-top:14px;border-radius:10px}
  /* Pricing */
  .pitch-root .pricing-grid{grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}
  .pitch-root .pr-card{padding:10px 12px;border-radius:12px}
  .pitch-root .pr-card:last-child{grid-column:1/-1}
  .pitch-root .pr-name{font-size:16px;margin-bottom:2px}
  .pitch-root .pr-price{font-size:22px;margin-bottom:6px}
  .pitch-root .pr-features{gap:4px;font-size:11px}
  .pitch-root .pr-badge{margin-bottom:6px}
  .pitch-root .pr-feat-table{display:none}
  .pitch-root .pr-footnote{display:none}
  /* Business model — 2-col to save vertical space */
  .pitch-root .biz-grid{grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
  .pitch-root .biz-card{padding:14px 12px;border-radius:14px}
  .pitch-root .biz-val{font-size:24px;margin-bottom:2px}
  .pitch-root .biz-label{font-size:11px;margin-bottom:6px}
  .pitch-root .biz-desc{font-size:10px;line-height:1.4}
  .pitch-root .biz-upsell{padding:12px 14px;margin-top:12px;border-radius:12px}
  .pitch-root .biz-upsell-title{font-size:12px;margin-bottom:8px}
  .pitch-root .biz-upsell-row{flex-wrap:wrap;gap:6px}
  .pitch-root .upsell-step{padding:4px 10px;font-size:10px}
  /* Traction */
  .pitch-root .traction-layout{grid-template-columns:1fr;gap:10px}
  .pitch-root .traction-done,.pitch-root .traction-next{padding:16px 14px;border-radius:14px}
  .pitch-root .traction-item{font-size:12px;padding:7px 0}
  /* Ask — 2-col use-grid to save vertical space */
  .pitch-root .use-grid{grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
  .pitch-root .use-card{border-radius:12px}
  .pitch-root .ask-equiv{font-size:11px!important;margin-bottom:14px}
  .pitch-root .use-pct{font-size:20px;margin-bottom:0}
  .pitch-root .use-title{font-size:11px;margin-bottom:2px}
  .pitch-root .use-desc{font-size:10px}
  /* Close */
  .pitch-root .close-cta-row{flex-direction:column;align-items:stretch;margin:16px 0;gap:10px}
  .pitch-root .close-btn{justify-content:center;padding:12px 20px;font-size:14px}
  .pitch-root .close-contact{font-size:13px}
  /* SlideDemo: switch to right-to-left marquee on mobile */
  .pitch-root .demo-inner{padding:60px 0 0 !important}
  .pitch-root .demo-desk{display:none !important}
  .pitch-root .demo-mob{display:flex !important;align-items:flex-start}
  .pitch-root .sd-marquee-track{animation-duration:38s}
}
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
const IconLearn = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6"/><path d="M2.5 22v-6h6"/>
    <path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/>
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
    <div className="slide-inner s1-inner" style={{ textAlign: 'center' }}>
      <div className="slide-tag">Investor Briefing · 2026</div>
      <span className="s1-brand grad-text">{brand}</span>
      <div className="s1-subtitle">Built to <span className="grad-text">#TrendJack</span> — every moment, every platform.</div>
      <div className="s1-tagline">Trend to post — 5 platforms — under 90 seconds.</div>
      <div className="s1-badge">Confidential · For Accredited Investors Only</div>
    </div>
  )
}




const SD_POS = [
  { top:'2%',  left:'0%',  anim:'bm1', dur:12, delay:-3  },
  { top:'2%',  left:'19%', anim:'bm2', dur:14, delay:-7  },
  { top:'2%',  left:'38%', anim:'bm3', dur:11, delay:-6  },
  { top:'2%',  left:'57%', anim:'bm4', dur:13, delay:-9  },
  { top:'2%',  left:'77%', anim:'bm5', dur:15, delay:-4  },
  { top:'46%', left:'1%',  anim:'bm6', dur:15, delay:-5  },
  { top:'46%', left:'20%', anim:'bm7', dur:12, delay:-2  },
  { top:'46%', left:'39%', anim:'bm8', dur:13, delay:-4  },
  { top:'46%', left:'57%', anim:'bm9', dur:10, delay:-8  },
  { top:'46%', left:'77%', anim:'bm1', dur:16, delay:-1  },
]

const TW_ICO = <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
const YT_ICO = <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#1a0505"/></svg>

const SD_BASE: React.CSSProperties = { borderRadius:16, backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', cursor:'default' }
const SD_CAP:  React.CSSProperties = { fontSize:11.5, color:'rgba(241,245,249,0.88)', lineHeight:1.55 }
const SD_TAGS: React.CSSProperties = { fontSize:9.5, color:'rgba(167,139,250,0.7)', fontWeight:700 }

/* Smaller gradient CTA pill used in all media blocks */
const GRAD_CTA: React.CSSProperties = {
  flex:1, background:'linear-gradient(90deg,rgba(124,58,237,0.92),rgba(6,182,212,0.88))',
  borderRadius:20, padding:'5px 0', textAlign:'center' as const,
  fontSize:9.5, fontWeight:700, color:'#fff', border:'1px solid rgba(255,255,255,0.18)',
}

function SDLive() {
  return (
    <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:9, color:'#10B981', fontWeight:800 }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:'#10B981', display:'inline-block', animation:'pulse-dot 2s ease-in-out infinite' }} />
      LIVE
    </span>
  )
}

function SDBars({ n, a, dur=2400 }: { n:number; a:number; dur?:number }) {
  return (
    <div style={{ display:'flex', gap:3, marginBottom:8 }}>
      {Array.from({length:n}).map((_,i) => (
        <div key={i} style={{ flex:1, height:2.5, borderRadius:2, background:'rgba(255,255,255,0.22)', position:'relative', overflow:'hidden' }}>
          {i < a && <div style={{ position:'absolute', inset:0, background:'#fff' }} />}
          {i === a && <div key={`fill-${a}`} style={{ position:'absolute', top:0, left:0, bottom:0, width:'100%', background:'#fff', transformOrigin:'left center', animation:`story-bar-fill ${dur}ms linear forwards` }} />}
        </div>
      ))}
    </div>
  )
}

function SDDots({ n, a, c }: { n:number; a:number; c:string }) {
  return (
    <div style={{ display:'flex', gap:5, justifyContent:'center', marginTop:7 }}>
      {Array.from({length:n}).map((_,i) => (
        <div key={i} style={{ width:i===a?14:5, height:5, borderRadius:i===a?3:10, background: i===a ? c : 'rgba(255,255,255,0.2)', transition:'all 0.35s' }} />
      ))}
    </div>
  )
}


function IGAvatar({ size=32 }: { size?: number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', padding:2, background:'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)', flexShrink:0 }}>
      <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:'#1a0a2e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.round(size*0.38), fontWeight:900, color:'#f472b6' }}>H</div>
    </div>
  )
}

function IGHeader({ label='Instagram' }: { label?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
      <IGAvatar />
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, fontWeight:800, color:'#f1f5f9' }}>housing.com</div>
        <div style={{ fontSize:9.5, color:'#64748b' }}>{label}</div>
      </div>
      <SDLive />
    </div>
  )
}

/* Reference-style media: brand label → headline → body → gradient CTA */
function IGMedia({ gradient, body, cta, children }: { gradient:string; body?:string; cta?:string; children:React.ReactNode }) {
  return (
    <div style={{ aspectRatio:'1/1', borderRadius:10, background:gradient, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column' }}>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,rgba(0,0,0,0.06) 0%,rgba(0,0,0,0.56) 100%)' }} />
      {/* brand label */}
      <div style={{ height:26, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative', zIndex:2 }}>
        <span style={{ fontSize:7.5, letterSpacing:'.22em', fontWeight:700, color:'rgba(196,181,253,0.92)', textTransform:'uppercase' }}>HOUSING.COM</span>
      </div>
      {/* headline + body */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1, padding:'0 12px' }}>
        <div style={{ fontSize:17, fontWeight:900, color:'#fff', lineHeight:1.28, textAlign:'center' }}>{children}</div>
        {body && <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.68)', fontWeight:400, marginTop:9, lineHeight:1.45, textAlign:'center' }}>{body}</div>}
      </div>
      {/* CTA row (smaller pill) */}
      <div style={{ height:34, display:'flex', alignItems:'center', padding:'0 10px', position:'relative', zIndex:2, flexShrink:0 }}>
        {cta
          ? <div style={GRAD_CTA}>{cta}</div>
          : <div style={{ flex:1, textAlign:'right', fontSize:7.5, color:'rgba(255,255,255,0.28)', fontWeight:600 }}>housing.com</div>
        }
      </div>
    </div>
  )
}

function IGPostCard1() {
  return (
    <div style={{ ...SD_BASE, width:205, padding:'12px 12px 11px', background:'linear-gradient(#07071a,#07071a) padding-box, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045) border-box', border:'1px solid transparent', boxShadow:'0 8px 32px rgba(244,114,182,0.22)' }}>
      <IGHeader />
      <IGMedia gradient="linear-gradient(135deg,#1a0a2e,#7c3aed,#db2777)" body="Lekin ghar zaroor diya. This Father's Day." cta="Find your home →">
        Papa ne kabhi<br/>'I love you'<br/>nahi bola 🏠
      </IGMedia>
      <div style={{ ...SD_TAGS, marginTop:8 }}>#FathersDay #StillAliveChallenge</div>
    </div>
  )
}

function IGPostCard2() {
  return (
    <div style={{ ...SD_BASE, width:205, padding:'12px 12px 11px', background:'linear-gradient(#07071a,#07071a) padding-box, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045) border-box', border:'1px solid transparent', boxShadow:'0 8px 32px rgba(244,114,182,0.18)' }}>
      <IGHeader />
      <IGMedia gradient="linear-gradient(135deg,#0c0a1e,#5b21b6,#7c3aed)" body="Kirayedaar ki balcony nahi. Apni shaam, apna ghar." cta="Explore homes →">
        Apni chai.<br/>Apni balcony.<br/>Apna ghar &#9749;
      </IGMedia>
      <div style={{ ...SD_TAGS, marginTop:8 }}>#InternationalTeaDay #HousingDotCom</div>
    </div>
  )
}

const STORY_SLIDES: { g:string; head:string; body:string; cta:string }[] = [
  { g:'linear-gradient(160deg,#7c2d12,#dc2626)',  head:'48°C mein\nbhago mat 🥵',     body:'Broker ke peeche daudna band karo',   cta:'Ghar pe khojo →' },
  { g:'linear-gradient(160deg,#1e3a5f,#0891b2)',  head:'AC on karo\n🧊 aur socho',    body:'5km ke andar smart listings',          cta:'Housing.com kholo →' },
  { g:'linear-gradient(160deg,#4c1d95,#7c3aed)',  head:'Zero broker\ndrama 🏠',        body:'Real prices. Verified listings.',       cta:'Search now →' },
  { g:'linear-gradient(160deg,#064e3b,#059669)',  head:'EMI from\n₹8,999/mo 🏡',      body:'Home loans made simple',               cta:'Check eligibility →' },
  { g:'linear-gradient(160deg,#1e1b4b,#6d28d9)',  head:'Apna ghar\napni shaam ☕',     body:'Stay cool. Buy smart. #BandaHeatwave', cta:'Explore now →' },
]

function IGStoryCard() {
  const [slide, setSlide] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % STORY_SLIDES.length), 2400)
    return () => clearInterval(t)
  }, [])
  const s = STORY_SLIDES[slide]
  return (
    <div style={{ ...SD_BASE, width:190, padding:'10px 10px 11px', background:'rgba(7,7,26,0.92)', border:'1px solid rgba(244,114,182,0.28)', boxShadow:'0 8px 32px rgba(244,114,182,0.18)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:7 }}>
        <IGAvatar size={26} />
        <div style={{ fontSize:10.5, fontWeight:800, color:'#f1f5f9', flex:1 }}>housing.com</div>
        <SDLive />
      </div>
      <SDBars n={5} a={slide} dur={2400} />
      <div style={{ borderRadius:10, background:s.g, height:282, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', marginBottom:8 }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.56))' }} />
        <div style={{ height:26, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative', zIndex:2 }}>
          <span style={{ fontSize:7.5, letterSpacing:'.2em', fontWeight:700, color:'rgba(196,181,253,0.88)', textTransform:'uppercase' }}>HOUSING.COM</span>
        </div>
        <div key={slide} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1, padding:'0 12px', animation:'carousel-fade-in 0.4s ease-out' }}>
          <div style={{ fontSize:18, fontWeight:900, color:'#fff', lineHeight:1.28, textAlign:'center', whiteSpace:'pre-line' }}>{s.head}</div>
          <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.68)', fontWeight:400, marginTop:9, lineHeight:1.45, textAlign:'center' }}>{s.body}</div>
        </div>
        <div style={{ height:36, display:'flex', alignItems:'center', padding:'0 10px', flexShrink:0, position:'relative', zIndex:2 }}>
          <div style={GRAD_CTA}>{s.cta}</div>
        </div>
      </div>
      <div style={{ fontSize:9.5, color:'rgba(167,139,250,0.7)', textAlign:'center', fontWeight:700 }}>#BandaHeatwave #HousingDotCom</div>
    </div>
  )
}

const YT_SCENES: { label:string; g:string; head:string; body:string }[] = [
  { label:'HOOK', g:'linear-gradient(160deg,#1a0505,#7f1d1d)', head:'Telangana RERA\nfined 5 devs',   body:'🔥 ₹15.2 lakh fine each' },
  { label:'BODY', g:'linear-gradient(160deg,#0f0505,#b91c1c)', head:'Suvarnabhoomi\nInfra exposed',   body:'Buyers delayed 3+ years 😤' },
  { label:'CTA',  g:'linear-gradient(160deg,#1a0505,#991b1b)', head:'Check RERA\nbefore you buy',     body:'Verify before you invest 👉' },
]

function YTShortCard() {
  const [scene, setScene] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setScene(s => (s + 1) % YT_SCENES.length), 2600)
    return () => clearInterval(t)
  }, [])
  const sc = YT_SCENES[scene]
  return (
    <div style={{ ...SD_BASE, width:190, padding:'10px 10px 11px', background:'rgba(12,5,5,0.92)', border:'1px solid rgba(248,113,113,0.25)', boxShadow:'0 8px 32px rgba(248,113,113,0.18)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:9 }}>
        <div style={{ width:28, height:28, borderRadius:6, background:'#ff0000', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{YT_ICO}</div>
        <div style={{ fontSize:10.5, fontWeight:800, color:'#f87171', flex:1 }}>Shorts</div>
        <SDLive />
      </div>
      <div style={{ borderRadius:10, background:sc.g, height:282, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', marginBottom:9 }}>
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.18)' }} />
        <div style={{ height:30, display:'flex', alignItems:'center', padding:'0 10px', flexShrink:0, position:'relative', zIndex:2 }}>
          <span style={{ fontSize:7.5, fontWeight:900, color:'rgba(255,120,120,0.95)', letterSpacing:'.14em', textTransform:'uppercase', background:'rgba(0,0,0,0.5)', padding:'2px 8px', borderRadius:5 }}>{sc.label}</span>
        </div>
        <div key={scene} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', zIndex:1, padding:'0 12px', animation:'carousel-fade-in 0.4s ease-out' }}>
          <div style={{ fontSize:17, fontWeight:900, color:'#fff', lineHeight:1.28, textAlign:'center', whiteSpace:'pre-line' }}>{sc.head}</div>
          <div style={{ fontSize:10.5, color:'rgba(255,255,255,0.68)', fontWeight:400, marginTop:9, lineHeight:1.45, textAlign:'center' }}>{sc.body}</div>
        </div>
        <div style={{ height:40, display:'flex', alignItems:'center', padding:'0 10px', gap:8, flexShrink:0, position:'relative', zIndex:2 }}>
          <div style={{ ...GRAD_CTA, flex:1 }}>housing.com/rera →</div>
          <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(255,255,255,0.14)', border:'1.5px solid rgba(255,255,255,0.4)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      </div>
      <div style={{ fontSize:9.5, color:'rgba(167,139,250,0.7)', textAlign:'center', fontWeight:700 }}>#RERA #TelanganaPropTech</div>
    </div>
  )
}

function LICard() {
  return (
    <div style={{ ...SD_BASE, width:222, padding:'13px 14px 13px', background:'rgba(5,10,28,0.92)', border:'1px solid rgba(147,197,253,0.22)', boxShadow:'0 8px 28px rgba(147,197,253,0.08)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:11 }}>
        <div style={{ width:38, height:38, borderRadius:8, background:'linear-gradient(135deg,#1e3a5f,#0a66c2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:16, fontWeight:900, color:'#fff' }}>H</span>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#f1f5f9', lineHeight:1.2 }}>Housing.com</div>
          <div style={{ fontSize:9.5, color:'#64748b' }}>PropTech &middot; 500K+ followers</div>
        </div>
        <SDLive />
      </div>
      <div style={{ ...SD_CAP, fontSize:11.5 }}>
        #ITLayoffs handed 50,000+ pink slips this year.<br/><br/>
        Real estate handed out &#8377;5.68L Cr in sales.<br/><br/>
        The asset class doesn't bench people. It builds them.<br/><br/>
        &#128073; housing.com/listings
      </div>
      <div style={{ ...SD_TAGS, marginTop:9 }}>#ITLayoffs #RealEstate #PropTech</div>
    </div>
  )
}

function TWCardBase({ handle, children, tags }: { handle:string; children:React.ReactNode; tags:string }) {
  return (
    <div style={{ ...SD_BASE, width:200, padding:'13px 14px', background:'rgba(7,7,30,0.9)', border:'1px solid rgba(96,165,250,0.2)', boxShadow:'0 6px 24px rgba(96,165,250,0.1)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(96,165,250,0.12)', border:'1px solid rgba(96,165,250,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#60a5fa' }}>{TW_ICO}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#f1f5f9', lineHeight:1.2 }}>Housing.com</div>
          <div style={{ fontSize:9.5, color:'#475569' }}>{handle}</div>
        </div>
        <SDLive />
      </div>
      <div style={{ ...SD_CAP, fontSize:12, marginBottom:8 }}>{children}</div>
      <div style={SD_TAGS}>{tags}</div>
    </div>
  )
}

function TWCard1() {
  return (
    <TWCardBase handle="@HousingDotCom" tags="#ITLayoffs #TechLayoffs">
      HR ne meeting bulayi &#128560;<br/>
      Ghar ne kabhi nahi bulayi &#127968;<br/><br/>
      Job switch hoti rahegi. Ghar nahi jaata.<br/><br/>
      housing.com/search
    </TWCardBase>
  )
}

function TWCard2() {
  return (
    <TWCardBase handle="@HousingDotCom" tags="#SRHvsRCB #IPL2026">
      SRH ne @RCBTweets ko ghar pe haraya &#128293;<br/><br/>
      Match haar sakte ho, ghar nahi &#127968;<br/><br/>
      Hyderabad ya Bengaluru &mdash; apna ghar dhoondho.<br/>
      housing.com/search
    </TWCardBase>
  )
}

function TWCard3() {
  return (
    <TWCardBase handle="@HousingDotCom" tags="#DhurandharOnJiohotstar">
      Plot twist dekhne mein dhurandhar ho? &#127902;<br/><br/>
      Ghar dhundhne mein bhi bano &mdash; smart filters,<br/>
      real prices, zero broker drama.<br/><br/>
      housing.com/search
    </TWCardBase>
  )
}

function TWCard4() {
  return (
    <TWCardBase handle="@HousingDotCom" tags="#InternationalTeaDay #HousingDotCom">
      International Tea Day &#9749;<br/><br/>
      Chai piyo kisi bhi balcony pe.<br/>
      Bas apni balcony honi chahiye.<br/><br/>
      housing.com/search &#127968;
    </TWCardBase>
  )
}

function TWCard5() {
  return (
    <TWCardBase handle="@HousingDotCom" tags="#Swiggy #GharKhojo">
      @Swiggy delivers in 10 mins &#127829;<br/>
      Housing.com: 0 sec property search &#127968;<br/><br/>
      Ek pe ₹5 delivery fee.<br/>
      Doosra bilkul FREE.<br/><br/>
      Sochna kya hai? housing.com/search
    </TWCardBase>
  )
}

function TWCard6() {
  return (
    <TWCardBase handle="@HousingDotCom" tags="#ZomatoIN #RealEstate">
      @ZomatoIN review: "Pizza thanda tha &#11088;"<br/><br/>
      Housing.com review: "Verified listing,<br/>
      moved in 2 weeks &#11088;&#11088;&#11088;&#11088;&#11088;"<br/><br/>
      housing.com — India's most trusted<br/>property platform &#127968;
    </TWCardBase>
  )
}

function TWCard7() {
  return (
    <TWCardBase handle="@HousingDotCom" tags="#Blinkit #HousingDotCom">
      @blinkit ne anda deliver kiya &#129370;<br/>
      Lekin mujhe ghar chahiye &#127968;<br/><br/>
      10 seconds mein — 1 lakh+ listings.<br/>
      Zero broker. Zero drama.<br/><br/>
      housing.com/search
    </TWCardBase>
  )
}

function IGPostCard3() {
  return (
    <div style={{ ...SD_BASE, width:205, padding:'12px 12px 11px', background:'linear-gradient(#07071a,#07071a) padding-box, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045) border-box', border:'1px solid transparent', boxShadow:'0 8px 32px rgba(99,102,241,0.22)' }}>
      <IGHeader />
      <IGMedia gradient="linear-gradient(135deg,#0c1838,#1d4ed8,#7c3aed)" body="Wahi ₹15L = down payment for your own home." cta="housing.com/emi →">
        5 saal ka<br/>rent = ₹15L.<br/>Gone. &#129327;
      </IGMedia>
      <div style={{ ...SD_TAGS, marginTop:8 }}>#RentVsBuy #HomeLoan #HousingDotCom</div>
    </div>
  )
}

function IGPostCard4() {
  return (
    <div style={{ ...SD_BASE, width:205, padding:'12px 12px 11px', background:'linear-gradient(#07071a,#07071a) padding-box, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045) border-box', border:'1px solid transparent', boxShadow:'0 8px 32px rgba(34,197,94,0.18)' }}>
      <IGHeader />
      <IGMedia gradient="linear-gradient(135deg,#0f1f0a,#15803d,#16a34a)" body="Every champion needs a home base. Find yours on housing.com." cta="housing.com/search →">
        Kohli's ground:<br/>Chinnaswamy.<br/>Tera? &#127951;
      </IGMedia>
      <div style={{ ...SD_TAGS, marginTop:8 }}>#IPL2026 #ViratKohli #HousingDotCom</div>
    </div>
  )
}

function LICard2() {
  return (
    <div style={{ ...SD_BASE, width:222, padding:'13px 14px 13px', background:'rgba(5,10,28,0.92)', border:'1px solid rgba(147,197,253,0.22)', boxShadow:'0 8px 28px rgba(147,197,253,0.08)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:11 }}>
        <div style={{ width:38, height:38, borderRadius:8, background:'linear-gradient(135deg,#1e3a5f,#0a66c2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:16, fontWeight:900, color:'#fff' }}>H</span>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#f1f5f9', lineHeight:1.2 }}>Housing.com</div>
          <div style={{ fontSize:9.5, color:'#64748b' }}>PropTech &middot; 500K+ followers</div>
        </div>
        <SDLive />
      </div>
      <div style={{ ...SD_CAP, fontSize:11.5 }}>
        Landlord ne rent 20% badhaya. &#128563;<br/><br/>
        Maine housing.com pe ek 2BHK dhundha.<br/>
        EMI: ₹9,200/mo. Purana rent: ₹14,000/mo.<br/><br/>
        Plot twist: I'm paying less to OWN.<br/><br/>
        &#128073; housing.com/home-loan
      </div>
      <div style={{ ...SD_TAGS, marginTop:9 }}>#HomeLoan #RentVsBuy #FirstHome</div>
    </div>
  )
}

const CAROUSEL_SLIDES: { g:string; l1:string; l2:string; body:string }[] = [
  { g:'linear-gradient(135deg,#1f2937,#92400e)', l1:'Rasgulla vs',     l2:'Idli? 🍡',              body:'Asli debate toh alag hai...' },
  { g:'linear-gradient(135deg,#1e3a5f,#3b82f6)', l1:'Delhi 2BHK vs',   l2:'Hyderabad Villa?',      body:'₹95L vs ₹1.2Cr — you decide' },
  { g:'linear-gradient(135deg,#064e3b,#10b981)', l1:'Delhi:',           l2:'₹95L 2BHK Noida 🏙️',  body:'3BHK Dwarka: ₹1.4Cr' },
  { g:'linear-gradient(135deg,#0d3d30,#0f766e)', l1:'Hyderabad:',       l2:'₹1.2Cr Villa 🏡',      body:'Gachibowli, ready to move' },
  { g:'linear-gradient(135deg,#2d1b69,#7c3aed)', l1:'Tu kis',           l2:'side hai? 🗳️',         body:'Comment karo 👇' },
]

function IGCarouselCard() {
  const [slide, setSlide] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % CAROUSEL_SLIDES.length), 2000)
    return () => clearInterval(t)
  }, [])
  const cs = CAROUSEL_SLIDES[slide]
  return (
    <div style={{ ...SD_BASE, width:205, padding:'12px 12px 11px', background:'linear-gradient(#07071a,#07071a) padding-box, linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045) border-box', border:'1px solid transparent', boxShadow:'0 8px 32px rgba(244,114,182,0.16)' }}>
      <IGHeader label="Carousel &middot; Swipe &#x2192;" />
      <div key={slide} style={{ animation:'carousel-fade-in 0.35s ease-out' }}>
        <IGMedia gradient={cs.g} body={cs.body}>
          {cs.l1}<br/>{cs.l2}
        </IGMedia>
      </div>
      <div style={{ ...SD_CAP, marginTop:8, fontSize:10.5 }}>Rasgulla vs Idli chhodo &#127841; asli debate: Delhi 2BHK ya Hyderabad villa?</div>
      <SDDots n={5} a={slide} c="#f472b6" />
    </div>
  )
}

const DEMO_COLS_DESK = [
  [() => <IGPostCard1 />,    () => <LICard />],
  [() => <TWCard1 />,        () => <IGCarouselCard />],
  [() => <IGPostCard2 />,    () => <TWCard4 />],
  [() => <IGStoryCard />,    () => <TWCard2 />],
  [() => <YTShortCard />,    () => <TWCard3 />],
  [() => <TWCard5 />,        () => <IGPostCard3 />],
  [() => <TWCard6 />,        () => <LICard2 />],
  [() => <IGPostCard4 />,    () => <TWCard7 />],
]

const DEMO_COLS_MOB = [
  [() => <IGPostCard1 />, () => <LICard />],
  [() => <TWCard1 />,     () => <IGCarouselCard />],
  [() => <IGPostCard2 />, () => <TWCard4 />],
  [() => <IGStoryCard />, () => <TWCard2 />],
  [() => <YTShortCard />, () => <TWCard3 />],
]

const renderDemoTrack = (cols: typeof DEMO_COLS_DESK) => (
  <div className="sd-marquee-track">
    {[...cols, ...cols].map(([TopCard, BotCard], i) => {
      const ci = i % 5
      return (
        <div key={i} className="sd-marquee-col">
          <div style={{ animation:`${SD_POS[ci].anim} ${SD_POS[ci].dur}s ${SD_POS[ci].delay}s ease-in-out infinite` }}><TopCard /></div>
          <div style={{ animation:`${SD_POS[ci+5].anim} ${SD_POS[ci+5].dur}s ${SD_POS[ci+5].delay}s ease-in-out infinite` }}><BotCard /></div>
        </div>
      )
    })}
  </div>
)

function MarqueeBackground({ visible }: { visible: boolean }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.5s ease',
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* Gradient fade from top — keeps header text readable on both slide 1 and 2 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
        height: '38%',
        background: 'linear-gradient(to bottom, #07071a 0%, rgba(7,7,26,0) 100%)',
      }} />
      {/* Desktop marquee — full-height, edge-to-edge */}
      <div className="demo-desk" style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        {renderDemoTrack(DEMO_COLS_DESK)}
      </div>
      {/* Mobile marquee — full-height, edge-to-edge */}
      <div className="demo-mob" style={{ position: 'absolute', inset: 0, overflow: 'hidden', alignItems: 'flex-start' }}>
        {renderDemoTrack(DEMO_COLS_MOB)}
      </div>
    </div>
  )
}

function SlideDemo() {
  return (
    <div className="demo-inner" style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', padding:'72px 52px 0' }}>
      <div className="demo-title-box" style={{ textAlign:'center', zIndex:10, position:'relative', padding:'0 14px' }}>
        <div className="slide-tag" style={{ display:'inline-block' }}>Live Output &middot; Housing.com Pilot</div>
        <h2 className="slide-h2" style={{ margin:'6px 0 0', fontSize:'clamp(22px,2.4vw,38px)' }}>Real posts. Real ERs. <span className="grad-text">Zero manual work.</span></h2>
      </div>
    </div>
  )
}

function Slide2() {
  return (
    <div className="slide-inner" style={{ textAlign: 'center', maxWidth: 1000 }}>
      <div className="slide-tag">The Problem</div>
      <h2 className="slide-h2">Still stuck in 2015.</h2>
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
        <span style={{ color: '#fca5a5' }}>Publishers spend 60% of their marketing budget on content that performs 40% below industry benchmark.</span><br /><span style={{ color: '#64748b', fontSize: '0.82em', marginTop: 6, display: 'inline-block' }}>Real estate pilot · Housing.com</span>
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
    <div className="slide-inner" style={{ textAlign: 'center', maxWidth: 1080 }}>
      <div className="slide-tag">Our Solution</div>
      <h2 className="slide-h2">Meet <span className="grad-text">{brand}.</span> It learns from every post.</h2>
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
      {/* Feedback loop callout */}
      <div style={{ marginTop: 16, padding: '14px 22px', borderRadius: 14, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.22)', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: '50%', background: 'rgba(16,185,129,0.14)', border: '1.5px solid rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
          <IconLearn />
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#6ee7b7', marginBottom: 4 }}>
            Self-improving feedback loop — powered by real engagement data
          </div>
          <div className="sol-feedback-body" style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.65 }}>
            Every published post feeds engagement signals (likes, shares, reach, saves) back into the system.
            Hooks that resonated get amplified. Angles that flopped get retired. Timing patterns are learned.
            The longer {brand} runs, the better its content performs — compounding quality over time.
          </div>
        </div>
      </div>
      <div className="sol-footer" style={{ textAlign: 'center', marginTop: 12 }}>
        End-to-end. Fully automated. <span>Always improving.</span>
      </div>
    </div>
  )
}

function Slide4() {
  return (
    <div className="slide-inner" style={{ textAlign: 'center', maxWidth: 1000 }}>
      <div className="slide-tag">Live Results</div>
      <h2 className="slide-h2">Real numbers. Real runs.</h2>
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
    <div className="slide-inner" style={{ textAlign: 'center', maxWidth: 1000 }}>
      <div className="slide-tag">Market Opportunity</div>
      <h2 className="slide-h2"><span className="grad-text">$15B+</span> market. All manual.</h2>
      <div className="market-grid">
        <div className="market-card featured">
          <div className="market-icon" style={{ background: 'rgba(139,92,246,.15)' }}>
            <IconGlobe />
          </div>
          <div className="market-title">Every Business Chasing Buzz & Trends</div>
          <div className="market-body">Any brand with a content team is a customer — media, RE, fintech, healthcare, BFSI. $15B+ TAM.</div>
        </div>
        <div className="market-card">
          <div className="market-icon" style={{ background: 'rgba(16,185,129,.12)' }}>
            <IconBuilding />
          </div>
          <div className="market-title">Pilot — Real Estate ✓</div>
          <div className="market-body">Housing.com pilot: 200+ posts, 3.8× engagement lift, 170× cheaper than agency.</div>
        </div>
        <div className="market-card">
          <div className="market-icon" style={{ background: 'rgba(6,182,212,.12)' }}>
            <IconDollar />
          </div>
          <div className="market-title">Next Verticals</div>
          <div className="market-body">Auto, travel, BFSI, media, e-commerce — wherever timing and relevance are money.</div>
        </div>
      </div>
      <div className="market-footer">
        Piloted with India's #1 real estate platform. <strong>Infrastructure built to serve every publisher.</strong>
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
    <div className="slide-inner" style={{ textAlign: 'center', maxWidth: 1000 }}>
      <div className="slide-tag">Pricing</div>
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
      <p className="pr-footnote" style={{ fontSize: 12, color: 'var(--dim)', marginTop: 10, textAlign: 'center' }}>
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
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
      pct: '35%', color: '#8B5CF6', amt: '₹1.23 Cr',
      title: 'Team & Talent',
      desc: '2 engineers, 1 designer, 1 ops — 18 months.',
    },
    {
      pct: '25%', color: '#06B6D4', amt: '₹87.5 L',
      title: 'Sales & GTM',
      desc: 'Sales hire + 50 publisher contracts. Outbound.',
    },
    {
      pct: '20%', color: '#10B981', amt: '₹70 L',
      title: 'Infrastructure & APIs',
      desc: 'Cloud compute, AI APIs, DevOps + security.',
    },
    {
      pct: '20%', color: '#F59E0B', amt: '₹70 L',
      title: 'Ops, Legal & Buffer',
      desc: 'IP filings, CS tooling, compliance + buffer.',
    },
  ]
  return (
    <div className="slide-inner" style={{ textAlign: 'center' }}>
      <div className="slide-tag">The Ask</div>
      <h2 className="slide-h2" style={{ marginBottom: 8 }}>What we need to win.</h2>
      <div className="ask-center">
        <span className="ask-amount grad-text" style={{ fontSize: 'clamp(34px,5vw,56px)', marginBottom: 4 }}>Seed Round · ₹3.5 Cr</span>
        <div className="ask-equiv" style={{ marginBottom: 16, fontSize: 14 }}>~$420K USD · 18-month runway · ~₹19L/mo avg burn</div>
        <div className="use-grid" style={{ marginBottom: 14 }}>
          {buckets.map(b => (
            <div className="use-card" key={b.title} style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 3 }}>
                <div className="use-pct" style={{ color: b.color, fontSize: 26, marginBottom: 0 }}>{b.pct}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: b.color, opacity: 0.75 }}>{b.amt}</div>
              </div>
              <div className="use-title" style={{ fontSize: 13, marginBottom: 3 }}>{b.title}</div>
              <div className="use-desc" style={{ fontSize: 11 }}>{b.desc}</div>
            </div>
          ))}
        </div>

        {/* What's in it for you */}
        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 14, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.22)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            What's in it for you
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, textAlign: 'left' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#c4b5fd', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 2 }}>10%</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>Equity stake</div>
              <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>₹31.5 Cr pre-money. Clean cap table.</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#6ee7b7', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 2 }}>4–12×</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>Return potential</div>
              <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>8× path → ₹133 Cr. Your 10% = ₹13 Cr.</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#38bdf8', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 2 }}>Rights</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>Investor privileges</div>
              <div style={{ fontSize: 9, color: '#64748b', lineHeight: 1.5 }}>Observer seat. Pro-rata in Series A.</div>
            </div>
          </div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(139,92,246,0.15)', fontSize: 10, color: '#64748b' }}>
            50 publishers in 6 months · $150K ARR target, Year 1
          </div>
        </div>
      </div>
    </div>
  )
}

function Slide10({ brand }: { brand: string }) {
  return (
    <div className="slide-inner" style={{ textAlign: 'center' }}>
      <div className="slide-tag">Let's Build</div>
      <h1 className="slide-h1" style={{ maxWidth: 760, margin: '0 auto 14px' }}>
        The <span className="grad-text">#TrendJack</span> machine<br />
        <span className="grad-text">is live. Let's scale it.</span>
      </h1>
      <p className="slide-sub">
        Every trend is a publishing opportunity — with the right hook, the right humor, and the right timing.
        We built the engine that turns a breaking moment into live content across 5 platforms in 90 seconds.
        For every business that publishes. Let's take it everywhere.
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
        <div className="close-contact" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}>
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
  const trackRef = useRef<HTMLDivElement>(null)

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= TOTAL_SLIDES) return
    setCurrentSlide(idx)
    if (window.innerWidth <= 768 && trackRef.current) {
      trackRef.current.scrollTo({ top: idx * window.innerHeight, behavior: 'smooth' })
    }
  }

  // Sync currentSlide from native scroll position on mobile
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const onScroll = () => {
      if (window.innerWidth > 768) return
      const idx = Math.round(track.scrollTop / window.innerHeight)
      setCurrentSlide(idx)
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => track.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'j') goTo(currentSlide + 1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'k') goTo(currentSlide - 1)
    }
    let startX = 0
    let startY = 0
    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (window.innerWidth <= 768) return  // native scroll snap handles mobile
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) goTo(currentSlide + (dx < 0 ? 1 : -1))
    }
    window.addEventListener('keydown', handler)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [currentSlide])

  const slides = [
    <Slide1 brand={brand} key={0} />,
    <SlideDemo key={1} />,
    <Slide2 key={2} />,
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

      {/* SHARED MARQUEE BACKGROUND — sticky behind slides 1 & 2, fades when leaving */}
      <MarqueeBackground visible={currentSlide <= 1} />

      {/* PROGRESS BAR */}
      <div className="pt-progress">
        <div className="pt-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* TOP BAR */}
      <div className="pt-topbar">
        <div className="pt-topbar-left">
          <a href="/" className="pt-brand" style={{ textDecoration: 'none' }}>{brand}</a>
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
        ref={trackRef}
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
