'use strict';
// Combat effects and local avatar storage. No dialogue or narrative state.
const ENEMY_LABELS=MACHINE_ENEMIES;
const portraitImages={ma:null,ding:null};
function combatState(){return {skillVfx:[],cryoTimer:3,discTimer:1.2};}
function portraitMarkup(role){return `<div class="portrait-badge" data-portrait="${role}"><span class="portrait-default" role="img" aria-label="${role==='ma'?'默认驾驶员装甲':'默认敌方主核'}"></span></div>`;}
function extraEnemyDamage(enemy,damage,origin){
  const source=origin||{x:G.px,y:G.py};
  if(enemy.type==='shield'){
    if(damage>=80){enemy.guardDown=2.5;skillEffect('burst',enemy.x,enemy.y,70);return damage}
    if(enemy.guardDown>0)return damage;
    const facing=enemy.guardAngle??Math.atan2(G.py-enemy.y,G.px-enemy.x),incoming=Math.atan2(source.y-enemy.y,source.x-enemy.x);
    if(Math.abs(angleDelta(facing,incoming))<1.2){skillEffect('slash',enemy.x,enemy.y,45);return damage*.4}
    return damage;
  }
  return coverDamage(enemy,damage,origin);
}
function updateCombatEnemy(enemy,dt){
  enemy.guardDown=Math.max(0,(enemy.guardDown||0)-dt);
  tacticalEnemyTick(enemy,dt);
  if(enemy.stagger>0)return;
  updateMachineAbilities(enemy,dt);
  if(enemy.recovery>0||enemy.commandedBy&&findTacticalEnemy(enemy.commandedBy)?.commandCast>0)enemy.moveLock=true;
}
function supportAttack(enemy){
  if(['clock','printer'].includes(enemy.type)){machineAttack(enemy);return}
  beginSupportCast(enemy);
}
function skillEffect(kind,x,y,r=100,angle=0){
  if(!G?.skillVfx||G.skillVfx.length>=48)return;
  const duration={slash:.35,burst:.5,sonic:.75,heal:.7,cryo:1.2}[kind]||.5;
  G.skillVfx.push({kind,x,y,r,angle,t:duration,max:duration});
}
function tickCombat(dt){
  tickArsenal(dt);tacticsTick(dt);
  for(const effect of G.skillVfx)effect.t-=dt;G.skillVfx=G.skillVfx.filter(e=>e.t>0);
  G.cryoTimer-=dt;G.discTimer-=dt;
  if(G.up.cryo&&G.cryoTimer<=0){
    G.cryoTimer=4;const r=120+25*G.up.cryo;
    skillEffect('cryo',G.px,G.py,r);skillEffect('sonic',G.px,G.py,r);sound('chain');
    for(const enemy of G.enemies)if(enemy.live&&dist2(enemy,{x:G.px,y:G.py})<(r+enemy.r)**2){enemy.slow=2;hurtEnemy(enemy,(25+12*G.up.cryo)*musicPower())}
    if(G.evolutions.regen)heal(3);
  }
  if(G.up.disc&&G.discTimer<=0){
    G.discTimer=2.1;const target=G.enemies.find(e=>e.live&&dist2(e,{x:G.px,y:G.py})<600**2);
    if(target&&G.shots.length<320){const a=Math.atan2(target.y-G.py,target.x-G.px);G.shots.push({x:G.px,y:G.py,vx:Math.cos(a)*560,vy:Math.sin(a)*560,t:3.5,pierce:0,hit:new Set(),damage:(20+G.up.disc*12)*musicPower(),disc:true,bounces:G.evolutions.ricochet?6:2+G.up.disc})}
  }
}
function bounceDisc(shot,enemy){
  if(!shot.disc)return false;shot.bounces--;
  const target=G.enemies.filter(e=>e.live&&e!==enemy&&!shot.hit.has(e.id)&&dist2(e,enemy)<340**2).sort((a,b)=>dist2(a,enemy)-dist2(b,enemy))[0];
  if(shot.bounces<=0||!target)return false;
  const a=Math.atan2(target.y-shot.y,target.x-shot.x);shot.vx=Math.cos(a)*600;shot.vy=Math.sin(a)*600;shot.t=Math.max(shot.t,.6);skillEffect('slash',shot.x,shot.y,48,a);return true;
}
function drawSkillEffects(){
  for(const effect of G.skillVfx){
    const phase=1-effect.t/effect.max,size=effect.r*(.65+phase*.5)*2;
    ctx.save();ctx.translate(effect.x,effect.y);ctx.rotate(effect.angle);ctx.globalAlpha=Math.min(.7,effect.t/.2);
    if(effect.kind==='cryo'){
      circle(0,0,effect.r*(.5+phase*.45),'#66cfff28');arc(0,0,effect.r*(.5+phase*.45),'#78cfff',3);label('低温力场',0,-effect.r*.6,18,'#a5e9ff','center');
    }else if(effectAtlas.complete&&effectAtlas.naturalWidth){
      const cell={slash:[0,0],burst:[1,0],sonic:[0,1],heal:[1,1]}[effect.kind]||[0,0],sw=effectAtlas.naturalWidth/2,sh=effectAtlas.naturalHeight/2;
      ctx.drawImage(effectAtlas,cell[0]*sw,cell[1]*sh,sw,sh,-size/2,-size/2,size,size);
    }
    ctx.restore();
  }
}
function drawEnemyDetails(enemy){
  drawMachineWarning(enemy);drawTacticalDetails(enemy);
  if(enemy.type==='shield'&&!(enemy.guardDown>0)){
    const a=enemy.guardAngle??Math.atan2(G.py-enemy.y,G.px-enemy.x);arc(enemy.x,enemy.y,enemy.r+9,'#78e6ff',6,a-1.2,a+1.2);
  }
  if(enemy.type==='sniper'&&enemy.snipeWarning>0){
    ctx.save();ctx.strokeStyle=enemy.snipeWarning>.4?'#ffc66e':'#ff827b';ctx.lineWidth=enemy.snipeWarning>.4?2:4;ctx.setLineDash(enemy.snipeWarning>.4?[12,9]:[]);ctx.beginPath();ctx.moveTo(enemy.x,enemy.y);ctx.lineTo(enemy.x+Math.cos(enemy.snipeAngle)*680,enemy.y+Math.sin(enemy.snipeAngle)*680);ctx.stroke();ctx.restore();
  }
  if(enemy.type==='healer')arc(enemy.x,enemy.y,enemy.r+7,'#bfa1ff',2);
  if(['shield','sniper','healer','summoner','clock','printer'].includes(enemy.type)&&G.enemies.length<45)label(ENEMY_LABELS[enemy.type],enemy.x,enemy.y-enemy.r-30,W<900?17:14,'#c3d5e3','center');
}
function drawDiscShot(shot){
 ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(G.t*10);arc(0,0,13,'#a4edff',3,0,TAU*.8);arc(0,0,8,'#b79aff',3,Math.PI,Math.PI*2.7);circle(0,0,3,'#e8faff');ctx.restore();
}
function drawPilot(type,x,y,size,angle,hit){
 ctx.save();ctx.translate(x,y);if(hit)ctx.globalAlpha=.65;
 if(bodyAtlas.complete&&bodyAtlas.naturalWidth){ctx.save();if(Math.cos(angle)<0)ctx.scale(-1,1);ctx.drawImage(bodyAtlas,-size/2,-size/2,size,size);ctx.restore()}
 const image=portraitImages.ma;
 if(image?.complete&&image.naturalWidth){const headY=-size*.26,r=size*.145;circle(0,headY,r+3,'#78e6ff');ctx.save();ctx.beginPath();ctx.arc(0,headY,r,0,TAU);ctx.clip();const side=Math.min(image.naturalWidth,image.naturalHeight);ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,-r,headY-r,r*2,r*2);ctx.restore()}
 ctx.restore();
}
function refreshPortraitBadges(){
  document.querySelectorAll('[data-portrait]').forEach(element=>{
    const image=portraitImages[element.dataset.portrait];element.querySelector('img')?.remove();
    if(image?.complete&&image.naturalWidth){const img=document.createElement('img');img.src=image.src;img.alt=element.dataset.portrait==='ma'?'我的自选照片':'主核自选照片';element.append(img)}
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
  panel.className='panel';clearInput();state='settings';overlay.classList.remove('hidden');
  panel.innerHTML=`<div class="script-label">头像设置</div><h1>驾驶员身份</h1><p class="sub">上传自己的头像，或使用默认机甲装甲。</p><div class="portrait-settings">${['ma','ding'].map(role=>`<div>${portraitMarkup(role)}<label>${role==='ma'?'驾驶员头像':'主核头像（可选）'}<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${role}"></label><button class="secondary" data-clear="${role}">恢复默认装甲</button></div>`).join('')}</div><p class="micro" id="portrait-status">照片仅保存在当前浏览器，不会上传。建议选择正脸居中的图片，最大 5 MB。</p><button class="mainbtn" id="portrait-done">返回首页</button>`;
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
