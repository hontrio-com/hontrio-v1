(function(){
'use strict';
var cfg=window.HontrioAgent||{};
var UID=cfg.userId||'';
var COLOR=cfg.color||'#2563eb';
var POS=cfg.position||'bottom-right';
var SZ=cfg.size||'medium';
var BASE=(cfg.apiBase||'https://hontrio.com').replace(/\/$/,'');
if(!UID){console.warn('[Hontrio] userId lipsește');return;}

var IS_R=POS!=='bottom-left';
var BTN_S=SZ==='small'?48:SZ==='large'?64:56;
var ICN_S=SZ==='small'?20:SZ==='large'?28:24;
var isOpen=false,isLoading=false,msgs=[],sid='s'+Math.random().toString(36).slice(2,11);
var vid;try{vid=localStorage.getItem('_hv')||'v'+Date.now().toString(36);localStorage.setItem('_hv',vid);}catch(e){vid='v'+Date.now().toString(36);}
var unread=0,welcomed=false,agentName='Asistent';

function rgb(h){
  h=h.replace('#','');
  return parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16);
}
var C=rgb(COLOR);

// ── STYLES ──────────────────────────────────────────────────────────────────
var s=document.createElement('style');
s.textContent=
'#_h *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:0;}'+
'#_h_b{position:fixed;'+(IS_R?'right':'left')+':20px;bottom:20px;width:'+BTN_S+'px;height:'+BTN_S+'px;'+
'border-radius:50%;background:'+COLOR+';border:none;cursor:pointer;z-index:2147483646;'+
'box-shadow:0 4px 16px rgba('+C+',.4),0 2px 6px rgba(0,0,0,.1);'+
'display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;outline:none;}'+
'#_h_b:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba('+C+',.5);}'+
'#_h_b:active{transform:scale(.95);}'+
'#_h_bg{position:absolute;top:-3px;'+(IS_R?'right':'left')+':-3px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;'+
'min-width:18px;height:18px;border-radius:9px;border:2px solid #fff;display:none;align-items:center;justify-content:center;padding:0 3px;}'+

'#_h_w{position:fixed;'+(IS_R?'right':'left')+':16px;bottom:'+(BTN_S+20)+'px;'+
'width:min(380px,calc(100vw - 28px));height:min(560px,calc(100vh - 90px));'+
'background:#fff;border-radius:16px;overflow:hidden;z-index:2147483645;'+
'box-shadow:0 8px 40px rgba(0,0,0,.12),0 2px 12px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.06);'+
'display:flex;flex-direction:column;'+
'transform:scale(.9) translateY(12px);opacity:0;pointer-events:none;'+
'transition:transform .25s cubic-bezier(.34,1.3,.64,1),opacity .2s;}'+
'#_h_w.on{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}'+

/* header */
'#_h_hd{padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;'+
'background:'+COLOR+';border-bottom:none;}'+
'#_h_av{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.3);'+
'display:flex;align-items:center;justify-content:center;flex-shrink:0;}'+
'._h_hn{font-size:14px;font-weight:600;color:#fff;}'+
'._h_hs{font-size:11px;color:rgba(255,255,255,.75);display:flex;align-items:center;gap:4px;margin-top:1px;}'+
'._h_hd{width:6px;height:6px;border-radius:50%;background:#4ade80;}'+
'#_h_cl{margin-left:auto;background:rgba(255,255,255,.15);border:none;width:28px;height:28px;'+
'border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;'+
'color:#fff;transition:background .15s;flex-shrink:0;}'+
'#_h_cl:hover{background:rgba(255,255,255,.25);}'+

/* messages */
'#_h_ms{flex:1;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:10px;background:#f9fafb;scroll-behavior:smooth;}'+
'#_h_ms::-webkit-scrollbar{width:4px;}'+
'#_h_ms::-webkit-scrollbar-thumb{background:#e5e7eb;border-radius:4px;}'+
'._h_r{display:flex;flex-direction:column;gap:5px;max-width:85%;}'+
'._h_r.u{align-self:flex-end;align-items:flex-end;}'+
'._h_r.b{align-self:flex-start;align-items:flex-start;}'+
'._h_bb{padding:10px 13px;border-radius:16px;font-size:13.5px;line-height:1.5;word-break:break-word;}'+
'._h_r.u ._h_bb{background:'+COLOR+';color:#fff;border-bottom-right-radius:4px;}'+
'._h_r.b ._h_bb{background:#fff;color:#111827;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.05);}'+

/* product cards */
'._h_cs{display:flex;flex-direction:column;gap:7px;width:100%;}'+
'._h_c{background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;'+
'box-shadow:0 1px 4px rgba(0,0,0,.06);transition:box-shadow .2s,border-color .2s;}'+
'._h_c:hover{box-shadow:0 4px 12px rgba(0,0,0,.1);border-color:rgba('+C+',.3);}'+
'._h_ct{display:flex;}'+
'._h_ci{width:76px;height:76px;object-fit:cover;flex-shrink:0;background:#f3f4f6;}'+
'._h_cp{width:76px;height:76px;flex-shrink:0;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:24px;}'+
'._h_cd{flex:1;min-width:0;padding:9px 11px;display:flex;flex-direction:column;gap:2px;}'+
'._h_ctt{font-size:12.5px;font-weight:600;color:#111827;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}'+
'._h_cds{font-size:11px;color:#6b7280;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:1px;}'+
'._h_cpr{font-size:14px;font-weight:700;color:'+COLOR+';margin-top:auto;}'+
'._h_cbs{display:flex;border-top:1px solid #f3f4f6;}'+
'._h_cb{flex:1;padding:8px 6px;font-size:12px;font-weight:600;border:none;cursor:pointer;'+
'display:flex;align-items:center;justify-content:center;gap:4px;transition:background .15s;}'+
'._h_cb.vw{background:#f9fafb;color:'+COLOR+';border-right:1px solid #f3f4f6;}'+
'._h_cb.vw:hover{background:#f3f4f6;}'+
'._h_cb.ac{background:'+COLOR+';color:#fff;}'+
'._h_cb.ac:hover{opacity:.9;}'+
'._h_cb.ac:disabled{opacity:.5;cursor:default;}'+
'._h_cb.ac.ok{background:#22c55e;}'+

/* quick replies */
'._h_qs{display:flex;flex-wrap:wrap;gap:5px;}'+
'._h_q{font-size:12px;font-weight:500;color:'+COLOR+';background:#fff;'+
'border:1.5px solid rgba('+C+',.3);border-radius:20px;padding:5px 11px;cursor:pointer;transition:all .15s;white-space:nowrap;}'+
'._h_q:hover{background:rgba('+C+',.06);border-color:rgba('+C+',.5);}'+
'._h_q:disabled{opacity:.4;cursor:default;}'+

/* whatsapp */
'._h_wa{display:flex;align-items:center;gap:9px;background:#f0fdf4;'+
'border:1px solid #bbf7d0;border-radius:12px;padding:10px 12px;cursor:pointer;text-decoration:none;transition:background .15s;}'+
'._h_wa:hover{background:#dcfce7;}'+
'._h_wat{font-size:12.5px;font-weight:700;color:#166534;}'+
'._h_was{font-size:11px;color:#16a34a;margin-top:1px;}'+

/* typing */
'._h_ty{align-self:flex-start;background:#fff;padding:11px 15px;border-radius:16px;border-bottom-left-radius:4px;'+
'box-shadow:0 1px 4px rgba(0,0,0,.08),0 0 0 1px rgba(0,0,0,.05);display:flex;gap:4px;align-items:center;}'+
'._h_td{width:6px;height:6px;border-radius:50%;background:#9ca3af;animation:_h_b .85s infinite;}'+
'._h_td:nth-child(2){animation-delay:.14s;}._h_td:nth-child(3){animation-delay:.28s;}'+
'@keyframes _h_b{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}'+

/* footer */
'#_h_ft{padding:10px 12px 12px;background:#fff;border-top:1px solid #f3f4f6;flex-shrink:0;}'+
'#_h_fm{display:flex;gap:7px;align-items:flex-end;}'+
'#_h_in{flex:1;background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;'+
'padding:9px 13px;font-size:13.5px;color:#111827;outline:none;resize:none;'+
'min-height:40px;max-height:96px;line-height:1.45;transition:border-color .15s;}'+
'#_h_in:focus{border-color:'+COLOR+';background:#fff;}'+
'#_h_in::placeholder{color:#9ca3af;}'+
'#_h_sn{width:40px;height:40px;border-radius:11px;border:none;background:'+COLOR+';color:#fff;'+
'cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .15s,transform .15s;}'+
'#_h_sn:hover{opacity:.9;transform:scale(1.05);}'+
'#_h_sn:disabled{opacity:.35;cursor:default;transform:none;}'+
'._h_br{text-align:center;font-size:10px;color:#d1d5db;padding:5px 0 0;}'+
'._h_br a{color:#9ca3af;text-decoration:none;}._h_br a:hover{color:'+COLOR+';}'+
'@media(max-width:480px){#_h_w{left:8px!important;right:8px!important;width:auto!important;bottom:'+(BTN_S+12)+'px;}}';
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

wrap.appendChild(btn);wrap.appendChild(win);document.body.appendChild(wrap);

var inp=document.getElementById('_h_in');
btn.addEventListener('click',toggle);
document.getElementById('_h_cl').addEventListener('click',closeChat);
document.getElementById('_h_sn').addEventListener('click',function(){doSend();});
inp.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}});
inp.addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,96)+'px';});

