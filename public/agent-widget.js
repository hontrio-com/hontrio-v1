(function(){
'use strict';
var cfg=window.HontrioAgent||{};
var UID=cfg.userId||'';
var COLOR=cfg.color||'#2563eb';
var POS=cfg.position||'bottom-right';
var SZ=cfg.size||'medium';
var OFFSET=cfg.bottomOffset||20;
var BASE=(cfg.apiBase||'https://hontrio.com').replace(/\/$/,'');
if(!UID){console.warn('[Hontrio] userId lipsește');return;}

var IS_R=POS!=='bottom-left';
var BTN_S=SZ==='small'?48:SZ==='large'?64:56;
var ICN_S=SZ==='small'?20:SZ==='large'?28:24;
var isOpen=false,isLoading=false,msgs=[],sid='s'+Math.random().toString(36).slice(2,11);
var vid;try{vid=localStorage.getItem('_hv')||'v'+Date.now().toString(36);localStorage.setItem('_hv',vid);}catch(e){vid='v'+Date.now().toString(36);}
var unread=0,welcomed=false,agentName='Asistent';
var triggerFired=false; // max 1 trigger per sesiune

function rgb(h){h=h.replace('#','');return parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16);}
var C=rgb(COLOR);

// ── STYLES ───────────────────────────────────────────────────────────────────
var s=document.createElement('style');
s.textContent=
'#_h *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:0;}'+
'#_h_b{position:fixed;'+(IS_R?'right':'left')+':20px;bottom:'+OFFSET+'px;width:'+BTN_S+'px;height:'+BTN_S+'px;'+
'border-radius:50%;background:'+COLOR+';border:none;cursor:pointer;z-index:2147483646;'+
'box-shadow:0 4px 16px rgba('+C+',.4),0 2px 6px rgba(0,0,0,.1);'+
'display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;outline:none;}'+
'#_h_b:hover{transform:scale(1.08);}'+
'#_h_b:active{transform:scale(.95);}'+
'#_h_bg{position:absolute;top:-3px;'+(IS_R?'right':'left')+':-3px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;'+
'min-width:18px;height:18px;border-radius:9px;border:2px solid #fff;display:none;align-items:center;justify-content:center;padding:0 3px;}'+

// Bubble trigger proactiv deasupra butonului
'#_h_bl{position:fixed;'+(IS_R?'right':'left')+':16px;bottom:'+(OFFSET+BTN_S+12)+'px;'+
'max-width:260px;background:#fff;border-radius:16px;border-bottom-'+(IS_R?'right':'left')+'-radius:4px;'+
'padding:12px 14px 10px;box-shadow:0 4px 20px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.06);'+
'z-index:2147483645;display:none;flex-direction:column;gap:8px;'+
'animation:_h_bi .3s cubic-bezier(.34,1.3,.64,1);}'+
'@keyframes _h_bi{from{opacity:0;transform:translateY(10px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}'+
'#_h_bl_t{font-size:13px;color:#111827;line-height:1.45;}'+
'#_h_bl_a{display:flex;gap:6px;}'+
'._h_bl_y{flex:1;padding:7px;font-size:12px;font-weight:600;border:none;border-radius:10px;cursor:pointer;'+
'background:'+COLOR+';color:#fff;transition:opacity .15s;}'+
'._h_bl_y:hover{opacity:.9;}'+
'._h_bl_n{flex:1;padding:7px;font-size:12px;font-weight:500;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;'+
'background:#f9fafb;color:#6b7280;transition:background .15s;}'+
'._h_bl_n:hover{background:#f3f4f6;}'+
'#_h_bl_x{position:absolute;top:8px;right:8px;background:none;border:none;cursor:pointer;color:#9ca3af;padding:2px;}'+
'#_h_bl_x:hover{color:#6b7280;}'+

'#_h_w{position:fixed;'+(IS_R?'right':'left')+':16px;bottom:'+(OFFSET+BTN_S+8)+'px;'+
'width:min(380px,calc(100vw - 28px));height:min(570px,calc(100vh - 90px));'+
'background:#fff;border-radius:16px;overflow:hidden;z-index:2147483645;'+
'box-shadow:0 8px 40px rgba(0,0,0,.14),0 2px 12px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.06);'+
'display:flex;flex-direction:column;'+
'transform:scale(.9) translateY(12px);opacity:0;pointer-events:none;'+
'transition:transform .25s cubic-bezier(.34,1.3,.64,1),opacity .2s;}'+
'#_h_w.on{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}'+

'#_h_hd{padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;background:'+COLOR+';}'+
'#_h_av{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;}'+
'._h_hn{font-size:14px;font-weight:600;color:#fff;}'+
'._h_hs{font-size:11px;color:rgba(255,255,255,.8);display:flex;align-items:center;gap:4px;margin-top:2px;}'+
'._h_hd{width:6px;height:6px;border-radius:50%;background:#4ade80;}'+
'#_h_cl{margin-left:auto;background:rgba(255,255,255,.15);border:none;width:28px;height:28px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;}'+
'#_h_cl:hover{background:rgba(255,255,255,.25);}'+

'#_h_ms{flex:1 !important;overflow-y:auto !important;padding:16px 14px !important;display:flex !important;flex-direction:column !important;gap:12px !important;background:#f9fafb !important;scroll-behavior:smooth !important;}'+
'#_h_ms::-webkit-scrollbar{width:4px;}'+
'#_h_ms::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:4px;}'+
'._h_r{display:flex !important;flex-direction:column !important;gap:6px !important;max-width:82% !important;list-style:none !important;}'+
'._h_r.u{align-self:flex-end !important;align-items:flex-end !important;}'+
'._h_r.b{align-self:flex-start !important;align-items:flex-start !important;}'+
'._h_bb{padding:12px 16px !important;border-radius:18px !important;font-size:14px !important;line-height:1.6 !important;word-break:break-word !important;display:block !important;margin:0 !important;}'+
'._h_r.u ._h_bb{background:'+COLOR+' !important;color:#fff !important;border-bottom-right-radius:5px !important;}'+
'._h_r.b ._h_bb{background:#fff !important;color:#111827 !important;border-bottom-left-radius:5px !important;box-shadow:0 1px 4px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.05) !important;}'+

'._h_cs{display:flex;flex-direction:column;gap:7px;width:100%;}'+
'._h_c{background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,.06);transition:box-shadow .2s,border-color .2s;}'+
'._h_c:hover{box-shadow:0 3px 12px rgba(0,0,0,.1);border-color:rgba('+C+',.3);}'+
'._h_ct{display:flex;align-items:center;}'+
'._h_ci{width:80px;height:80px;object-fit:cover;flex-shrink:0;background:#f3f4f6;}'+
'._h_cp{width:80px;height:80px;flex-shrink:0;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:26px;}'+
'._h_cd{flex:1;min-width:0;padding:10px 12px;}'+
'._h_ctt{font-size:13px;font-weight:600;color:#111827;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}'+
'._h_cpr{font-size:15px;font-weight:700;color:'+COLOR+';margin-top:6px;}'+
'._h_cbs{display:flex;border-top:1px solid #f3f4f6;}'+
'._h_cb{flex:1;padding:9px 6px;font-size:12.5px;font-weight:600;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:background .15s;}'+
'._h_cb.vw{background:#f9fafb;color:'+COLOR+';border-right:1px solid #f3f4f6;}'+
'._h_cb.vw:hover{background:#f3f4f6;}'+
'._h_cb.ac{background:'+COLOR+';color:#fff;}'+
'._h_cb.ac:hover{opacity:.9;}'+
'._h_cb.ac:disabled{opacity:.5;cursor:default;}'+
'._h_cb.ac.ok{background:#22c55e;}'+

'._h_qs{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;}'+
'._h_q{font-size:13px !important;font-weight:500 !important;color:'+COLOR+' !important;background:#fff !important;'+
'border:1.5px solid rgba('+C+',.35) !important;border-radius:20px !important;padding:6px 14px !important;'+
'cursor:pointer;transition:all .15s;white-space:nowrap;line-height:1.4 !important;}'+
'._h_q:hover{background:rgba('+C+',.07) !important;border-color:rgba('+C+',.6) !important;}'+
'._h_q:disabled{opacity:.4;cursor:default;}'+

'._h_wa{display:flex;align-items:center;gap:9px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:10px 12px;cursor:pointer;text-decoration:none;transition:background .15s;}'+
'._h_wa:hover{background:#dcfce7;}'+
'._h_wat{font-size:12.5px;font-weight:700;color:#166534;}'+
'._h_was{font-size:11px;color:#16a34a;margin-top:1px;}'+

'._h_ty{align-self:flex-start;background:#fff;padding:12px 16px;border-radius:18px;border-bottom-left-radius:5px;box-shadow:0 1px 4px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.05);display:flex;gap:5px;align-items:center;}'+
'._h_td{width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:_h_b .85s infinite;}'+
'._h_td:nth-child(2){animation-delay:.15s;}._h_td:nth-child(3){animation-delay:.3s;}'+
'@keyframes _h_b{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}'+

'#_h_ft{padding:10px 12px 13px;background:#fff;border-top:1px solid #f3f4f6;flex-shrink:0;}'+
'#_h_fm{display:flex;gap:7px;align-items:flex-end;}'+
'#_h_in{flex:1;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:10px 14px;font-size:14px;color:#111827;outline:none;resize:none;min-height:42px;max-height:100px;line-height:1.5;transition:border-color .15s,background .15s;}'+
'#_h_in:focus{border-color:'+COLOR+';background:#fff;}'+
'#_h_in::placeholder{color:#9ca3af;}'+
'#_h_sn{width:42px;height:42px;border-radius:12px;border:none;background:'+COLOR+';color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .15s,transform .15s;}'+
'#_h_sn:hover{opacity:.9;transform:scale(1.05);}'+
'#_h_sn:disabled{opacity:.35;cursor:default;transform:none;}'+
'._h_br{text-align:center;font-size:10px;color:#d1d5db;padding:5px 0 0;}'+
'._h_br a{color:#9ca3af;text-decoration:none;}._h_br a:hover{color:'+COLOR+';}'+
'@media(max-width:480px){#_h_w{left:8px!important;right:8px!important;width:auto!important;}}';
document.head.appendChild(s);

// ── ICONS ────────────────────────────────────────────────────────────────────
function iChat(){return'<svg width="'+ICN_S+'" height="'+ICN_S+'" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';}
function iX(n){n=n||14;return'<svg width="'+n+'" height="'+n+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';}
function iSend(){return'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';}
function iBot(){return'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 11V8"/><circle cx="12" cy="6" r="2"/><path d="M8 16h.01M16 16h.01"/></svg>';}
function iWA(){return'<svg width="20" height="20" viewBox="0 0 24 24" fill="#16a34a"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';}
function iCart(){return'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>';}
function iEye(){return'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';}
function iOk(){return'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>';}

// ── DOM ──────────────────────────────────────────────────────────────────────
var wrap=document.createElement('div');wrap.id='_h';
var btn=document.createElement('button');btn.id='_h_b';btn.setAttribute('aria-label','Chat');
var badge=document.createElement('div');badge.id='_h_bg';
btn.innerHTML=iChat();btn.appendChild(badge);

// Bubble proactiv
var bubble=document.createElement('div');bubble.id='_h_bl';
bubble.innerHTML=
  '<button id="_h_bl_x" aria-label="Închide">'+iX(10)+'</button>'+
  '<div id="_h_bl_t"></div>'+
  '<div id="_h_bl_a">'+
    '<button class="_h_bl_y" id="_h_bl_y">Da, ajută-mă!</button>'+
    '<button class="_h_bl_n" id="_h_bl_n">Nu, mulțumesc</button>'+
  '</div>';

var win=document.createElement('div');win.id='_h_w';
win.innerHTML=
  '<div id="_h_hd">'+
    '<div id="_h_av">'+iBot()+'</div>'+
    '<div><div class="_h_hn" id="_h_an">Asistent</div><div class="_h_hs"><div class="_h_hd"></div><span>Online</span></div></div>'+
    '<button id="_h_cl" aria-label="Închide">'+iX()+'</button>'+
  '</div>'+
  '<div id="_h_ms" role="log" aria-live="polite"></div>'+
  '<div id="_h_ft">'+
    '<div id="_h_fm">'+
      '<textarea id="_h_in" placeholder="Scrie un mesaj..." rows="1"></textarea>'+
      '<button id="_h_sn" aria-label="Trimite">'+iSend()+'</button>'+
    '</div>'+
    '<div class="_h_br">Powered by <a href="https://hontrio.com" target="_blank" rel="noopener">Hontrio</a></div>'+
  '</div>';

wrap.appendChild(bubble);wrap.appendChild(btn);wrap.appendChild(win);document.body.appendChild(wrap);

var inp=document.getElementById('_h_in');
btn.addEventListener('click',toggle);
document.getElementById('_h_cl').addEventListener('click',closeChat);
document.getElementById('_h_sn').addEventListener('click',function(){doSend();});
document.getElementById('_h_bl_x').addEventListener('click',hideBubble);
document.getElementById('_h_bl_n').addEventListener('click',hideBubble);
document.getElementById('_h_bl_y').addEventListener('click',function(){hideBubble();openChat();});
inp.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}});
inp.addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px';});

