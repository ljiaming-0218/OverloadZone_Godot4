'use strict';
// A fictional backstage comedy; dialogue never advances the combat clock.
const EPISODES=OFFICE_EPISODES;
const ENEMY_LABELS=OFFICE_ENEMIES;
let activeEpisode=null;
const portraitImages={ma:null,ding:null};
function theatreState(){return {storySeen:{},skillVfx:[],coffeeTimer:3,paperTimer:1.2,portraitNote:false};}
function showEpisode(id,after,options={}){
  const episode=EPISODES[id];if(!episode){after?.();return}
  clearInput();G.storySeen[id]=true;
  activeEpisode={id,index:0,after,reward:options.reward!==false,selecting:false,finished:false};
  state='story';overlay.classList.remove('hidden');renderEpisode();
}
function portraitMarkup(role){return `<div class="portrait-badge" data-portrait="${role}"><span>${role==='ma'?'我':role==='ding'?'怪':'友'}</span></div>`;}
function renderEpisode(){
  if(!activeEpisode)return;const episode=EPISODES[activeEpisode.id],line=episode.lines[activeEpisode.index];
  const selecting=activeEpisode.selecting,role=['组长','总监','老板'].includes(line[0])?'ding':line[0]==='我'?'ma':'crew';
  panel.innerHTML=`<div class="script-label">虚构打工小剧场</div><h1>${episode.title}</h1><div class="dialogue-stage">${portraitMarkup(role)}<div><strong>${selecting?'下班前的选择':line[0]}</strong><p>${selecting?'先做点什么？':line[1]}</p></div></div>${selecting?`<div class="story-choices">${episode.choices.map((item,i)=>`<button class="choice" data-branch="${i}"><strong>${item[0]}</strong><small>${item[1]}</small></button>`).join('')}</div>`:`<div class="dialogue-actions"><button class="secondary" id="story-skip">跳过对白</button><button class="mainbtn" id="story-next">${activeEpisode.index===episode.lines.length-1?(episode.choices?'做个选择':'继续下班'):'下一句'}</button></div>`}<p class="micro">对白为虚构创作 · 战斗已暂停${selecting?'':' · Enter 下一句 / Esc 跳过'}</p>`;
  if(selecting)panel.querySelectorAll('[data-branch]').forEach(button=>button.onclick=()=>finishEpisode(Number(button.dataset.branch)));
  else{panel.querySelector('#story-next').onclick=nextEpisodeLine;panel.querySelector('#story-skip').onclick=skipEpisode}
  refreshPortraitBadges();
}
function nextEpisodeLine(){
  if(!activeEpisode||activeEpisode.selecting)return;
  const episode=EPISODES[activeEpisode.id];
  if(activeEpisode.index<episode.lines.length-1){activeEpisode.index++;renderEpisode()}
  else if(episode.choices){activeEpisode.selecting=true;renderEpisode()}
  else finishEpisode();
}
function skipEpisode(){
  if(!activeEpisode)return;const episode=EPISODES[activeEpisode.id];
  if(episode.choices){activeEpisode.index=episode.lines.length-1;activeEpisode.selecting=true;renderEpisode()}
  else finishEpisode();
}
function finishEpisode(branch=0){
  if(!activeEpisode||activeEpisode.finished)return;
  const episode=activeEpisode;episode.finished=true;activeEpisode=null;
  if(episode.reward&&episode.id==='opening'){
    if(branch===1)G.shield=Math.min(75,G.shield+15);else G.energy=Math.min(100,G.energy+20);
  }
  clearInput();state='playing';overlay.classList.add('hidden');episode.after?.();
}
function extraEnemyDamage(enemy,damage,origin){
  if(enemy.type!=='shield')return damage;
  if(damage>=80){enemy.guardDown=2.5;skillEffect('burst',enemy.x,enemy.y,70);return damage}
  if(enemy.guardDown>0)return damage;
  const source=origin||{x:G.px,y:G.py},towardPlayer=norm(G.px-enemy.x,G.py-enemy.y),incoming=norm(source.x-enemy.x,source.y-enemy.y);
  if(towardPlayer.x*incoming.x+towardPlayer.y*incoming.y>.1){skillEffect('slash',enemy.x,enemy.y,45);return damage*.4}
  return damage;
}
function updateBackstageEnemy(enemy,dt){
  officeEnemyTick(enemy,dt);
  enemy.guardDown=Math.max(0,(enemy.guardDown||0)-dt);
  if(enemy.type==='sniper'&&enemy.snipeWarning>0){
    enemy.snipeWarning-=dt;enemy.moveLock=true;
    if(enemy.snipeWarning<=0){
      const a=enemy.snipeAngle;hostileBullet(enemy.x,enemy.y,Math.cos(a),Math.sin(a),465,17);enemy.moveLock=false;
      skillEffect('burst',enemy.x,enemy.y,42,a);
    }
  }
}
function backstageAttack(enemy){
  if(['clock','printer'].includes(enemy.type)){officeEnemyAttack(enemy);return}
  if(enemy.type==='sniper'){
    enemy.snipeAngle=Math.atan2(G.py-enemy.y,G.px-enemy.x);enemy.snipeWarning=1.05;enemy.moveLock=true;enemy.fire=3.0;
  }else if(enemy.type==='healer'){
    const allies=G.enemies.filter(e=>e.live&&e!==enemy&&e.type!=='boss'&&e.hp<e.max&&dist2(e,enemy)<260**2).slice(0,4);
    for(const ally of allies){ally.hp=Math.min(ally.max,ally.hp+ally.max*.1);skillEffect('heal',ally.x,ally.y,65);G.beams.push({x:enemy.x,y:enemy.y,xx:ally.x,yy:ally.y,t:.22,color:'#dd7195'})}
    enemy.fire=2.7;
  }else if(enemy.type==='summoner'){
    for(let i=0;i<2;i++)addHazard({kind:'spawn',x:clamp(enemy.x+rand(-65,65),-1430,1430),y:clamp(enemy.y+rand(-65,65),-1030,1030),r:24,delay:1.1,life:.15,type:i?'runner':'shooter'});
    enemy.fire=5;
  }
}
function skillEffect(kind,x,y,r=100,angle=0){
  if(!G?.skillVfx||G.skillVfx.length>=48)return;
  const duration={slash:.35,burst:.5,sonic:.75,heal:.7,coffee:1.2}[kind]||.5;
  G.skillVfx.push({kind,x,y,r,angle,t:duration,max:duration});
}
function tickTheatre(dt){
  officeTick(dt);
  for(const effect of G.skillVfx)effect.t-=dt;G.skillVfx=G.skillVfx.filter(e=>e.t>0);
  G.coffeeTimer-=dt;G.paperTimer-=dt;
  if(G.up.coffee&&G.coffeeTimer<=0){
    G.coffeeTimer=4;const r=120+25*G.up.coffee;
    skillEffect('coffee',G.px,G.py,r);skillEffect('sonic',G.px,G.py,r);sound('chain');
    for(const enemy of G.enemies)if(enemy.live&&dist2(enemy,{x:G.px,y:G.py})<(r+enemy.r)**2){enemy.slow=2;hurtEnemy(enemy,(25+12*G.up.coffee)*musicPower())}
    if(G.evolutions.overtime)heal(3);
  }
  if(G.up.paper&&G.paperTimer<=0){
    G.paperTimer=2.1;const target=G.enemies.find(e=>e.live&&dist2(e,{x:G.px,y:G.py})<600**2);
    if(target&&G.shots.length<320){const a=Math.atan2(target.y-G.py,target.x-G.px);G.shots.push({x:G.px,y:G.py,vx:Math.cos(a)*560,vy:Math.sin(a)*560,t:3.5,pierce:0,hit:new Set(),damage:(20+G.up.paper*12)*musicPower(),paper:true,bounces:G.evolutions.receipt?6:2+G.up.paper})}
  }
}
function bouncePaper(shot,enemy){
  if(!shot.paper)return false;shot.bounces--;
  const target=G.enemies.filter(e=>e.live&&e!==enemy&&!shot.hit.has(e.id)&&dist2(e,enemy)<340**2).sort((a,b)=>dist2(a,enemy)-dist2(b,enemy))[0];
  if(shot.bounces<=0||!target)return false;
  const a=Math.atan2(target.y-shot.y,target.x-shot.x);shot.vx=Math.cos(a)*600;shot.vy=Math.sin(a)*600;shot.t=Math.max(shot.t,.6);skillEffect('slash',shot.x,shot.y,48,a);return true;
}
function drawSkillEffects(){
  for(const effect of G.skillVfx){
    const phase=1-effect.t/effect.max,size=effect.r*(.65+phase*.5)*2;
    ctx.save();ctx.translate(effect.x,effect.y);ctx.rotate(effect.angle);ctx.globalAlpha=Math.min(.7,effect.t/.2);
    if(effect.kind==='coffee'){
      circle(0,0,effect.r*(.5+phase*.45),'#8b603338');arc(0,0,effect.r*(.5+phase*.45),'#92683d',3);label('冰美式领域',0,-effect.r*.6,18,'#6c4028','center');
    }else if(effectAtlas.complete&&effectAtlas.naturalWidth){
      const cell={slash:[0,0],burst:[1,0],sonic:[0,1],heal:[1,1]}[effect.kind]||[0,0],sw=effectAtlas.naturalWidth/2,sh=effectAtlas.naturalHeight/2;
      ctx.drawImage(effectAtlas,cell[0]*sw,cell[1]*sh,sw,sh,-size/2,-size/2,size,size);
    }
    ctx.restore();
  }
}
function drawEnemyDetails(enemy){
  drawOfficeWarning(enemy);
  if(enemy.type==='shield'&&!(enemy.guardDown>0)){
    const a=Math.atan2(G.py-enemy.y,G.px-enemy.x);arc(enemy.x,enemy.y,enemy.r+9,'#40a6bb',6,a-1.2,a+1.2);
  }
  if(enemy.type==='sniper'&&enemy.snipeWarning>0){
    ctx.save();ctx.strokeStyle='#d1544a';ctx.lineWidth=2;ctx.setLineDash([12,9]);ctx.beginPath();ctx.moveTo(enemy.x,enemy.y);ctx.lineTo(enemy.x+Math.cos(enemy.snipeAngle)*680,enemy.y+Math.sin(enemy.snipeAngle)*680);ctx.stroke();ctx.restore();
  }
  if(enemy.type==='healer')arc(enemy.x,enemy.y,enemy.r+7,'#d577aa',2);
  if(['shield','sniper','healer','summoner','clock','printer'].includes(enemy.type)&&G.enemies.length<45)label(ENEMY_LABELS[enemy.type],enemy.x,enemy.y-enemy.r-30,14,'#5c453c','center');
}
function drawPaperShot(shot){
  ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(Math.atan2(shot.vy,shot.vx));ctx.fillStyle='#fff8e9';ctx.strokeStyle='#4f8ba1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-13,-10);ctx.lineTo(-7,0);ctx.lineTo(-13,10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function drawPerformer(type,x,y,size,angle,hit){
  const role=type==='player'?'ma':'ding',image=portraitImages[role],color=role==='ma'?'#398e9d':'#c96351';
  ctx.save();ctx.translate(x,y);if(hit)ctx.globalAlpha=.65;
  if(bodyAtlas.complete&&bodyAtlas.naturalWidth){
    ctx.save();if(Math.cos(angle)<0)ctx.scale(-1,1);const sw=bodyAtlas.naturalWidth/2;
    ctx.drawImage(bodyAtlas,role==='ma'?0:sw,0,sw,bodyAtlas.naturalHeight,-size/2,-size/2,size,size);ctx.restore();
  }
  const headY=-size*.16,r=size*.27;circle(0,headY,r+4,'#fffaf0');circle(0,headY,r,color);
  if(image?.complete&&image.naturalWidth){
    ctx.save();ctx.beginPath();ctx.arc(0,headY,r,0,TAU);ctx.clip();const side=Math.min(image.naturalWidth,image.naturalHeight);ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,-r,headY-r,r*2,r*2);ctx.restore();
  }else label(role==='ma'?'我':role==='ding'?'怪':'友',0,headY+r*.38,r*1.25,'#fffaf0','center',900);
  ctx.restore();
}
function refreshPortraitBadges(){
  document.querySelectorAll('[data-portrait]').forEach(element=>{
    const image=portraitImages[element.dataset.portrait];element.querySelector('img')?.remove();
    if(image?.complete&&image.naturalWidth){const img=document.createElement('img');img.src=image.src;img.alt=element.dataset.portrait==='ma'?'我的自选照片':'头目自选照片';element.append(img)}
  });
}
function loadPortrait(role,data){
  if(!/^data:image\/(jpeg|png|webp);base64,/.test(data))return;
  const image=new Image();image.onload=()=>{portraitImages[role]=image;refreshPortraitBadges()};image.src=data;
}
function initPortraits(){
  for(const role of ['ma','ding']){try{const data=localStorage.getItem('backstage-portrait-'+role);if(data)loadPortrait(role,data)}catch{}}
}
function portraitSettings(){
  clearInput();state='settings';overlay.classList.remove('hidden');
  panel.innerHTML=`<div class="script-label">头像设置</div><h1>用你认可的照片</h1><p class="sub">自己上传头像，或者直接用「我」字纸片闯关。</p><div class="portrait-settings">${['ma','ding'].map(role=>`<div>${portraitMarkup(role)}<label>${role==='ma'?'我的头像':'头目头像（可选）'}<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${role}"></label><button class="secondary" data-clear="${role}">恢复姓名牌</button></div>`).join('')}</div><p class="micro" id="portrait-status">照片仅保存在当前浏览器，不会上传。建议选择正脸居中的图片，最大 5 MB。</p><button class="mainbtn" id="portrait-done">返回首页</button>`;
  panel.querySelectorAll('[data-upload]').forEach(input=>input.onchange=()=>importPortrait(input.dataset.upload,input.files?.[0]));
  panel.querySelectorAll('[data-clear]').forEach(button=>button.onclick=()=>{portraitImages[button.dataset.clear]=null;try{localStorage.removeItem('backstage-portrait-'+button.dataset.clear)}catch{}refreshPortraitBadges()});
  panel.querySelector('#portrait-done').onclick=themeIntro;refreshPortraitBadges();
}
function importPortrait(role,file){
  const status=panel.querySelector('#portrait-status');
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){status.textContent='请选择 5 MB 以内的 JPG、PNG 或 WebP 图片。';return}
  const reader=new FileReader();reader.onerror=()=>status.textContent='照片读取失败，请重试。';
  reader.onload=()=>{
    const image=new Image();image.onerror=()=>status.textContent='这张图片无法读取，请换一张。';
    image.onload=()=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=384;const context=canvas.getContext('2d'),side=Math.min(image.naturalWidth,image.naturalHeight);
      context.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,384,384);const data=canvas.toDataURL('image/jpeg',.9);loadPortrait(role,data);
      try{localStorage.setItem('backstage-portrait-'+role,data);status.textContent='已更新头像，只保存在当前浏览器。'}catch{status.textContent='头像已在本次打开中生效；浏览器未允许保存。'}
    };image.src=String(reader.result);
  };reader.readAsDataURL(file);
}