// ── CART ─────────────────────────────────────────────────────────────────────
function addCart(extId,cartBtn){
  if(!extId){window.location.href=siteBase()+'/cart/';return;}
  cartBtn.disabled=true;
  cartBtn.innerHTML='<span style="font-size:11px">Se adaugă...</span>';
  fetch(siteBase()+'/?wc-ajax=add_to_cart',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'product_id='+encodeURIComponent(extId)+'&quantity=1',
    credentials:'include',
  })
  .then(function(r){return r.json();})
  .then(function(d){
    if(d&&(d.fragments||d.cart_hash)){
      cartBtn.innerHTML=iOk()+'<span>Adăugat!</span>';
      cartBtn.classList.add('ok');
      if(d.fragments){Object.keys(d.fragments).forEach(function(k){var el=document.querySelector(k);if(el)el.outerHTML=d.fragments[k];});}
      setTimeout(function(){cartBtn.innerHTML=iCart()+'<span>Adaugă în coș</span>';cartBtn.classList.remove('ok');cartBtn.disabled=false;},2800);
    }else{window.location.href=siteBase()+'/?add-to-cart='+extId;}
  })
  .catch(function(){window.location.href=siteBase()+'/?add-to-cart='+extId;});
}
function siteBase(){return(window.HontrioAgent&&window.HontrioAgent.storeUrl)||window.location.origin;}