// ── BUBBLE PROACTIV ──────────────────────────────────────────────────────────
function showBubble(msg){
  if(isOpen||triggerFired)return;
  triggerFired=true;
  var bl=document.getElementById('_h_bl');
  document.getElementById('_h_bl_t').textContent=msg;
  bl.style.display='flex';
  // Auto-hide după 12 secunde
  setTimeout(function(){hideBubble();},12000);
}

function hideBubble(){
  var bl=document.getElementById('_h_bl');
  if(bl)bl.style.display='none';
}

// ── PAGE TYPE DETECTION ───────────────────────────────────────────────────────
// Generic — funcționează pe WooCommerce, Shopify, OpenCart, etc.
function getPageType(){
  var url=window.location.href.toLowerCase();
  var path=window.location.pathname.toLowerCase();
  var bodyClass=(document.body.className||'').toLowerCase();

  // Cart
  if(path.indexOf('/cart')!==-1||path.indexOf('/cos')!==-1||
     bodyClass.indexOf('woocommerce-cart')!==-1||
     document.querySelector('.cart-page,.checkout-cart,#cart')!==-1)return 'cart';

  // Checkout
  if(path.indexOf('/checkout')!==-1||path.indexOf('/finalizare')!==-1||
     bodyClass.indexOf('woocommerce-checkout')!==-1)return 'checkout';

  // Product
  if(bodyClass.indexOf('single-product')!==-1||
     document.querySelector('.product-page,.product_page,[itemtype*="Product"]'))return 'product';
  if(path.match(/\/produs\/|\/product\/|\/p\/[0-9]|\/item\//))return 'product';

  // Category
  if(bodyClass.indexOf('tax-product_cat')!==-1||bodyClass.indexOf('term-')!==-1||
     path.indexOf('/categorie')!==-1||path.indexOf('/category')!==-1)return 'category';

  // Contact
  if(path.indexOf('/contact')!==-1)return 'contact';

  // Home
  if(path==='/'||path===''||bodyClass.indexOf('home')!==-1)return 'home';

  return 'other';
}

function pageMatches(pages){
  if(!pages||pages.indexOf('all')!==-1)return true;
  var pt=getPageType();
  return pages.indexOf(pt)!==-1;
}

// ── COOLDOWN ─────────────────────────────────────────────────────────────────
function getCooldownKey(triggerId){return '_hc_'+triggerId;}

function isOnCooldown(triggerId,cooldownHours){
  try{
    var key=getCooldownKey(triggerId);
    var last=localStorage.getItem(key);
    if(!last)return false;
    var diff=(Date.now()-parseInt(last))/(1000*60*60);
    return diff<cooldownHours;
  }catch(e){return false;}
}

function setCooldown(triggerId){
  try{localStorage.setItem(getCooldownKey(triggerId),Date.now().toString());}catch(e){}
}

// ── TRIGGERS ENGINE ───────────────────────────────────────────────────────────
var _triggers=[];
var _timers=[];

function loadAndInitTriggers(){
  fetch(BASE+'/api/agent/triggers?userId='+UID)
    .then(function(r){return r.ok?r.json():null;})
    .then(function(d){
      if(!d||!d.triggers)return;
      _triggers=d.triggers;
      initTriggers();
    })
    .catch(function(){});
}

function fireTrigger(trigger){
  if(triggerFired||isOpen)return;
  if(isOnCooldown(trigger.id,trigger.cooldown_hours))return;
  setCooldown(trigger.id);
  showBubble(trigger.message);
}

function initTriggers(){
  // Sortează după prioritate descrescător
  _triggers.sort(function(a,b){return b.priority-a.priority;});

  _triggers.forEach(function(t){
    var cond=t.conditions||{};

    if(!pageMatches(cond.pages))return;

    switch(t.type){

      case 'exit_intent':
        document.addEventListener('mouseleave',function handler(e){
          if(e.clientY<=0){
            document.removeEventListener('mouseleave',handler);
            fireTrigger(t);
          }
        });
        break;

      case 'time_on_page':
        var sec=parseInt(cond.seconds)||45;
        var timer=setTimeout(function(){fireTrigger(t);},sec*1000);
        _timers.push(timer);
        break;

      case 'scroll_depth':
        var pct=parseInt(cond.percent)||70;
        var scrollHandler=function(){
          var scrolled=(window.scrollY||document.documentElement.scrollTop);
          var total=document.documentElement.scrollHeight-window.innerHeight;
          if(total>0&&(scrolled/total)*100>=pct){
            window.removeEventListener('scroll',scrollHandler);
            fireTrigger(t);
          }
        };
        window.addEventListener('scroll',scrollHandler,{passive:true});
        break;

      case 'cart_abandonment':
        // Detectează coș prin WooCommerce cookie sau elemente DOM
        var hasCart=document.querySelector('.cart-contents,.woocommerce-cart-form,.cart_item');
        if(hasCart){
          var mins=parseInt(cond.minutes)||3;
          var ct=setTimeout(function(){fireTrigger(t);},mins*60*1000);
          _timers.push(ct);
        }
        break;

      case 'page_specific':
        var delaySec=parseInt(cond.seconds)||20;
        var pt=setTimeout(function(){fireTrigger(t);},delaySec*1000);
        _timers.push(pt);
        break;

      case 'inactivity':
        var inacSec=parseInt(cond.seconds)||120;
        var inacTimer;
        var resetInac=function(){
          clearTimeout(inacTimer);
          inacTimer=setTimeout(function(){fireTrigger(t);},inacSec*1000);
        };
        resetInac();
        ['mousemove','keydown','scroll','click','touchstart'].forEach(function(ev){
          window.addEventListener(ev,resetInac,{passive:true});
        });
        break;
    }
  });
}

// ── CART ─────────────────────────────────────────────────────────────────────
function addCart(extId,cartBtn){
  if(!extId){window.location.href=siteBase()+'/cart/';return;}
  cartBtn.disabled=true;
  cartBtn.innerHTML='<span style="font-size:11px">Se adaugă...</span>';
  fetch(siteBase()+'/?wc-ajax=add_to_cart',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'product_id='+encodeURIComponent(extId)+'&quantity=1',credentials:'include',
  })
  .then(function(r){return r.json();})
  .then(function(d){
    if(d&&(d.fragments||d.cart_hash)){
      cartBtn.innerHTML=iOk()+'<span>Adăugat!</span>';cartBtn.classList.add('ok');
      if(d.fragments){Object.keys(d.fragments).forEach(function(k){var el=document.querySelector(k);if(el)el.outerHTML=d.fragments[k];});}
      setTimeout(function(){cartBtn.innerHTML=iCart()+'<span>Adaugă în coș</span>';cartBtn.classList.remove('ok');cartBtn.disabled=false;},2800);
    }else{window.location.href=siteBase()+'/?add-to-cart='+extId;}
  })
  .catch(function(){window.location.href=siteBase()+'/?add-to-cart='+extId;});
}
function siteBase(){return(window.HontrioAgent&&window.HontrioAgent.storeUrl)||window.location.origin;}

// ── APPLY CONFIG ─────────────────────────────────────────────────────────────
function applyConfig(d){
  if(!d)return;

  // Ascunde widget-ul dacă agentul e inactiv
  var container=document.getElementById('_h');
  if(container){
    if(d.is_active===false){container.style.display='none';return;}
    else{container.style.display='';}
  }

  // Agent name
  if(d.agent_name){
    var an=document.getElementById('_h_an');
    if(an)an.textContent=d.agent_name;
    agentName=d.agent_name;
  }

  // Color
  var newColor=d.widget_color||COLOR;
  if(newColor!==COLOR){COLOR=newColor;C=rgb(COLOR);}
  var b=document.getElementById('_h_b');
  var hd=document.getElementById('_h_hd');
  var sn=document.getElementById('_h_sn');
  var bly=document.getElementById('_h_bl_y');
  if(b)b.style.background=COLOR;
  if(hd)hd.style.background=COLOR;
  if(sn)sn.style.background=COLOR;
  if(bly)bly.style.background=COLOR;
  var st=document.getElementById('_h_dyn');
  if(!st){st=document.createElement('style');st.id='_h_dyn';document.head.appendChild(st);}
  st.textContent=
    '._h_r.u ._h_bb{background:'+COLOR+' !important}'+
    '._h_cb.ac{background:'+COLOR+' !important}'+
    '._h_q{color:'+COLOR+' !important;border-color:rgba('+C+',.35) !important}'+
    '._h_cpr{color:'+COLOR+' !important}'+
    '#_h_in:focus{border-color:'+COLOR+' !important}'+
    '._h_cb.vw{color:'+COLOR+' !important}'+
    '._h_bl_y{background:'+COLOR+' !important}';

  // Avatar
  var avatarUrl=d.widget_avatar_url||'';
  var av=document.getElementById('_h_av');
  if(av){
    if(avatarUrl){
      av.innerHTML='<img src="'+avatarUrl+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    } else {
      av.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 11V8"/><circle cx="12" cy="6" r="2"/><path d="M8 16h.01M16 16h.01"/></svg>';
    }
  }
  // Avatar pe buton
  var btnAv=document.getElementById('_h_bav');
  if(btnAv){
    if(avatarUrl&&!isOpen){
      btnAv.style.display='flex';
      btnAv.innerHTML='<img src="'+avatarUrl+'" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:50%;">';
      var chatIco=document.getElementById('_h_bico');
      if(chatIco)chatIco.style.display='none';
    } else {
      btnAv.style.display='none';
      var chatIco2=document.getElementById('_h_bico');
      if(chatIco2)chatIco2.style.display='flex';
    }
  }

  // Button shape
  var shape=d.widget_button_shape||'circle';
  var label=d.widget_button_label||'';
  var sz=d.widget_size||'medium';
  var bs=sz==='small'?48:sz==='large'?64:56;
  var br=shape==='circle'?'50%':shape==='rounded'?'16px':'12px';
  var b5=document.getElementById('_h_b');
  if(b5){
    b5.style.borderRadius=br;
    b5.style.width=shape==='rectangle'?'auto':bs+'px';
    b5.style.height=shape==='rectangle'?Math.round(bs*0.65)+'px':bs+'px';
    b5.style.paddingLeft=shape==='rectangle'?'14px':'0';
    b5.style.paddingRight=shape==='rectangle'?'14px':'0';
    // Label text for rectangle
    var lbl=document.getElementById('_h_blbl');
    if(shape==='rectangle'){
      if(!lbl){lbl=document.createElement('span');lbl.id='_h_blbl';lbl.style.cssText='font-size:14px;font-weight:600;white-space:nowrap;margin-left:6px;';b5.appendChild(lbl);}
      lbl.textContent=label||'Ajutor?';
    } else {
      if(lbl)lbl.remove();
    }
  }

  // Position
  var isR=(d.widget_position||'bottom-right')!=='bottom-left';
  var b2=document.getElementById('_h_b');
  var w=document.getElementById('_h_w');
  var bl=document.getElementById('_h_bl');
  if(b2){b2.style.left=isR?'':'20px';b2.style.right=isR?'20px':'';}
  if(w){w.style.left=isR?'':'16px';w.style.right=isR?'16px':'';}
  if(bl){bl.style.left=isR?'':'16px';bl.style.right=isR?'16px':'';}

  // Size (height/width for non-rectangle already set above)
  if(!b5)b5=document.getElementById('_h_b');
  if(b5&&shape!=='rectangle'){b5.style.width=bs+'px';b5.style.height=bs+'px';}

  // Bottom offset
  var off=d.widget_bottom_offset||20;
  var b4=document.getElementById('_h_b');
  var w2=document.getElementById('_h_w');
  var bl2=document.getElementById('_h_bl');
  if(b4)b4.style.bottom=off+'px';
  if(w2)w2.style.bottom=(off+bs+8)+'px';
  if(bl2)bl2.style.bottom=(off+bs+12)+'px';

  // Custom CSS
  var cssEl=document.getElementById('_h_custom_css');
  if(d.widget_custom_css){
    if(!cssEl){cssEl=document.createElement('style');cssEl.id='_h_custom_css';document.head.appendChild(cssEl);}
    cssEl.textContent=d.widget_custom_css;
  } else {
    if(cssEl)cssEl.textContent='';
  }
}

// ── RENDER MESSAGES ──────────────────────────────────────────────────────────
function renderMsg(role,text,extra){
  msgs.push({role:role,content:text});
  var ms=document.getElementById('_h_ms');
  var row=document.createElement('div');row.className='_h_r '+(role==='user'?'u':'b');
  var bub=document.createElement('div');bub.className='_h_bb';bub.textContent=text;
  row.appendChild(bub);

  if(extra&&extra.products&&extra.products.length>0){
    var cs=document.createElement('div');cs.className='_h_cs';
    extra.products.forEach(function(p){
      var card=document.createElement('div');card.className='_h_c';
      var img=p.image
        ?'<img class="_h_ci" src="'+esc(p.image)+'" alt="" loading="lazy" onerror="this.outerHTML=\'<div class=\\\\"_h_cp\\\\">📦</div>\'">'
        :'<div class="_h_cp">📦</div>';
      var stockBadge='';
      if(p.stock){
        var sc=p.stock.available?'#16a34a':'#dc2626';
        var sl=p.stock.label||'';
        stockBadge='<div style="font-size:10px;font-weight:600;color:'+sc+';margin-top:3px;">● '+esc(sl)+'</div>';
      }
      card.innerHTML=
        '<div class="_h_ct">'+img+
          '<div class="_h_cd">'+
            '<div class="_h_ctt">'+esc(p.title||'')+'</div>'+
            (p.price?'<div class="_h_cpr">'+p.price+' RON</div>':'')+
            stockBadge+
          '</div>'+
        '</div>'+
        '<div class="_h_cbs">'+
          (p.stock&&!p.stock.available
            ?'<button class="_h_cb vw _h_ask_avail">📩<span>Întreabă disponibilitate</span></button>'
            :'<button class="_h_cb vw">'+iEye()+'<span>Vezi produs</span></button>')+
          (p.stock&&!p.stock.available
            ?((window._hCfg&&window._hCfg.has_whatsapp)?'<button class="_h_cb ac _h_wa_avail" style="background:#25d366;">📞<span>Sună / WhatsApp</span></button>':'')
            :'<button class="_h_cb ac">'+iCart()+'<span>Adaugă în coș</span></button>')+
        '</div>';
      var url=p.url||'';
      var askBtn=card.querySelector('._h_ask_avail');
      var waBtn=card.querySelector('._h_wa_avail');
      if(askBtn){
        var pname=p.title||'acest produs';
        askBtn.addEventListener('click',function(){
          doSend('Este disponibil '+pname+'? Când va reintra în stoc?');
        });
      }
      if(waBtn){
        var waNum=(window._hCfg&&window._hCfg.whatsapp_number)||'';
        waBtn.addEventListener('click',function(){
          var wMsg=encodeURIComponent('Bună ziua! Aș dori să știu disponibilitatea produsului: '+p.title);
          window.open('https://wa.me/'+waNum+'?text='+wMsg,'_blank');
        });
      }
      if(!p.stock||p.stock.available){
        card.querySelector('._h_cb.vw').addEventListener('click',function(){if(url&&url!=='#')window.open(url,'_blank');});
        card.querySelector('._h_cb.ac').addEventListener('click',function(){addCart(p.external_id,this);});
      }
      cs.appendChild(card);
    });
    row.appendChild(cs);
  }

  if(extra&&extra.quick_replies&&extra.quick_replies.length>0){
    var qs=document.createElement('div');qs.className='_h_qs';
    extra.quick_replies.forEach(function(qr){
      var qb=document.createElement('button');qb.className='_h_q';qb.textContent=qr;
      qb.addEventListener('click',function(){
        qs.querySelectorAll('._h_q').forEach(function(x){x.disabled=true;x.style.opacity='.35';});
        if(extra.redirect_url){window.open(extra.redirect_url,'_blank');return;}
        doSend(qr);
      });
      qs.appendChild(qb);
    });
    row.appendChild(qs);
  }

  if(extra&&extra.show_whatsapp&&extra.whatsapp_number){
    var wa=document.createElement('a');wa.className='_h_wa';
    wa.href='https://wa.me/'+extra.whatsapp_number+(extra.whatsapp_prefill?'?text='+extra.whatsapp_prefill:'');
    wa.target='_blank';wa.rel='noopener';
    wa.innerHTML=iWA()+'<div><div class="_h_wat">Contactează pe WhatsApp</div><div class="_h_was">Răspuns rapid de la echipă</div></div>';
    row.appendChild(wa);
  }

  ms.appendChild(row);
  ms.scrollTop=ms.scrollHeight;
  if(role==='assistant'&&!isOpen){unread++;updBadge();}
}

function esc(t){var d=document.createElement('div');d.textContent=t;return d.innerHTML;}
function showTyping(){var ms=document.getElementById('_h_ms');var el=document.createElement('div');el.className='_h_ty';el.id='_h_ty';el.innerHTML='<div class="_h_td"></div><div class="_h_td"></div><div class="_h_td"></div>';ms.appendChild(el);ms.scrollTop=ms.scrollHeight;}
function hideTyping(){var el=document.getElementById('_h_ty');if(el)el.remove();}
function updBadge(){var b=document.getElementById('_h_bg');if(!b)return;if(unread>0&&!isOpen){b.style.display='flex';b.textContent=unread>9?'9+':unread;}else b.style.display='none';}

// ── OPEN/CLOSE ───────────────────────────────────────────────────────────────
function toggle(){isOpen?closeChat():openChat();}
function openChat(){
  isOpen=true;
  hideBubble();
  document.getElementById('_h_w').classList.add('on');
  btn.innerHTML=iX(ICN_S)+'<div id="_h_bg"></div>';
  badge=btn.querySelector('#_h_bg');
  unread=0;updBadge();inp.focus();
  if(!welcomed){welcomed=true;doWelcome();}
}
function closeChat(){
  isOpen=false;
  document.getElementById('_h_w').classList.remove('on');
  btn.innerHTML=iChat()+'<div id="_h_bg"></div>';
  badge=btn.querySelector('#_h_bg');
  updBadge();
}

// ── WELCOME ──────────────────────────────────────────────────────────────────
function buildWelcomeMsg(cfg,mem){
  var agName=agentName;
  if(!mem||!mem.total_sessions||!mem.conversation_summary){
    return (cfg&&cfg.welcome_message)||('Bună! Sunt '+agName+'. Cu ce te pot ajuta?');
  }
  var days=Math.floor((Date.now()-new Date(mem.last_seen_at).getTime())/(1000*60*60*24));
  var timeAgo=days===0?'astăzi mai devreme':days===1?'ieri':'acum '+days+' zile';
  return 'Bună revenire! '+timeAgo+' '+mem.conversation_summary+' Cu ce te pot ajuta?';
}

function doWelcome(){
  var mem=window._hMem||null;
  if(window._hCfg){
    var msg=buildWelcomeMsg(window._hCfg,mem);
    var qrs=window._hCfg.quick_replies||['Caut un produs','Am o întrebare','Livrare & retur'];
    renderMsg('assistant',msg,{quick_replies:qrs});
    return;
  }
  fetch(BASE+'/api/agent/public-config?userId='+UID)
    .then(function(r){return r.ok?r.json():null;})
    .then(function(d){
      applyConfig(d);window._hCfg=d;
      var msg=buildWelcomeMsg(d,window._hMem||null);
      var qrs=(d&&d.quick_replies)||['Caut un produs','Am o întrebare','Livrare & retur'];
      renderMsg('assistant',msg,{quick_replies:qrs});
    })
    .catch(function(){renderMsg('assistant','Bună! Cu ce te pot ajuta astăzi?',{quick_replies:['Caut un produs','Am o întrebare']});});
}

// ── SEND ─────────────────────────────────────────────────────────────────────
function doSend(ov){
  var txt=ov||inp.value.trim();
  if(!txt||isLoading)return;
  if(!ov){inp.value='';inp.style.height='auto';}
  renderMsg('user',txt,null);
  isLoading=true;
  document.getElementById('_h_sn').disabled=true;
  inp.disabled=true;
  showTyping();
  fetch(BASE+'/api/agent/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      message:txt,
      history:msgs.slice(-10).map(function(m){return{role:m.role,content:m.content};}),
      session_id:sid,store_user_id:UID,visitor_id:vid,
      full_history:msgs.map(function(m){return{role:m.role,content:m.content};}),
    }),
  })
  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
  .then(function(d){
    hideTyping();
    renderMsg('assistant',d.message,{
      products:d.products,quick_replies:d.quick_replies,
      show_whatsapp:d.show_whatsapp,whatsapp_number:d.whatsapp_number,
      whatsapp_prefill:d.whatsapp_prefill,redirect_url:d.redirect_url,
    });
  })
  .catch(function(err){
    console.error('[Hontrio]',err);
    hideTyping();
    renderMsg('assistant','Ceva n-a mers, încearcă din nou!',{quick_replies:['Încearcă din nou']});
  })
  .finally(function(){isLoading=false;document.getElementById('_h_sn').disabled=false;inp.disabled=false;inp.focus();});
}

