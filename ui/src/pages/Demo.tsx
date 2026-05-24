import { useState, useRef } from 'react'
import { useBrandName } from '../lib/useBrandName'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
.demo-root {
  --bg:#07071a;--surf:rgba(255,255,255,0.04);--bord:rgba(255,255,255,0.09);
  --purple:#8B5CF6;--indigo:#6366F1;--cyan:#06B6D4;--green:#10B981;
  --amber:#F59E0B;--text:#f1f5f9;--muted:#64748b;--dim:#334155;
  --grad:linear-gradient(90deg,#C4B5FD 0%,#818CF8 38%,#38BDF8 72%,#67E8F9 100%);
  font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);
  position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;
}
.demo-root *,.demo-root *::before,.demo-root *::after{box-sizing:border-box;margin:0;padding:0}
.demo-root .orb{position:fixed;border-radius:50%;pointer-events:none;z-index:0}
.demo-root .orb-a{width:600px;height:600px;top:-200px;left:-100px;background:radial-gradient(circle,rgba(139,92,246,.16) 0%,transparent 70%);animation:float-a 20s ease-in-out infinite}
.demo-root .orb-b{width:500px;height:500px;top:30%;right:-120px;background:radial-gradient(circle,rgba(6,182,212,.12) 0%,transparent 70%);animation:float-b 24s ease-in-out infinite}
.demo-root .orb-c{width:400px;height:400px;bottom:5%;left:35%;background:radial-gradient(circle,rgba(99,102,241,.10) 0%,transparent 70%);animation:float-c 18s ease-in-out infinite}
.demo-root .dot-grid{position:fixed;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.05) 1px,transparent 1px);background-size:32px 32px;pointer-events:none;z-index:0}
@keyframes float-a{0%,100%{transform:translate(0,0)}33%{transform:translate(40px,-50px)}66%{transform:translate(-30px,30px)}}
@keyframes float-b{0%,100%{transform:translate(0,0)}40%{transform:translate(-40px,35px)}70%{transform:translate(25px,-35px)}}
@keyframes float-c{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,45px)}}
.demo-root .grad-text{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.demo-root #progress-track{position:fixed;top:0;left:0;height:3px;width:0%;background:linear-gradient(90deg,#8B5CF6,#6366F1,#06B6D4);z-index:999;transition:width .3s ease}
.demo-root nav{position:relative;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:16px 48px;border-bottom:1px solid rgba(255,255,255,.06);backdrop-filter:blur(12px)}
.demo-root .nav-logo{display:flex;align-items:center;gap:10px}
.demo-root .nav-name{font-weight:900;font-size:32px;letter-spacing:-.03em}
.demo-root .nav-stats{display:flex;gap:32px}
.demo-root .stat{text-align:center}
.demo-root .stat-val{display:block;font-size:20px;font-weight:800;letter-spacing:-.02em}
.demo-root .stat-lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;font-weight:500}
.demo-root .run-btn{display:flex;align-items:center;gap:8px;padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#8B5CF6,#6366F1);color:#fff;font-family:'Inter',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .2s,transform .2s,box-shadow .2s}
.demo-root .run-btn:hover{opacity:.9;transform:translateY(-2px);box-shadow:0 8px 28px rgba(139,92,246,.45)}
.demo-root .nav-pricing-link{padding:8px 18px;border-radius:8px;border:1px solid rgba(139,92,246,.38);background:rgba(139,92,246,.1);color:#c4b5fd;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;text-decoration:none;transition:all .2s}
.demo-root .nav-pricing-link:hover{background:rgba(139,92,246,.2);border-color:rgba(139,92,246,.6)}
.demo-root #hero{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:calc(100vh - 65px);text-align:center;padding:40px 24px}
.demo-root .hero-badge{display:inline-flex;align-items:center;gap:7px;padding:5px 14px 5px 8px;border-radius:100px;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.35);font-size:12px;font-weight:700;color:#c4b5fd;letter-spacing:.04em;margin-bottom:28px}
.demo-root .live-dot{width:6px;height:6px;border-radius:50%;background:#a78bfa;animation:pulse-dot 2s ease-in-out infinite}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
.demo-root .hero-title{font-size:clamp(36px,5.5vw,68px);font-weight:900;letter-spacing:-.03em;line-height:1.1;margin-bottom:20px;color:#fff}
.demo-root .hero-sub{font-size:18px;color:var(--muted);max-width:500px;line-height:1.6;margin-bottom:48px}
.demo-root .hero-run-btn{display:flex;align-items:center;gap:10px;padding:18px 48px;border-radius:14px;border:none;background:linear-gradient(135deg,#8B5CF6,#6366F1);color:#fff;font-family:'Inter',sans-serif;font-size:18px;font-weight:800;cursor:pointer;transition:opacity .2s,transform .2s,box-shadow .2s;box-shadow:0 8px 40px rgba(139,92,246,.35)}
.demo-root .hero-run-btn:hover{opacity:.9;transform:translateY(-3px);box-shadow:0 12px 50px rgba(139,92,246,.5)}
.demo-root .hero-hint{margin-top:20px;font-size:13px;color:var(--dim)}
.demo-root #demo{position:relative;z-index:1;padding:32px 40px 80px;max-width:1440px;margin:0 auto}
.demo-root .pipeline-row{display:grid;grid-template-columns:1fr 36px 1fr 36px 1fr 36px 1fr 36px 1fr 36px 1fr;align-items:center;margin-bottom:40px}
.demo-root .stage-node{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.demo-root .stage-icon-wrap{width:60px;height:60px;border-radius:16px;border:1.5px solid var(--bord);background:var(--surf);display:flex;align-items:center;justify-content:center;position:relative;transition:border-color .4s,box-shadow .4s,background .4s}
.demo-root .stage-icon-wrap svg{width:26px;height:26px;color:var(--muted);transition:color .4s}
.demo-root .stage-num{position:absolute;top:-8px;left:50%;transform:translateX(-50%);width:18px;height:18px;border-radius:50%;background:var(--dim);border:2px solid var(--bg);font-size:8px;font-weight:800;color:rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;transition:background .4s}
.demo-root .stage-label{font-size:11px;font-weight:700;color:var(--muted);transition:color .4s}
.demo-root .stage-status{font-size:10px;color:var(--dim);height:14px;transition:color .4s}
.demo-root .stage-node.active .stage-icon-wrap{border-color:var(--purple);box-shadow:0 0 24px rgba(139,92,246,.4);background:rgba(139,92,246,.1);animation:stage-pulse 1.5s ease-in-out infinite}
.demo-root .stage-node.active .stage-icon-wrap svg{color:#c4b5fd}
.demo-root .stage-node.active .stage-num{background:var(--purple);color:#fff}
.demo-root .stage-node.active .stage-label{color:#c4b5fd}
.demo-root .stage-node.active .stage-status{color:#a78bfa}
.demo-root .stage-node.done .stage-icon-wrap{border-color:var(--green);box-shadow:0 0 16px rgba(16,185,129,.25);background:rgba(16,185,129,.08);animation:none}
.demo-root .stage-node.done .stage-icon-wrap svg{color:var(--green)}
.demo-root .stage-node.done .stage-num{background:var(--green);color:#fff}
.demo-root .stage-node.done .stage-label{color:#6ee7b7}
.demo-root .stage-node.done .stage-status{color:var(--green)}
@keyframes stage-pulse{0%,100%{box-shadow:0 0 28px rgba(139,92,246,.5),0 0 0 0 rgba(139,92,246,.3)}50%{box-shadow:0 0 60px rgba(139,92,246,.85),0 0 0 8px rgba(139,92,246,.08)}}
@keyframes stage-pop{0%{transform:scale(.55)}55%{transform:scale(1.22)}75%{transform:scale(.94)}100%{transform:scale(1)}}
.demo-root .stage-connector{display:flex;align-items:center;justify-content:center;padding-top:0}
.demo-root .connector-line{height:2px;width:22px;border-radius:1px;background:var(--bord);transition:background .18s}
.demo-root .connector-arrow{font-size:11px;color:var(--dim);transition:color .18s;line-height:1}
.demo-root .connector-line.lit{background:linear-gradient(90deg,var(--purple),var(--indigo))}
.demo-root .connector-arrow.lit{color:var(--indigo)}
.demo-root .out-card{border-radius:18px;padding:22px;background:var(--surf);border:1px solid var(--bord);backdrop-filter:blur(16px)}
.demo-root .out-card:hover{border-color:rgba(139,92,246,.3)}
.demo-root .card-eyebrow{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:6px}
.demo-root .eyebrow-dot{width:5px;height:5px;border-radius:50%;background:var(--purple);animation:pulse-dot 2s infinite;flex-shrink:0}
.demo-root #phase-123{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
@keyframes card-enter{0%{opacity:0;transform:translateY(80px) scale(.84)}52%{opacity:1;transform:translateY(-14px) scale(1.05)}72%{transform:translateY(5px) scale(.98)}88%{transform:translateY(-3px) scale(1.01)}100%{opacity:1;transform:translateY(0) scale(1)}}
.demo-root .card-in{animation:card-enter .5s cubic-bezier(.34,1.56,.64,1) both}
.demo-root #phase-4{display:none}
.demo-root .phase4-header{margin-bottom:18px;text-align:center}
.demo-root .phase4-header h2{font-size:28px;font-weight:900;letter-spacing:-.025em;margin-bottom:6px}
.demo-root .phase4-header p{color:var(--muted);font-size:15px}
.demo-root .posts-3col{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.demo-root #phase-56{display:none;gap:24px;align-items:start}
.demo-root .split-left{flex:0 0 55%}
.demo-root .split-right{flex:0 0 43%}
.demo-root .plat-tabs{display:flex;gap:8px;margin-bottom:14px}
.demo-root .plat-tab{display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;border:1px solid var(--bord);background:transparent;cursor:pointer;font-size:12px;font-weight:700;color:var(--muted);transition:all .3s ease}
.demo-root .plat-tab.active{background:rgba(139,92,246,.12);border-color:rgba(139,92,246,.4);color:#c4b5fd}
.demo-root .carousel-slides{position:relative;min-height:420px}
.demo-root .post-slide{position:absolute;inset:0;opacity:0;transform:translateX(28px) scale(.96);transition:opacity .35s cubic-bezier(.34,1.56,.64,1),transform .35s cubic-bezier(.34,1.56,.64,1);pointer-events:none}
.demo-root .post-slide.active{opacity:1;transform:translateX(0) scale(1);pointer-events:auto;position:relative}
.demo-root .car-dots{display:flex;gap:8px;justify-content:center;margin-top:14px}
.demo-root .car-dot{width:8px;height:8px;border-radius:4px;background:rgba(255,255,255,.18);border:none;cursor:pointer;padding:0;transition:width .35s cubic-bezier(.22,1,.36,1),background .35s}
.demo-root .car-dot.active{width:24px;background:#818CF8}
.demo-root .trend-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.demo-root .trend-item:last-child{border-bottom:none}
.demo-root .trend-rank{font-size:11px;font-weight:700;color:var(--dim);width:18px;text-align:right;flex-shrink:0}
.demo-root .trend-info{flex:1}
.demo-root .trend-name{font-size:14px;font-weight:700;color:var(--text)}
.demo-root .trend-vol{font-size:11px;color:var(--muted);margin-top:2px}
.demo-root .trend-bar-bg{height:3px;background:rgba(255,255,255,.06);border-radius:2px;margin-top:5px;overflow:hidden}
.demo-root .trend-bar{height:100%;border-radius:2px;width:0;transition:width 1s cubic-bezier(.22,1,.36,1)}
.demo-root .research-story{background:rgba(255,255,255,.03);border-radius:10px;border:1px solid rgba(255,255,255,.07);padding:13px;margin-bottom:10px}
.demo-root .story-source{font-size:10px;color:var(--muted);font-weight:600;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em}
.demo-root .story-headline{font-size:13px;font-weight:700;color:var(--text);line-height:1.4;margin-bottom:5px}
.demo-root .story-insight{font-size:12px;color:var(--muted);line-height:1.6}
.demo-root .story-tag{display:inline-block;font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;background:rgba(139,92,246,.15);color:#c4b5fd;border:1px solid rgba(139,92,246,.25);margin-top:7px}
.demo-root .brief-card{border-radius:10px;padding:10px 12px;margin-bottom:7px;display:flex;align-items:flex-start;gap:9px}
.demo-root .brief-platform-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-top:4px}
.demo-root .brief-platform{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}
.demo-root .brief-angle{font-size:12px;color:var(--text);line-height:1.5;font-weight:500}
.demo-root .brief-tone{font-size:10px;color:var(--muted);margin-top:3px}
.demo-root .tw-card{background:#0f172a;border-radius:14px;padding:18px;border:1px solid rgba(255,255,255,.08)}
.demo-root .tw-header{display:flex;align-items:center;gap:10px;margin-bottom:11px}
.demo-root .tw-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#8B5CF6,#3B82F6);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#fff;flex-shrink:0}
.demo-root .tw-name{font-size:13px;font-weight:700;color:#f1f5f9}
.demo-root .tw-handle{font-size:11px;color:#475569}
.demo-root .tw-body{font-size:13px;color:#e2e8f0;line-height:1.6;margin-bottom:9px}
.demo-root .tw-tags{font-size:11px;color:#38bdf8;margin-bottom:11px}
.demo-root .tw-actions{display:flex;gap:16px;font-size:12px;color:#475569;padding-top:9px;border-top:1px solid rgba(255,255,255,.06)}
.demo-root .ig-card-wrap{border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.08)}
.demo-root .ig-header-bar{background:#0f0f17;padding:10px 14px;display:flex;align-items:center;gap:10px}
.demo-root .ig-avatar-ring{width:32px;height:32px;border-radius:50%;padding:1.5px;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);flex-shrink:0}
.demo-root .ig-avatar-inner{width:100%;height:100%;border-radius:50%;background:#0f0f17;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;color:#fff}
.demo-root .ig-handle{font-size:12px;font-weight:700;color:#f1f5f9}
.demo-root .ig-visual{width:100%;aspect-ratio:1.5;background:linear-gradient(135deg,#3B0764 0%,#1E1B4B 40%,#0C4A6E 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:10px}
.demo-root .ig-brand-label{font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(196,181,253,.7)}
.demo-root .ig-main-text{font-size:20px;font-weight:900;text-align:center;color:#fff;line-height:1.2}
.demo-root .ig-sub-text{font-size:11px;color:#c4b5fd;text-align:center}
.demo-root .ig-cta{padding:6px 18px;border-radius:20px;background:linear-gradient(135deg,#8B5CF6,#06B6D4);font-size:11px;font-weight:700;color:#fff}
.demo-root .ig-footer-bar{background:#0f0f17;padding:9px 14px}
.demo-root .ig-likes{font-size:12px;font-weight:700;color:#f1f5f9}
.demo-root .ig-caption{font-size:11px;color:#64748b;margin-top:3px}
.demo-root .li-card{background:#1b1f23;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.08)}
.demo-root .li-post-header{padding:14px 14px 10px;display:flex;gap:9px}
.demo-root .li-avatar{width:42px;height:42px;border-radius:8px;background:linear-gradient(135deg,#8B5CF6,#3B82F6);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff;flex-shrink:0}
.demo-root .li-name{font-weight:700;font-size:13px;color:#f1f5f9}
.demo-root .li-sub{font-size:11px;color:#64748b;margin-top:2px}
.demo-root .li-body{padding:0 14px 12px;font-size:12px;color:#cbd5e1;line-height:1.7}
.demo-root .li-banner{margin:0 14px 12px;border-radius:8px;background:linear-gradient(90deg,#312e81,#1e3a5f);padding:11px 14px;display:flex;align-items:center;justify-content:space-between}
.demo-root .li-banner-text{font-size:12px;font-weight:700;color:#fff}
.demo-root .li-banner-sub{font-size:10px;color:#a5b4fc;margin-top:1px}
.demo-root .li-stats{padding:9px 14px;border-top:1px solid rgba(255,255,255,.06);display:flex;gap:14px;font-size:11px;color:#475569}
.demo-root .qa-metric{margin-bottom:12px}
.demo-root .qa-metric-header{display:flex;justify-content:space-between;margin-bottom:5px}
.demo-root .qa-metric-name{font-size:12px;color:var(--muted)}
.demo-root .qa-metric-score{font-size:12px;font-weight:800;color:var(--green)}
.demo-root .qa-bar-bg{height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden}
.demo-root .qa-bar{height:100%;border-radius:3px;width:0;background:linear-gradient(90deg,#8B5CF6,#10B981);transition:width .45s cubic-bezier(.34,1.56,.64,1)}
.demo-root .qa-verdict-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px}
.demo-root .qa-chip{padding:4px 11px;border-radius:6px;font-size:11px;font-weight:700}
.demo-root .qa-chip.pass{background:rgba(16,185,129,.15);color:#6ee7b7;border:1px solid rgba(16,185,129,.3)}
.demo-root .qa-chip.revised{background:rgba(245,158,11,.15);color:#fcd34d;border:1px solid rgba(245,158,11,.3)}
.demo-root .pub-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
.demo-root .pub-metric{background:rgba(255,255,255,.04);border-radius:10px;padding:12px;text-align:center}
.demo-root .pub-val{font-size:26px;font-weight:900;letter-spacing:-.02em}
.demo-root .pub-lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-top:2px}
.demo-root .platform-tag{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;margin:3px}
.demo-root .pt-tw{background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.15);color:#e2e8f0}
.demo-root .pt-ig{background:linear-gradient(135deg,rgba(240,148,51,.15),rgba(193,53,132,.15));border:1px solid rgba(193,53,132,.25);color:#f9a8d4}
.demo-root .pt-li{background:rgba(0,119,181,.15);border:1px solid rgba(0,119,181,.3);color:#93c5fd}
.demo-root .pt-yt{background:rgba(255,0,0,.15);border:1px solid rgba(255,0,0,.25);color:#fca5a5}
.demo-root .pt-news{background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.3);color:#c4b5fd}
.demo-root .savings-bar{margin-top:14px;padding:13px;border-radius:10px;background:linear-gradient(135deg,rgba(16,185,129,.1),rgba(6,182,212,.08));border:1px solid rgba(16,185,129,.2);text-align:center}
.demo-root .savings-bar .big{font-size:19px;font-weight:900;color:var(--green)}
.demo-root .savings-bar .sub{font-size:12px;color:var(--muted);margin-top:3px}
@keyframes slide-up{from{opacity:0;transform:translateY(40px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes slam-right{0%{opacity:0;transform:translateX(90px) scale(.88)}55%{opacity:1;transform:translateX(-14px) scale(1.04)}75%{transform:translateX(5px) scale(.985)}100%{opacity:1;transform:translateX(0) scale(1)}}
@keyframes slam-left{0%{opacity:0;transform:translateX(-90px) scale(.88)}55%{opacity:1;transform:translateX(14px) scale(1.04)}75%{transform:translateX(-5px) scale(.985)}100%{opacity:1;transform:translateX(0) scale(1)}}
@keyframes scatter-left{0%{opacity:1;transform:translate(0,0) scale(1) rotate(0deg)}20%{transform:translate(-28px,12px) scale(1.04) rotate(-3deg)}100%{opacity:0;transform:translate(-200px,60px) scale(.65) rotate(-18deg)}}
@keyframes scatter-up{0%{opacity:1;transform:translate(0,0) scale(1)}15%{transform:translate(0,-18px) scale(1.06)}100%{opacity:0;transform:translate(0,-110px) scale(.6)}}
@keyframes scatter-right{0%{opacity:1;transform:translate(0,0) scale(1) rotate(0deg)}20%{transform:translate(28px,12px) scale(1.04) rotate(3deg)}100%{opacity:0;transform:translate(200px,60px) scale(.65) rotate(18deg)}}
.demo-root .scatter-l{animation:scatter-left .48s cubic-bezier(.55,0,1,.8) both!important;pointer-events:none}
.demo-root .scatter-u{animation:scatter-up .48s cubic-bezier(.55,0,1,.8) .04s both!important;pointer-events:none}
.demo-root .scatter-r{animation:scatter-right .48s cubic-bezier(.55,0,1,.8) .08s both!important;pointer-events:none}
@keyframes trend-slam{0%{opacity:0;transform:translateX(-48px) scaleX(.88)}55%{opacity:1;transform:translateX(8px)}75%{transform:translateX(-3px)}100%{opacity:1;transform:translateX(0)}}
@keyframes phase4-enter{0%{opacity:0;transform:scale(.72) translateY(36px);filter:brightness(3.5) saturate(2)}38%{opacity:1;transform:scale(1.07) translateY(-8px);filter:brightness(1.6) saturate(1.3)}62%{transform:scale(.975) translateY(3px);filter:brightness(1.1)}80%{transform:scale(1.015) translateY(-1px)}100%{opacity:1;transform:scale(1) translateY(0);filter:brightness(1) saturate(1)}}
.demo-root #phase-4.entering{animation:phase4-enter .7s cubic-bezier(.34,1.56,.64,1) both}
.demo-root #flash-overlay{position:fixed;inset:0;pointer-events:none;z-index:500;opacity:0;background:radial-gradient(ellipse 70% 55% at 50% 42%,rgba(255,255,255,.65) 0%,rgba(139,92,246,.55) 35%,rgba(6,182,212,.2) 60%,transparent 80%)}
@keyframes flash-burst{0%{opacity:0;transform:scale(.7)}10%{opacity:1;transform:scale(1.08)}35%{opacity:.75;transform:scale(1)}65%{opacity:.35}100%{opacity:0;transform:scale(1)}}
.demo-root #p4-dots{display:none}
.demo-root .carousel-slides .tw-card{padding:12px 14px;border-radius:12px;max-width:360px;margin:0 auto}
.demo-root .carousel-slides .tw-avatar{width:30px;height:30px;font-size:12px}
.demo-root .carousel-slides .tw-name{font-size:11px}
.demo-root .carousel-slides .tw-handle{font-size:9px}
.demo-root .carousel-slides .tw-body{font-size:11px;margin-bottom:7px;line-height:1.55}
.demo-root .carousel-slides .tw-tags{font-size:10px;margin-bottom:8px}
.demo-root .carousel-slides .tw-actions{font-size:10px;gap:12px;padding-top:7px}
.demo-root .carousel-slides .ig-card-wrap{max-width:360px;margin:0 auto;border-radius:12px}
.demo-root .carousel-slides .ig-header-bar{padding:8px 10px}
.demo-root .carousel-slides .ig-avatar-ring{width:26px;height:26px}
.demo-root .carousel-slides .ig-handle{font-size:10px}
.demo-root .carousel-slides .ig-visual{padding:16px;gap:8px}
.demo-root .carousel-slides .ig-main-text{font-size:17px}
.demo-root .carousel-slides .ig-sub-text{font-size:10px}
.demo-root .carousel-slides .ig-cta{font-size:10px;padding:5px 14px}
.demo-root .carousel-slides .ig-footer-bar{padding:7px 10px}
.demo-root .carousel-slides .ig-likes{font-size:11px}
.demo-root .carousel-slides .ig-caption{font-size:10px}
.demo-root .carousel-slides .li-card{max-width:360px;margin:0 auto;border-radius:12px}
.demo-root .carousel-slides .li-post-header{padding:10px 12px 7px}
.demo-root .carousel-slides .li-avatar{width:34px;height:34px;font-size:13px;border-radius:6px}
.demo-root .carousel-slides .li-name{font-size:11px}
.demo-root .carousel-slides .li-sub{font-size:9px}
.demo-root .carousel-slides .li-body{padding:0 12px 10px;font-size:11px;line-height:1.65}
.demo-root .carousel-slides .li-banner{margin:0 12px 10px;padding:9px 12px}
.demo-root .carousel-slides .li-banner-text{font-size:11px}
.demo-root .carousel-slides .li-banner-sub{font-size:9px}
.demo-root .carousel-slides .li-stats{padding:7px 12px;font-size:10px;gap:10px}
@media(max-width:767px){
  /* Nav */
  .demo-root nav{padding:10px 14px}
  .demo-root .nav-name{font-size:22px}
  .demo-root .nav-stats{gap:14px}
  .demo-root .stat-val{font-size:14px}
  .demo-root .stat-lbl{font-size:8px;letter-spacing:.04em}
  .demo-root .nav-pricing-link{padding:5px 10px;font-size:11px}
  .demo-root .run-btn{padding:7px 12px;font-size:12px;gap:5px}
  /* Hero */
  .demo-root #hero{padding:28px 20px;min-height:calc(100vh - 52px)}
  .demo-root .hero-title{font-size:clamp(26px,8vw,42px)}
  .demo-root .hero-sub{font-size:14px;margin-bottom:36px}
  .demo-root .hero-run-btn{padding:14px 30px;font-size:15px;gap:8px}
  /* Demo wrapper */
  .demo-root #demo{padding:12px 14px 60px}
  /* Pipeline: horizontally scrollable compact row */
  .demo-root .pipeline-row{display:flex;overflow-x:auto;gap:0;margin-bottom:20px;padding-bottom:8px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .demo-root .pipeline-row::-webkit-scrollbar{display:none}
  .demo-root .stage-node{min-width:56px;gap:5px}
  .demo-root .stage-icon-wrap{width:44px;height:44px;border-radius:11px}
  .demo-root .stage-icon-wrap svg{width:18px;height:18px}
  .demo-root .stage-num{width:15px;height:15px;font-size:7px;top:-6px}
  .demo-root .stage-label{font-size:8.5px;white-space:nowrap}
  .demo-root .stage-status{font-size:7.5px;height:12px}
  .demo-root .stage-connector{flex-shrink:0;padding-top:0;margin-top:-14px}
  .demo-root .connector-line{width:14px}
  /* Phase 1-2-3: single column */
  .demo-root #phase-123{grid-template-columns:1fr;gap:12px}
  /* Spacing below pipeline before each phase */
  .demo-root #phase-123{margin-top:16px}
  .demo-root #phase-4{margin-top:20px}
  .demo-root #phase-56{margin-top:16px}
  /* Phase 4: full-width autoplay carousel */
  .demo-root .posts-3col{display:flex!important;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:0;padding-bottom:6px;grid-template-columns:unset}
  .demo-root .posts-3col::-webkit-scrollbar{display:none}
  .demo-root .posts-3col>*{scroll-snap-align:start;flex:0 0 100%;max-width:100%;padding:14px 14px!important;box-sizing:border-box}
  .demo-root #p4-dots{display:flex}
  .demo-root .phase4-header h2{font-size:20px}
  .demo-root .phase4-header p{font-size:13px}
  /* Phase 5-6: stack vertically; hide posts (already shown in phase 4) */
  .demo-root #phase-56{flex-direction:column;gap:14px}
  .demo-root #phase-56 .split-left{display:none!important}
  .demo-root #phase-56 .split-right{flex:none;width:100%}
  /* QA & pub metrics */
  .demo-root .pub-metrics{grid-template-columns:1fr 1fr}
  .demo-root .pub-val{font-size:22px}
  .demo-root .savings-bar .big{font-size:16px}
  /* Sticky nav */
  .demo-root nav{position:sticky;top:0;z-index:30;background:rgba(7,7,26,0.96);backdrop-filter:blur(16px)}
  /* Hide stats from nav — too cramped on mobile */
  .demo-root .nav-stats{display:none!important}
  /* Sticky pipeline below nav (~50px nav height) */
  .demo-root .pipeline-row{position:sticky;top:50px;z-index:20;background:rgba(7,7,26,0.96);border-bottom:1px solid rgba(255,255,255,.06);margin:0 -14px;padding:10px 14px 8px;box-sizing:border-box}
  /* Hide flash overlay on mobile */
  .demo-root #flash-overlay{display:none!important}
}
`

const VerifiedBadge = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#1d9bf0" style={{ verticalAlign: 'middle' }}>
    <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91-1.01-1.01-2.52-1.27-3.91-.81-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81-1.01 1.01-1.27 2.52-.81 3.91C3.38 9.33 2.5 10.57 2.5 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91 1.01 1.01 2.52 1.27 3.91.81.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81 1.01-1.01 1.27-2.52.81-3.91 1.31-.67 2.19-1.91 2.19-3.34z"/>
    <path fill="#fff" d="m10.78 15.58-2.99-3 1.06-1.06 1.93 1.93 4.43-4.43 1.06 1.06z"/>
  </svg>
)

const TwPost = (_props?: { carousel?: boolean }) => (
  <div className="tw-card">
    <div className="tw-header">
      <div className="tw-avatar">H</div>
      <div>
        <div className="tw-name">HousingDotCom <VerifiedBadge /></div>
        <div className="tw-handle">@HousingDotCom · 2m</div>
      </div>
    </div>
    <div className="tw-body">
      8,212 projects just got RERA show-cause notices in Maharashtra.<br /><br />
      Is your dream home on that list?<br /><br />
      Here's the 3-step verification checklist your builder doesn't want you to know 🧵⬇️
    </div>
    <div className="tw-tags">#RERA #Maharashtra #HomeBuyers #HousingDotCom</div>
    <div className="tw-actions">
      <span>💬 82</span>
      <span style={{ color: '#10b981' }}>🔁 247</span>
      <span style={{ color: '#f43f5e' }}>❤️ 1.2K</span>
      <span>👁 48K</span>
    </div>
  </div>
)

const IgPost = () => (
  <div className="ig-card-wrap">
    <div className="ig-header-bar">
      <div className="ig-avatar-ring"><div className="ig-avatar-inner">H</div></div>
      <div>
        <div className="ig-handle">housingdotcom</div>
        <div style={{ fontSize: '10px', color: '#64748b' }}>Sponsored</div>
      </div>
    </div>
    <div className="ig-visual">
      <div className="ig-brand-label">Housing.com</div>
      <div className="ig-main-text">Is your dream<br />home RERA safe?</div>
      <div className="ig-sub-text">8,212 projects under scrutiny.<br />Check before you buy.</div>
      <div className="ig-cta">Verify in 30 seconds →</div>
    </div>
    <div className="ig-footer-bar">
      <div className="ig-likes">3,842 likes</div>
      <div className="ig-caption">
        <span style={{ color: '#f1f5f9', fontWeight: 700 }}>housingdotcom </span>
        RERA check karo, phir ghar karo 🏠
      </div>
    </div>
  </div>
)

const LiPost = () => (
  <div className="li-card">
    <div className="li-post-header">
      <div className="li-avatar">H</div>
      <div>
        <div className="li-name">Housing.com</div>
        <div className="li-sub">Real Estate Platform · 2.3M followers</div>
      </div>
    </div>
    <div className="li-body">
      The RERA show-cause notices issued this week aren't just a headline — they're a red flag for every buyer with an under-construction flat in Maharashtra.<br /><br />
      <strong style={{ color: '#f1f5f9' }}>What buyers must do today:</strong> verify your project's registration status before the June 30 deadline.
    </div>
    <div className="li-banner">
      <div>
        <div className="li-banner-text">Check RERA Status →</div>
        <div className="li-banner-sub">housing.com/rera-verify</div>
      </div>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </div>
    <div className="li-stats"><span>👍 2,441</span><span>💬 187</span><span>🔁 312</span></div>
  </div>
)

export default function Demo() {
  const brand = useBrandName()
  const [phase, setPhase] = useState<'hero' | 'demo'>('hero')
  const slideRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phase4SlideRef = useRef(0)
  const phase4TimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
  const g = (id: string) => document.getElementById(id)!
  const isMob = () => window.innerWidth <= 767
  function mobileScrollTo(el: HTMLElement) {
    if (!isMob()) return
    setTimeout(() => {
      const root = document.querySelector('.demo-root') as HTMLElement
      if (!root) return
      const stickyH = 128 // nav (~50px) + pipeline (~70px) + gap
      const top = el.getBoundingClientRect().top + root.scrollTop - stickyH - 8
      root.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }, 120)
  }

  function goPhase4Slide(idx: number) {
    phase4SlideRef.current = idx
    const c = document.querySelector('.posts-3col') as HTMLElement
    if (c) c.scrollTo({ left: idx * c.offsetWidth, behavior: 'smooth' })
    for (let i = 0; i < 3; i++) {
      const d = document.getElementById('p4d-' + i)
      if (d) { d.style.width = i === idx ? '24px' : '8px'; d.style.background = i === idx ? '#818CF8' : 'rgba(255,255,255,.18)' }
    }
  }

  function startPhase4Carousel() {
    if (!isMob()) return
    if (phase4TimerRef.current) clearInterval(phase4TimerRef.current)
    phase4TimerRef.current = setInterval(() => {
      goPhase4Slide((phase4SlideRef.current + 1) % 3)
    }, 2500)
  }

  function setStage(n: number, state: string, txt: string) {
    const node = g('st-' + n)
    node.className = 'stage-node ' + state
    g('ss-' + n).textContent = txt
    if (state === 'active' || state === 'done') {
      const wrap = node.querySelector('.stage-icon-wrap') as HTMLElement
      wrap.style.animation = 'none'
      void wrap.offsetWidth
      wrap.style.animation = state === 'active'
        ? 'stage-pop .4s cubic-bezier(.34,1.56,.64,1) both, stage-pulse 1.5s ease-in-out 0.4s infinite'
        : 'stage-pop .35s cubic-bezier(.34,1.56,.64,1) both'
      if (isMob() && state === 'active') {
        const pipeline = document.querySelector('.pipeline-row') as HTMLElement
        if (pipeline) {
          const target = node.offsetLeft - pipeline.offsetWidth / 2 + node.offsetWidth / 2
          pipeline.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
        }
      }
    }
  }

  function litConnector(n: number) {
    const cl = document.getElementById('cl-' + n)
    const ca = document.getElementById('ca-' + n)
    if (cl) { cl.classList.add('lit'); ca?.classList.add('lit') }
  }

  function setProgress(pct: number) {
    (g('progress-track') as HTMLElement).style.width = pct + '%'
  }

  const TRENDS = [
    { name: '#RERA', vol: '82K searches/hr', pct: 92, color: '#8B5CF6' },
    { name: '#MaharashtraHousing', vol: '41K searches/hr', pct: 70, color: '#6366F1' },
    { name: '#Budget2026', vol: '1.1M searches/hr', pct: 100, color: '#06B6D4' },
    { name: '#RCBvsCSK', vol: '2.4M tweets', pct: 88, color: '#F59E0B' },
    { name: '#AuraFarming', vol: '680K tweets', pct: 65, color: '#EC4899' },
  ]

  function buildTrends() {
    const c = g('trend-items')
    c.innerHTML = ''
    TRENDS.forEach((t, i) => {
      c.innerHTML += `<div class="trend-item" style="opacity:0">
        <div class="trend-rank">#${i + 1}</div>
        <div class="trend-info">
          <div class="trend-name" style="color:${t.color}">${t.name}</div>
          <div class="trend-vol">${t.vol}</div>
          <div class="trend-bar-bg"><div class="trend-bar" style="background:${t.color}" data-w="${t.pct}"></div></div>
        </div></div>`
    })
    c.querySelectorAll('.trend-item').forEach((el, i) => {
      (el as HTMLElement).style.animation = `trend-slam .38s cubic-bezier(.34,1.56,.64,1) ${i * 65}ms both`
    })
    setTimeout(() => {
      document.querySelectorAll('.trend-bar').forEach(b => {
        (b as HTMLElement).style.width = b.getAttribute('data-w') + '%'
      })
    }, 150)
  }

  function revealCard(id: number, delay: number): Promise<void> {
    return new Promise(resolve => setTimeout(() => {
      const el = g('card-' + id) as HTMLElement
      el.style.animation = 'card-enter .5s cubic-bezier(.34,1.56,.64,1) both'
      el.style.opacity = '1'
      mobileScrollTo(el)
      setTimeout(resolve, 420)
    }, delay))
  }

  function doFlash() {
    const el = g('flash-overlay') as HTMLElement
    el.style.animation = 'none'
    void el.offsetWidth
    el.style.animation = 'flash-burst .8s cubic-bezier(.22,1,.36,1) both'
  }

  function dismissPhase123(): Promise<void> {
    return new Promise(resolve => {
      g('card-1').classList.add('scatter-l')
      g('card-2').classList.add('scatter-u')
      g('card-3').classList.add('scatter-r')
      setTimeout(resolve, 580)
    })
  }

  function showPhase4() {
    (g('phase-123') as HTMLElement).style.display = 'none'
    const p4 = g('phase-4') as HTMLElement
    p4.style.opacity = '0'
    p4.style.display = 'block'
    requestAnimationFrame(() => requestAnimationFrame(() => {
      p4.style.opacity = ''
      p4.classList.add('entering')
    }))
    mobileScrollTo(p4)
    setTimeout(startPhase4Carousel, 900)
  }

  function qaHTML(): string {
    return `<div class="out-card card-in" style="animation:slam-right .52s cubic-bezier(.34,1.56,.64,1) both">
      <div class="card-eyebrow" style="color:#10B981"><span class="eyebrow-dot" style="background:#10B981"></span> Quality Gate — All Posts Approved</div>
      <div class="qa-metric"><div class="qa-metric-header"><span class="qa-metric-name">Twitter Thread</span><span class="qa-metric-score">8.9 / 10</span></div><div class="qa-bar-bg"><div class="qa-bar" data-w="89"></div></div></div>
      <div class="qa-metric"><div class="qa-metric-header"><span class="qa-metric-name">Instagram Post</span><span class="qa-metric-score">9.1 / 10</span></div><div class="qa-bar-bg"><div class="qa-bar" data-w="91"></div></div></div>
      <div class="qa-metric"><div class="qa-metric-header"><span class="qa-metric-name">LinkedIn Article</span><span class="qa-metric-score">8.4 / 10</span></div><div class="qa-bar-bg"><div class="qa-bar" data-w="84"></div></div></div>
      <div class="qa-metric"><div class="qa-metric-header"><span class="qa-metric-name">Housing News</span><span class="qa-metric-score">9.3 / 10</span></div><div class="qa-bar-bg"><div class="qa-bar" data-w="93"></div></div></div>
      <div class="qa-verdict-row">
        <span class="qa-chip pass" style="display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Brand Safe</span>
        <span class="qa-chip pass" style="display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 4 Approved</span>
        <span class="qa-chip revised" style="display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> 1 Auto-Revised</span>
      </div>
    </div>`
  }

  function pubHTML(): string {
    return `<div class="out-card card-in" style="margin-top:16px;animation:slam-right .52s cubic-bezier(.34,1.56,.64,1) .06s both">
      <div class="card-eyebrow" style="color:#F59E0B"><span class="eyebrow-dot" style="background:#F59E0B"></span> Live Across 5 Channels</div>
      <div class="pub-metrics">
        <div class="pub-metric"><div class="pub-val" style="color:#8B5CF6">5</div><div class="pub-lbl">Posts Published</div></div>
        <div class="pub-metric"><div class="pub-val" style="color:#06B6D4">97s</div><div class="pub-lbl">Total Time</div></div>
        <div class="pub-metric"><div class="pub-val" style="color:#ef4444">$225</div><div class="pub-lbl">Agency Charges</div></div>
        <div class="pub-metric"><div class="pub-val" style="color:#F59E0B">8.9</div><div class="pub-lbl">Avg Quality</div></div>
      </div>
      <div style="margin-bottom:14px">
        <span class="platform-tag pt-tw" style="display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Twitter</span>
        <span class="platform-tag pt-ig" style="display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Instagram</span>
        <span class="platform-tag pt-li" style="display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> LinkedIn</span>
        <span class="platform-tag pt-yt" style="display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> YouTube Shorts</span>
        <span class="platform-tag pt-news" style="display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> News Article</span>
      </div>
      <div class="savings-bar">
        <div class="big">321× cheaper than an agency</div>
        <div class="sub">Agency charges $45/post · An in-house team $22/post · ${brand} Scale plan $0.18/post · Same topic takes 4–6 hours with a content team</div>
      </div>
    </div>`
  }

  function goSlide(idx: number) {
    const prev = slideRef.current
    document.getElementById('slide-' + prev)?.classList.remove('active')
    document.getElementById('tab-' + prev)?.classList.remove('active')
    document.getElementById('dot-' + prev)?.classList.remove('active')
    slideRef.current = idx
    document.getElementById('slide-' + idx)?.classList.add('active')
    document.getElementById('tab-' + idx)?.classList.add('active')
    document.getElementById('dot-' + idx)?.classList.add('active')
    document.querySelectorAll('.car-dot').forEach((d, i) => {
      const el = d as HTMLElement
      el.style.width = i === idx ? '24px' : '8px'
      el.style.background = i === idx ? '#818CF8' : 'rgba(255,255,255,.18)'
    })
  }

  function startCarousel() {
    timerRef.current = setInterval(() => goSlide((slideRef.current + 1) % 3), 2800)
  }

  async function transitionToPhase56() {
    const p56 = g('phase-56') as HTMLElement
    if (isMob()) {
      // Mobile: keep phase-4 visible, show phase-56 stacked below it
      p56.style.display = 'flex'
      const right = g('split-right')
      right.innerHTML = qaHTML()
      await sleep(100)
      document.querySelectorAll('.qa-bar[data-w]').forEach(b => {
        (b as HTMLElement).style.width = b.getAttribute('data-w') + '%'
      })
      mobileScrollTo(p56)
      return
    }
    const p4 = g('phase-4') as HTMLElement
    // Pre-render phase-56 invisible so there's no empty-gap flash when phase-4 hides
    p56.style.opacity = '0'
    p56.style.display = 'flex'
    doFlash()
    p4.style.transition = 'opacity .18s ease, transform .18s ease'
    p4.style.opacity = '0'
    p4.style.transform = 'scale(1.04)'
    await sleep(200)
    p4.style.display = 'none'
    p4.style.transition = ''
    p56.style.opacity = ''
    ;(p56.querySelector('.split-left') as HTMLElement).style.animation = 'slam-left .52s cubic-bezier(.34,1.56,.64,1) both'
    const right = g('split-right')
    right.innerHTML = qaHTML()
    ;(right.querySelector('.out-card') as HTMLElement).style.animation = 'slam-right .52s cubic-bezier(.34,1.56,.64,1) .08s both'
    await sleep(280)
    document.querySelectorAll('.qa-bar[data-w]').forEach(b => {
      (b as HTMLElement).style.width = b.getAttribute('data-w') + '%'
    })
    startCarousel()
  }

  async function startDemo() {
    setPhase('demo')
    await sleep(50) // let React render the demo section
    ;(g('navStats') as HTMLElement).style.display = 'flex'
    ;(g('navRunBtn') as HTMLElement).style.display = 'flex'

    setProgress(5); setStage(1, 'active', 'Scanning trends…')
    await sleep(1400)
    buildTrends(); await revealCard(1, 0)
    setStage(1, 'done', '15 sources · 2.1s'); litConnector(1); setProgress(18)

    await sleep(250); setStage(2, 'active', 'Investigating stories…')
    await sleep(1700)
    await revealCard(2, 0)
    setStage(2, 'done', '8 stories found · 14.2s'); litConnector(2); setProgress(34)

    await sleep(250); setStage(3, 'active', 'Crafting your angle…')
    await sleep(1300)
    await revealCard(3, 0)
    setStage(3, 'done', '5 briefs ready · 12.1s'); litConnector(3); setProgress(52)

    await sleep(500); setStage(4, 'active', 'Writing for all platforms…')
    await sleep(2800)
    await dismissPhase123()
    if (isMob()) { showPhase4() } else { doFlash(); showPhase4() }
    await sleep(900)
    setStage(4, 'done', '5 drafts · 18.4s'); litConnector(4); setProgress(70)

    await sleep(700); setStage(5, 'active', 'Checking brand safety…')
    await sleep(2200)
    await transitionToPhase56()
    setStage(5, 'done', '4 approved, 1 revised · 8.9 avg'); litConnector(5); setProgress(88)

    await sleep(500); setStage(6, 'active', 'Going live…')
    await sleep(1600)
    g('split-right').insertAdjacentHTML('beforeend', pubHTML())
    if (isMob()) mobileScrollTo(g('split-right') as HTMLElement)
    setStage(6, 'done', 'All 5 platforms live'); setProgress(100)
    g('stat-posts').textContent = '5'
    g('stat-time').textContent = '97s'
    g('stat-cost').textContent = '$225'
  }

  function restartDemo() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (phase4TimerRef.current) { clearInterval(phase4TimerRef.current); phase4TimerRef.current = null }
    slideRef.current = 0
    phase4SlideRef.current = 0
    const p4c = document.querySelector('.posts-3col') as HTMLElement
    if (p4c) p4c.scrollLeft = 0
    for (let i = 0; i < 3; i++) {
      const d = document.getElementById('p4d-' + i)
      if (d) { d.style.width = i === 0 ? '24px' : '8px'; d.style.background = i === 0 ? '#818CF8' : 'rgba(255,255,255,.18)' }
    }
    setProgress(0)
    ;(g('navStats') as HTMLElement).style.display = 'none'
    ;(g('navRunBtn') as HTMLElement).style.display = 'none'
    for (let i = 1; i <= 6; i++) {
      const node = document.getElementById('st-' + i)
      if (node) node.className = 'stage-node'
      const ss = document.getElementById('ss-' + i)
      if (ss) ss.textContent = ''
      const cl = document.getElementById('cl-' + i)
      const ca = document.getElementById('ca-' + i)
      if (cl) { cl.classList.remove('lit'); ca?.classList.remove('lit') }
    }
    ;(g('phase-123') as HTMLElement).style.display = 'grid'
    ;['card-1', 'card-2', 'card-3'].forEach(id => {
      const el = g(id) as HTMLElement
      el.classList.remove('scatter-l', 'scatter-u', 'scatter-r')
      el.style.animation = 'none'; el.style.opacity = '0'
    })
    const p4 = g('phase-4') as HTMLElement
    p4.style.display = 'none'; p4.classList.remove('entering')
    p4.style.transition = ''; p4.style.opacity = ''; p4.style.transform = ''
    const p56r = g('phase-56') as HTMLElement
    p56r.style.display = 'none'; p56r.style.opacity = ''
    g('split-right').innerHTML = ''
    document.querySelectorAll('.post-slide').forEach((s, i) => s.classList.toggle('active', i === 0))
    document.querySelectorAll('.plat-tab').forEach((t, i) => t.classList.toggle('active', i === 0))
    document.querySelectorAll('.car-dot').forEach((d, i) => {
      const el = d as HTMLElement
      d.classList.toggle('active', i === 0)
      el.style.width = i === 0 ? '24px' : '8px'
      el.style.background = i === 0 ? '#818CF8' : 'rgba(255,255,255,.18)'
    })
    document.querySelectorAll('.qa-bar').forEach(b => (b as HTMLElement).style.width = '0')
    document.querySelectorAll('.trend-bar').forEach(b => (b as HTMLElement).style.width = '0')
    setPhase('hero')
  }

  return (
    <div className="demo-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div id="progress-track" />
      <div id="flash-overlay" />
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />
      <div className="dot-grid" />

      <nav>
        <a href="/" className="nav-logo" style={{ textDecoration: 'none' }}>
          <span className="nav-name grad-text">{brand}</span>
        </a>
        <div className="nav-stats" id="navStats" style={{ display: 'none' }}>
          <div className="stat"><span className="stat-val grad-text" id="stat-posts">0</span><span className="stat-lbl">Posts Created</span></div>
          <div className="stat"><span className="stat-val grad-text" id="stat-time">–</span><span className="stat-lbl">Run Time</span></div>
          <div className="stat"><span className="stat-val grad-text" id="stat-cost">–</span><span className="stat-lbl">vs Agency</span></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <a href="/pricing" className="nav-pricing-link">Pricing</a>
          <button className="run-btn" id="navRunBtn" style={{ display: 'none', alignItems: 'center', gap: '6px' }} onClick={restartDemo}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
            </svg>{' '}Restart
          </button>
        </div>
      </nav>

      {/* HERO */}
      <div id="hero" style={{ display: phase === 'hero' ? 'flex' : 'none' }}>
        <div className="hero-badge"><span className="live-dot" /> AI #TrendJacker</div>
        <h1 className="hero-title">Watch <span className="grad-text">{brand}</span> work<br />in real time.</h1>
        <p className="hero-sub">From a trending topic to 5 platform-ready posts — fully automated, in under 2 minutes.</p>
        <button className="hero-run-btn" onClick={startDemo}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>{' '}Watch it happen
        </button>
        <p className="hero-hint">No setup. No login. Just the magic.</p>
      </div>

      {/* DEMO */}
      <div id="demo" style={{ display: phase === 'demo' ? 'block' : 'none' }}>
        {/* Pipeline row */}
        <div className="pipeline-row">
          <div className="stage-node" id="st-1">
            <div className="stage-icon-wrap">
              <span className="stage-num">1</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12" y2="20"/>
              </svg>
            </div>
            <span className="stage-label">Trend Pulse</span><span className="stage-status" id="ss-1" />
          </div>
          <div className="stage-connector"><div className="connector-line" id="cl-1" /><div className="connector-arrow" id="ca-1">▶</div></div>

          <div className="stage-node" id="st-2">
            <div className="stage-icon-wrap">
              <span className="stage-num">2</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <span className="stage-label">Research</span><span className="stage-status" id="ss-2" />
          </div>
          <div className="stage-connector"><div className="connector-line" id="cl-2" /><div className="connector-arrow" id="ca-2">▶</div></div>

          <div className="stage-node" id="st-3">
            <div className="stage-icon-wrap">
              <span className="stage-num">3</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
              </svg>
            </div>
            <span className="stage-label">Strategy</span><span className="stage-status" id="ss-3" />
          </div>
          <div className="stage-connector"><div className="connector-line" id="cl-3" /><div className="connector-arrow" id="ca-3">▶</div></div>

          <div className="stage-node" id="st-4">
            <div className="stage-icon-wrap">
              <span className="stage-num">4</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
            </div>
            <span className="stage-label">Content Created</span><span className="stage-status" id="ss-4" />
          </div>
          <div className="stage-connector"><div className="connector-line" id="cl-4" /><div className="connector-arrow" id="ca-4">▶</div></div>

          <div className="stage-node" id="st-5">
            <div className="stage-icon-wrap">
              <span className="stage-num">5</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
              </svg>
            </div>
            <span className="stage-label">Quality Gate</span><span className="stage-status" id="ss-5" />
          </div>
          <div className="stage-connector"><div className="connector-line" id="cl-5" /><div className="connector-arrow" id="ca-5">▶</div></div>

          <div className="stage-node" id="st-6">
            <div className="stage-icon-wrap">
              <span className="stage-num">6</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </div>
            <span className="stage-label">Published</span><span className="stage-status" id="ss-6" />
          </div>
        </div>

        {/* Phase 1-2-3 */}
        <div id="phase-123">
          <div className="out-card card-in" id="card-1" style={{ opacity: 0, animation: 'none' }}>
            <div className="card-eyebrow" style={{ color: '#8B5CF6' }}>
              <span className="eyebrow-dot" /> India Trending Right Now
            </div>
            <div id="trend-items" />
          </div>

          <div className="out-card card-in" id="card-2" style={{ opacity: 0, animation: 'none' }}>
            <div className="card-eyebrow" style={{ color: '#6366F1' }}>
              <span className="eyebrow-dot" style={{ background: '#6366F1' }} /> Story Intelligence
            </div>
            <div className="research-story">
              <div className="story-source">MahaRERA Official · 2 hours ago</div>
              <div className="story-headline">Maharashtra RERA Issues Show-Cause Notices to 8,212 Projects</div>
              <div className="story-insight">Largest enforcement action in RERA history. First-time buyers in suburban areas most at risk. Deadline extended to June 30, 2026.</div>
              <span className="story-tag">HIGH RELEVANCE — Buyer protection angle</span>
            </div>
            <div className="research-story" style={{ opacity: 0.65 }}>
              <div className="story-source">Economic Times Realty · 5 hours ago</div>
              <div className="story-headline">Budget 2026: Stamp Duty Holiday Extended for Women Buyers</div>
              <div className="story-insight">Finance ministry extends 1% stamp duty rebate. Policy change effective April 1, 2026.</div>
              <span className="story-tag">POLICY — Direct buyer benefit</span>
            </div>
          </div>

          <div className="out-card card-in" id="card-3" style={{ opacity: 0, animation: 'none' }}>
            <div className="card-eyebrow" style={{ color: '#3B82F6' }}>
              <span className="eyebrow-dot" style={{ background: '#3B82F6' }} /> Content Strategy — 5 Briefs
            </div>
            <div className="brief-card" style={{ background: 'rgba(29,161,242,.08)', border: '1px solid rgba(29,161,242,.2)' }}>
              <div className="brief-platform-dot" style={{ background: '#1DA1F2' }} />
              <div>
                <div className="brief-platform" style={{ color: '#1DA1F2' }}>Twitter</div>
                <div className="brief-angle">"Is your dream home on the RERA notice list?" — Fear → empowerment hook</div>
                <div className="brief-tone">Hinglish · Thread · High urgency</div>
              </div>
            </div>
            <div className="brief-card" style={{ background: 'rgba(193,53,132,.08)', border: '1px solid rgba(193,53,132,.2)' }}>
              <div className="brief-platform-dot" style={{ background: '#C13584' }} />
              <div>
                <div className="brief-platform" style={{ color: '#C13584' }}>Instagram</div>
                <div className="brief-angle">Branded checklist: "3 RERA checks before you buy"</div>
                <div className="brief-tone">Visual · Reel-ready</div>
              </div>
            </div>
            <div className="brief-card" style={{ background: 'rgba(10,102,194,.08)', border: '1px solid rgba(10,102,194,.2)' }}>
              <div className="brief-platform-dot" style={{ background: '#0A66C2' }} />
              <div>
                <div className="brief-platform" style={{ color: '#0A66C2' }}>LinkedIn</div>
                <div className="brief-angle">Buyer protection authority piece with data citation</div>
                <div className="brief-tone">Professional · B2B · Poll</div>
              </div>
            </div>
          </div>
        </div>

        {/* Phase 4 */}
        <div id="phase-4">
          <div className="phase4-header card-in">
            <h2>Platform posts <span className="grad-text">generated in 18 seconds.</span></h2>
            <p>Three platforms. Three native voices. Zero human effort.</p>
          </div>
          <div className="posts-3col card-in" style={{ animationDelay: '.12s' }}>
            <TwPost />
            <IgPost />
            <LiPost />
          </div>
          <div id="p4-dots" style={{ gap:8, justifyContent:'center', marginTop:10 }}>
            <button id="p4d-0" className="car-dot active" style={{ width:24, background:'#818CF8' }} onClick={() => goPhase4Slide(0)} />
            <button id="p4d-1" className="car-dot" onClick={() => goPhase4Slide(1)} />
            <button id="p4d-2" className="car-dot" onClick={() => goPhase4Slide(2)} />
          </div>
        </div>

        {/* Phase 5-6 */}
        <div id="phase-56">
          <div className="split-left">
            <div className="card-eyebrow" style={{ color: '#06B6D4', marginBottom: '14px' }}>
              <span className="eyebrow-dot" style={{ background: '#06B6D4' }} /> Platform Posts — AI Generated
            </div>
            <div className="plat-tabs" id="plat-tabs">
              <button className="plat-tab active" id="tab-0" onClick={() => goSlide(0)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63Z"/>
                </svg>
                Twitter
              </button>
              <button className="plat-tab" id="tab-1" onClick={() => goSlide(1)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                Instagram
              </button>
              <button className="plat-tab" id="tab-2" onClick={() => goSlide(2)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </button>
            </div>
            <div className="carousel-slides" id="carousel-slides">
              <div className="post-slide active" id="slide-0"><TwPost carousel /></div>
              <div className="post-slide" id="slide-1"><IgPost /></div>
              <div className="post-slide" id="slide-2"><LiPost /></div>
            </div>
            <div className="car-dots" id="car-dots">
              <button className="car-dot active" id="dot-0" onClick={() => goSlide(0)} />
              <button className="car-dot" id="dot-1" onClick={() => goSlide(1)} />
              <button className="car-dot" id="dot-2" onClick={() => goSlide(2)} />
            </div>
          </div>
          <div className="split-right" id="split-right" />
        </div>
      </div>
    </div>
  )
}