// ── RENDER ───────────────────────────────────────────────────────────────────
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
      card.innerHTML=
        '<div class="_h_ct">'+img+
          '<div class="_h_cd">'+
            '<div class="_h_ctt">'+esc(p.title||'')+'</div>'+
            (p.description?'<div class="_h_cds">'+esc(p.description)+'</div>':'')+
            (p.price?'<div class="_h_cpr">'+p.price+' RON</div>':'')+
          '</div>'+
        '</div>'+
        '<div class="_h_cbs">'+
          '<button class="_h_cb vw">'+iEye()+'<span>Vezi produs</span></button>'+
          '<button class="_h_cb ac">'+iCart()+'<span>Adaugă în coș</span></button>'+
        '</div>';
      var url=p.url||'';
      card.querySelector('._h_cb.vw').addEventListener('click',function(){if(url&&url!=='#')window.location.href=url;});
      var acBtn=card.querySelector('._h_cb.ac');
      acBtn.addEventListener('click',function(){addCart(p.external_id,this);});
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
        if(extra.redirect_url&&(qr.includes('→')||qr.toLowerCase().includes('deschide')||qr.toLowerCase().includes('vezi'))){window.location.href=extra.redirect_url;return;}
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
  document.getElementById('_h_w').classList.add('on');
  btn.innerHTML=iX(ICN_S)+'<div id="_h_bg"></div>';
  badge=btn.querySelector('#_h_bg');
  unread=0;updBadge();
  inp.focus();
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
function doWelcome(){
  fetch(BASE+'/api/agent/public-config?userId='+UID)
    .then(function(r){return r.ok?r.json():null;})
    .then(function(d){
      if(d&&d.agent_name){document.getElementById('_h_an').textContent=d.agent_name;agentName=d.agent_name;}
      var msg=(d&&d.welcome_message)||('Bună! Sunt '+agentName+'. Cu ce te pot ajuta?');
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
    }),
  })
  .then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.json();
  })
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

setTimeout(function(){if(!isOpen&&!welcomed){unread=1;updBadge();}},25000);

})();