// ── INIT ─────────────────────────────────────────────────────────────────────
// Încarcă config + triggeri imediat la load
fetch(BASE+'/api/agent/public-config?userId='+UID)
  .then(function(r){return r.ok?r.json():null;})
  .then(function(d){if(d){applyConfig(d);window._hCfg=d;}})
  .catch(function(){});

loadAndInitTriggers();

// Încarcă memoria vizitatorului în fundal
fetch(BASE+'/api/agent/memory?userId='+UID+'&visitorId='+vid)
  .then(function(r){return r.ok?r.json():null;})
  .then(function(d){if(d&&d.memory)window._hMem=d.memory;})
  .catch(function(){});

setTimeout(function(){if(!isOpen&&!welcomed){unread=1;updBadge();}},25000);

// ── REAL-TIME CONFIG (SSE — actualizare instant din dashboard) ───────────────
function connectConfigStream(){
  if(!window.EventSource)return; // fallback — browser vechi
  var es=new EventSource(BASE+'/api/agent/config-stream?userId='+UID);
  es.onmessage=function(e){
    try{
      var d=JSON.parse(e.data);
      if(d&&d.widget_color){
        applyConfig(d);
        window._hCfg=d;
      }
    }catch(err){}
  };
  es.onerror=function(){
    // Reconectare automată după 5s dacă conexiunea pică
    es.close();
    setTimeout(connectConfigStream,5000);
  };
}
connectConfigStream();
})();