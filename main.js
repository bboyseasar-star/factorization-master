(function(){
 const Q=window.FactorizationQuestions,KEY='nyushi-daimon2:v2:course:factorization',HKEY='nyushi-daimon2:v2:history:factorization',app=document.getElementById('app');let state={screen:'HOME',sessionMode:'normal',questions:[],i:0,answers:[],hint:0,locked:false};let memory={};let handwritingCleanup=()=>{};
 const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return memory[k]||null}},write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{memory[k]=v}},del=k=>{try{localStorage.removeItem(k)}catch{}delete memory[k]};
 const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));const typeset=()=>{if(window.MathJax?.typesetPromise)return window.MathJax.typesetPromise([app]).catch(()=>{});};
 // ===== 仮想キーボード対策（linear-equation-master の手本と同じ。8本でそろえる） =====
 // 実キーの Enter（GraderCore.setupMathField の onEnter）と仮想キーボードの ↵（MathLive の change。欄にフォーカスがあるときだけ）の
 // 両方で決定する。400ms 以内の2回目は無視して二重採点を防ぐ。欄ごとに1回だけ。
 function bindMathFieldSubmit(mf,onSubmit){
  if(!mf||mf.dataset.submitBound)return;mf.dataset.submitBound='1';
  let last=0;const fire=()=>{const now=Date.now();if(now-last<400)return;last=now;onSubmit();};
  if(window.GraderCore)window.GraderCore.setupMathField(mf,{onEnter:event=>{if(!event.repeat)fire();}});
  mf.addEventListener('change',()=>{const focused=typeof mf.hasFocus==='function'?mf.hasFocus():document.activeElement===mf;if(focused)fire();});
 }
 // 仮想キーボードが出ている間は <html> に vk-open と --vk-height を付けて高さ固定をゆるめ（CSS 側）、
 // getTargets() の要素（入力欄・決定ボタン・判定）がキーボードの上に見えるようにスクロールする。閉じたら先頭へ戻す。
 function followVirtualKeyboard(getTargets){
  const vk=window.mathVirtualKeyboard;if(!vk||followVirtualKeyboard.bound)return;followVirtualKeyboard.bound=true;
  followVirtualKeyboard.getTargets=getTargets;
  const update=()=>{
   const h=Math.round(vk.boundingRect?.height||0),open=vk.visible!==false&&h>0,root=document.documentElement;
   const was=root.classList.contains('vk-open');root.classList.toggle('vk-open',open);root.style.setProperty('--vk-height',`${open?h:0}px`);
   if(!open){if(was)window.scrollTo(0,0);return;}
   requestAnimationFrame(()=>{
    const els=(followVirtualKeyboard.getTargets()||[]).filter(e=>e&&e.getClientRects().length);if(!els.length)return;
    const rects=els.map(e=>e.getBoundingClientRect()),top=Math.min(...rects.map(r=>r.top)),bottom=Math.max(...rects.map(r=>r.bottom));
    const visibleBottom=window.innerHeight-h-8;let dy=0;
    if(bottom>visibleBottom)dy=bottom-visibleBottom;if(top-dy<8)dy=top-8;
    if(dy)window.scrollBy(0,dy);
   });
  };
  // 0.98.4 では、出すときは geometrychange が来ず virtual-keyboard-toggle だけが来るので、両方で受ける
  vk.addEventListener('geometrychange',update);vk.addEventListener('virtual-keyboard-toggle',update);window.addEventListener('resize',update);
  followVirtualKeyboard.update=update;
 }
 const vkTargets=()=>[document.getElementById('answer'),document.getElementById('submit'),document.querySelector('#message .feedback')];
 // 採点（またはギブアップ）から約500msの間は「次へ」を受け付けない（Enter・↵ の押しすぎで問題を飛ばさない）
 let lockedAt=0;const NEXT_GUARD_MS=500;
 function goNext(){if(!state.locked||Date.now()-lockedAt<NEXT_GUARD_MS)return;next()}
 function lockQuestion(){state.locked=true;lockedAt=Date.now();const mf=document.getElementById('answer');if(mf)mf.setAttribute('read-only','');document.getElementById('hint').disabled=true;document.getElementById('submit').disabled=true;const nx=document.getElementById('next');if(nx){nx.onclick=goNext;try{nx.focus({preventScroll:true})}catch(e){}}}
 function history(){return Array.isArray(read(HKEY))?read(HKEY):[]}function setScreen(s){state.screen=s;render()}
 function render(){handwritingCleanup();if(state.screen==='HOME')home();else if(state.screen==='QUESTION'){question();setupHandwriting();window.scrollTo(0,0);followVirtualKeyboard.update?.()}else result();typeset()}
 function start(mode,tags){state={screen:'QUESTION',sessionMode:mode,questions:Q.generateSession((Date.now()>>>0),mode,tags),i:0,answers:[],hint:0,locked:false};render()}
 function question(){const q=state.questions[state.i],total=state.questions.length,n=state.i+1;app.innerHTML=`<section class="screen play"><div class="topline"><button class="exit" id="exit">中断してホームへ</button><div class="progress"><span style="width:${(state.i/total)*100}%"></span></div><strong>Q ${n} / ${total}</strong><span class="score">${state.answers.filter(a=>a.correct).length} 点</span></div><div class="work-layout"><article class="problem-card"><p class="prompt">次の式を因数分解しなさい。</p><div class="math">\\(${q.promptLatex}\\)</div><div class="input-wrap"><math-field id="answer" aria-label="答えを入力"></math-field></div><p class="assist">※ 半角英数字で入力してね</p><div class="controls"><button class="primary" id="submit" disabled>決定</button></div><div id="message" class="hint-area"></div></article><aside class="support-card"><h2>ヒント・解説</h2><button class="secondary hint-button" id="hint">ヒント1を見る</button><div id="support-content" class="support-content"><p>式の形を見ながら、ヒントを順に使おう。</p></div></aside></div></section>`;const mf=document.getElementById('answer'),submit=document.getElementById('submit');bindMathFieldSubmit(mf,()=>{if(state.locked)goNext();else submitAnswer()});customElements.whenDefined('math-field').then(()=>{followVirtualKeyboard(vkTargets);try{mf.mathModeSpace='\\:'}catch(e){}submit.disabled=false;mf.focus()}).catch(()=>{});document.getElementById('exit').onclick=()=>{if(confirm('中断してホームへ戻りますか？'))home()};document.getElementById('hint').onclick=showHint;submit.onclick=submitAnswer}
 function submitAnswer(){
  if(state.locked)return;
  const q=state.questions[state.i],mf=document.getElementById('answer'),msg=document.getElementById('message');
  const raw=String((mf&&mf.value)||''),res=gradeFactorizationAnswer(q,raw);
  // 空欄・書きかけは採点しない・消費しない・ロックしない・記録しない
  if(!NyushiCore.consumes(res)){msg.innerHTML=`<div class="feedback notice"><strong>まだ採点していません</strong><p>${esc(res.message||'答えを入力してから決定しよう。')}</p></div>`;if(mf&&mf.focus)mf.focus();followVirtualKeyboard.update?.();return}
  const correct=res.status==='correct',latex=res.studentLatex||'\\text{（式を表示できません）}';
  state.answers.push({correct,status:res.status,kind:res.kind,raw,latex,q,code:res.code});
  const neg=res.status==='negDenominator',label=correct?'○ 正解':neg?'△ 書き直そう（正解には数えません）':res.kind==='unfinished'?'× 不正解（あと一歩）':res.kind==='notation'?'× 不正解（書き方）':'× 不正解',cls=correct?'correct':neg?'notation':res.kind==='unfinished'?'unfinished':res.kind==='notation'?'notation':'wrong';
  msg.innerHTML=`<div class="feedback"><strong class="${cls}">${label}</strong>${correct?' 次の問題へ進もう。':`<p>あなたの答え：\\(${latex}\\)</p>${res.message?`<p class="${cls}">${esc(res.message)}</p>`:''}<p>正しい答え：\\(${q.answerLatex}\\)</p><p>\\(${q.workedSolution}\\)</p>`}<br><button class="primary" id="next">次へ</button></div>`;
  lockQuestion();typeset();followVirtualKeyboard.update?.();
 }
 function next(){const old=document.getElementById('answer');if(old&&old.blur)old.blur();if(state.i+1<state.questions.length){state.i++;state.hint=0;state.locked=false;render()}else{if(state.sessionMode==='normal')saveHistory();setScreen('RESULT')}}
 function showHint(){
  if(state.locked)return;
  const q=state.questions[state.i],box=document.getElementById('support-content'),button=document.getElementById('hint');
  if(state.hint<2){
   const step=state.hint+1,calc=q.calculationWork[state.hint],thinking=q.thinkingText[state.hint],note=q.hints[state.hint++];
   box.insertAdjacentHTML('beforeend',`<section class="hint-flow-row"><div class="hint-flow-calc">\\(${calc}\\)</div><div class="hint-flow-note"><span class="hint-flow-number">${step}</span><div><strong>ヒント${step}</strong><p class="thinking">考え方：${esc(thinking)}</p><p class="formula-label">使う公式</p><div class="hint-formula">\\(${q.formulaLatex}\\)</div><p>${esc(note)}</p></div></div></section>`);
   button.textContent=state.hint===1?'ヒント2を見る':'答えを見る';typeset();return;
  }
  if(confirm('⚠️ 次のヒントは答えだよ！')){
   state.answers.push({correct:false,status:'giveUp',kind:'giveUp',raw:'',latex:'\\text{答えを見た}',q,code:'GIVE_UP'});
   document.getElementById('message').innerHTML=`<div class="feedback answer-work"><strong>答え・解説</strong><div class="answer-solution">\\(${q.workedSolution}\\)</div><p>正しい答え：\\(${q.answerLatex}\\)</p><button class="primary" id="next">次へ</button></div>`;
   lockQuestion();typeset();followVirtualKeyboard.update?.();
  }
 }
 function setupHandwriting(){
  const canvas=document.createElement('canvas'),tools=document.createElement('div'),status=document.createElement('p');
  canvas.className='handwriting-canvas';canvas.setAttribute('aria-hidden','true');
  tools.className='handwriting-tools';tools.innerHTML='<span class="handwriting-label">計算メモ</span><button type="button" class="handwriting-tool selected" data-tool="pen" aria-pressed="true">✎ ペン</button><button type="button" class="handwriting-tool" data-tool="eraser" aria-pressed="false" disabled>⌫ 消す</button><button type="button" class="handwriting-clear" disabled>すべて消す</button>';
  status.className='sr-status';status.setAttribute('aria-live','polite');status.textContent='ペンを選択中';app.append(canvas,tools,status);
  const pen=tools.querySelector('[data-tool="pen"]'),eraser=tools.querySelector('[data-tool="eraser"]'),clear=tools.querySelector('.handwriting-clear');
  let ctx,tool='pen',activeId=null,last=null,hasInk=false;
  const protectedTarget=target=>Boolean(target.closest?.('button, math-field, input, textarea, select, a, [role="button"], label, .ML__keyboard, .ML__keyboard *, [class^="MLK__"], [class*=" MLK__"]'));
  const configure=()=>{ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=tool==='pen'?3:23;ctx.strokeStyle='#176b55';ctx.globalCompositeOperation=tool==='pen'?'source-over':'destination-out'};
  const setTool=next=>{if(next==='eraser'&&!hasInk)return;tool=next;pen.classList.toggle('selected',tool==='pen');eraser.classList.toggle('selected',tool==='eraser');pen.setAttribute('aria-pressed',String(tool==='pen'));eraser.setAttribute('aria-pressed',String(tool==='eraser'));status.textContent=tool==='pen'?'書き込み中':'消しゴム中';configure()};
  const resize=()=>{const old=document.createElement('canvas'),oldCtx=old.getContext('2d'),dpr=Math.max(1,window.devicePixelRatio||1);if(canvas.width&&canvas.height){old.width=canvas.width;old.height=canvas.height;oldCtx.drawImage(canvas,0,0)}canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);if(old.width){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.drawImage(old,0,0,old.width,old.height,0,0,canvas.width,canvas.height);ctx.restore();ctx.setTransform(dpr,0,0,dpr,0,0)}configure()};
  const point=e=>({x:e.clientX,y:e.clientY});
  const end=()=>{activeId=null;last=null};
  const draw=e=>{const now=point(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(now.x,now.y);ctx.stroke();last=now;hasInk=true;eraser.disabled=false;clear.disabled=false};
  const onDown=e=>{if(activeId!==null||protectedTarget(e.target)||(e.pointerType==='mouse'&&e.button!==0))return;activeId=e.pointerId;last=point(e);draw(e);e.preventDefault()};
  const onMove=e=>{if(e.pointerId!==activeId)return;if(protectedTarget(e.target)){end();return}draw(e);e.preventDefault()};
  const onUp=e=>{if(e.pointerId===activeId)end()};
  pen.onclick=()=>setTool('pen');eraser.onclick=()=>setTool('eraser');clear.onclick=()=>{ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.restore();ctx.setTransform(Math.max(1,window.devicePixelRatio||1),0,0,Math.max(1,window.devicePixelRatio||1),0,0);hasInk=false;eraser.disabled=true;clear.disabled=true;setTool('pen');status.textContent='計算メモを消しました'};
  resize();document.addEventListener('pointerdown',onDown,true);document.addEventListener('pointermove',onMove,true);document.addEventListener('pointerup',onUp,true);document.addEventListener('pointercancel',onUp,true);window.addEventListener('resize',resize);
  handwritingCleanup=()=>{document.removeEventListener('pointerdown',onDown,true);document.removeEventListener('pointermove',onMove,true);document.removeEventListener('pointerup',onUp,true);document.removeEventListener('pointercancel',onUp,true);window.removeEventListener('resize',resize);canvas.remove();tools.remove();status.remove();handwritingCleanup=()=>{}}
 }
 function home(){const rows=history().map(h=>`<div class="history-row"><span>${esc(h.at)}</span><strong>${h.score} / 10　${h.clear?'クリア':'挑戦中'}</strong></div>`).join('')||'<p class="empty">まだ記録はありません。</p>';app.innerHTML=`<section class="screen home"><div class="start-pane"><h1 class="title"><span class="emoji-icon">👹</span>高校入試対策シリーズ<br>～大問2・因数分解～</h1><button class="primary" id="start">▶ スタート！</button><a class="legal-link" href="legal.html">このアプリについて</a></div><aside class="history-card"><h2>学習の履歴</h2><div class="history-list">${rows}</div><button class="danger" id="clear">この端末の記録を消す</button></aside></section>`;document.getElementById('start').onclick=()=>start('normal');document.getElementById('clear').onclick=()=>{if(confirm('このアプリの学習記録だけを消します。よろしいですか？')){del(KEY);del(HKEY);render()}}}
 function saveHistory(){const score=state.answers.filter(a=>a.correct).length,h=history();h.unshift({at:new Date().toLocaleString('ja-JP'),score,clear:score>=9});write(HKEY,h.slice(0,20));write(KEY,{schemaVersion:2,rngVersion:Q.RNG_VERSION})}
 function result(){const score=state.answers.filter(a=>a.correct).length,review=state.answers.filter(a=>!a.correct),tag=a=>a.kind==='unfinished'?'（あと一歩）':a.kind==='notation'?'（書き方）':'',rows=state.answers.map((a,i)=>`<div class="review-row"><strong class="${a.correct?'correct':a.kind==='unfinished'?'unfinished':a.kind==='notation'?'notation':'wrong'}">Q${i+1} ${a.correct?'○':'×'}${tag(a)}</strong><div>自分の答え：\\(${a.latex||'\\text{未入力}'}\\)</div><div>正答：\\(${a.q.answerLatex}\\)</div></div>`).join('');app.innerHTML=`<section class="screen result"><article class="result-card"><p class="big-score">${score} / ${state.questions.length}</p><p class="${score>=9?'correct':'wrong'}" style="text-align:center">${state.sessionMode==='review'?(review.length?'もう一度、まちがいを直そう。':'すべて正解！'):score>=9?'クリア！ よくできました。':'結果を見て、まちがいを直そう。'}</p><div class="reviews">${rows}</div><div class="result-actions">${review.length?'<button class="primary" id="review">まちがいだけ復習</button>':''}<button class="secondary" id="again">もう一度</button><button class="secondary" id="home">ホームへ</button></div></article></section>`;document.getElementById('again').onclick=()=>start('normal');document.getElementById('home').onclick=()=>{state={screen:'HOME'};render()};if(review.length)document.getElementById('review').onclick=()=>start('review',review.map(a=>a.q.subskillTag))}
 render();
})();
