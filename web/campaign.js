'use strict';
// Twelve-minute stage campaign. No runtime packages or external APIs.
const SHOW = {
  title: '马嘉祺大战我哥哥丁程鑫',
  duration: 900,
  bosses: [
    {at:180, name:'丁程鑫 · 舞步试探', hp:3600},
    {at:420, name:'丁程鑫 · 追光领域', hp:10000},
    {at:720, name:'丁程鑫 · 压轴时刻', hp:24000}
  ],
  acts: ['第一幕 · 开场交锋', '第二幕 · 追光竞演', '第三幕 · 压轴对决'],
};
const SKILLS = [
  {id:'rapid',name:'高音连奏',tag:'主唱',max:5,desc:'基础射击速度 +22%；与三重和声组合进化'},
  {id:'multi',name:'三重和声',tag:'主唱',max:4,desc:'增加一道散射音符；多路命中大型目标'},
  {id:'damage',name:'追光音符',tag:'追踪',max:4,desc:'每 1.8 秒发射追踪音符，命中产生范围共振'},
  {id:'pierce',name:'冰蓝尾音',tag:'控场',max:3,desc:'音符穿透 +1，命中减速 55%，持续 1.4 秒'},
  {id:'chain',name:'电音接力',tag:'连锁',max:4,desc:'击破后向附近目标传递电弧；与返场爆破进化'},
  {id:'bomb',name:'返场爆破',tag:'连锁',max:4,desc:'击破引发范围共振，能触发进一步连锁'},
  {id:'recycler',name:'应援回收',tag:'共鸣',max:3,desc:'冲刺吸弹获得的共鸣能量 +35%'},
  {id:'blast',name:'全场共鸣',tag:'共鸣',max:3,desc:'共鸣爆发范围 +23%、伤害 +25%'},
  {id:'capacitor',name:'返场充能',tag:'共鸣',max:3,desc:'击破回复共鸣；与应援回收组合进化'},
  {id:'dash',name:'舞步残影',tag:'身法',max:3,desc:'冲刺冷却 -15%、位移 +10%；可强化环绕音刃'},
  {id:'magnet',name:'应援引力',tag:'补给',max:3,desc:'经验与应援碎片吸附半径 +85'},
  {id:'armor',name:'舞台守护',tag:'生存',max:4,desc:'生命上限 +20，立即恢复 25 点生命'},
  {id:'orbit',name:'环绕音刃',tag:'近身',max:4,desc:'增加环绕音刃，冲刺时外扩；与舞步残影进化'},
  {id:'vamp',name:'返场修复',tag:'生存',max:3,desc:'每 18 次击破恢复生命，等级越高恢复越多'},
  {id:'pulse',name:'低音震场',tag:'范围',max:4,desc:'每 3.2 秒向四周释放低音音波并击退小怪'},
  {id:'echo',name:'回声返照',tag:'身法',max:3,desc:'每次冲刺结束留下残影，延迟爆发伤害附近目标'},
];
const RECIPES = [
  {id:'chorus',name:'极昼合唱',a:'rapid',an:3,b:'multi',bn:2,desc:'每轮向后补射和声，主音符伤害 +40%'},
  {id:'storm',name:'电音风暴',a:'chain',an:3,b:'bomb',bn:2,desc:'每 2.5 秒主动电弧打击五个目标，击破连锁也增强'},
  {id:'blade',name:'追光圆舞',a:'orbit',an:3,b:'dash',bn:2,desc:'音刃半径扩张、伤害翻倍，冲刺冷却额外缩短'},
  {id:'encore',name:'永不停场',a:'recycler',an:2,b:'capacitor',bn:2,desc:'共鸣后获得 4 秒超频和 20 护盾，能量需求降至 85'},
];
let selectedDifficulty='tour';
function campaignState(){return {
  difficulty:selectedDifficulty, bossIndex:0, bossesDefeated:0, bossActive:false,
  hazards:[],supplies:[], supplyOpened:0,nextSupply:90,nextEvent:75,eventCount:0,eventTimer:0,eventName:'',
  nextElite:55,rerolls:2,evolutions:{},relics:[],power:1,damageTaken:0,healing:0,
  pulse:2.5,storm:1,echoes:[],hadDash:false,ending:false,surge:0,
};}
function difficulty(){return G.difficulty==='hard'?1.3:1;}
function actIndex(){return G.t<240?0:G.t<540?1:2;}
function musicPower(){return (1+(G.lvl-1)*.035)*G.power;}
function resonanceCost(){return G.evolutions.encore?85:100;}
function chargeReady(){return G.energy>=resonanceCost()-.01;}
function timeLabel(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
function skillName(id){return SKILLS.find(s=>s.id===id)?.name||id;}
function themeIntro(){
  menu(SHOW.title,'马嘉祺登场，挑战哥哥丁程鑫的三幕舞台。',
    '<strong>冲刺吸弹 → 组合进化 → 十二分钟压轴对决</strong><br>第 3 / 7 / 12 分钟迎战 Boss；前两幕获胜后继续。<br>每 90 秒出现补给，靠近后按 E 或点「补给」。<br><span class="desktop-help">WASD 移动 · SPACE 冲刺 · Q 共鸣 · ESC 构筑手册</span><span class="touch-help">左侧摇杆移动 · 右侧冲刺 / 共鸣 · 自动射击</span>',
    '开始对决',()=>begin());
  const record=readRecord();
  panel.querySelector('.micro').textContent=`单局约 12–15 分钟 · ${record.wins||0} 次通关 · 最长 ${timeLabel(record.bestTime||0)}`;
  const selectors=document.createElement('div');selectors.className='difficulty';
  selectors.innerHTML=`<button data-mode="tour" aria-pressed="${selectedDifficulty==='tour'}">巡演<small>标准挑战 · 三幕成长</small></button><button data-mode="hard" aria-pressed="${selectedDifficulty==='hard'}">压轴<small>更密集弹幕 · 强化敌人</small></button>`;
  panel.querySelector('#action').before(selectors);
  selectors.querySelectorAll('button').forEach(button=>button.onclick=()=>{
    selectedDifficulty=button.dataset.mode;
    selectors.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  });
}
function readRecord(){try{return JSON.parse(localStorage.getItem('stage-duel-record')||'{}')}catch{return {}}}
function saveRecord(win){const record=readRecord();record.bestTime=Math.max(record.bestTime||0,G.t);record.bestKills=Math.max(record.bestKills||0,G.kills);record.wins=(record.wins||0)+(win?1:0);try{localStorage.setItem('stage-duel-record',JSON.stringify(record))}catch{}}
function announceEvolution(){
  for(const recipe of RECIPES){
    if(!G.evolutions[recipe.id]&&G.up[recipe.a]>=recipe.an&&G.up[recipe.b]>=recipe.bn){
      G.evolutions[recipe.id]=true;notice('组合进化 · '+recipe.name,3.4);sound('level');ring(G.px,G.py,230,'#ffe7a0',.8);
    }
  }
}
function offerChoices(title,subtitle,options,reroll=false){
  clearInput();choiceSet=options;state='paused';overlay.classList.remove('hidden');
  panel.innerHTML=`<div class="eyebrow">舞台进阶</div><h1>${title}</h1><p class="sub">${subtitle}</p><div class="choices">${options.map((u,i)=>`<button class="choice" data-i="${i}"><strong>${i+1} · ${u.name}</strong><small>${u.desc}</small></button>`).join('')}</div>${reroll?`<button class="secondary" id="reroll" ${G.rerolls<=0?'disabled':''}>重选 · 剩余 ${G.rerolls} 次</button>`:''}<p class="micro">${recipeHint()}</p>`;
  panel.querySelectorAll('.choice').forEach(b=>b.onclick=()=>pick(Number(b.dataset.i)));
  if(reroll)panel.querySelector('#reroll').onclick=()=>{if(G.rerolls>0){G.rerolls--;offerUpgrade()}};
  sound('level');
}
function recipeHint(){const pending=RECIPES.find(r=>!G.evolutions[r.id]&&(G.up[r.a]||G.up[r.b]));return pending?`${pending.name}：${skillName(pending.a)} ${G.up[pending.a]}/${pending.an} + ${skillName(pending.b)} ${G.up[pending.b]}/${pending.bn}`:'技能限级，可组合进化；暂停可查看全部配方。'}
function offerUpgrade(){
  const pool=SKILLS.filter(s=>G.up[s.id]<s.max);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  let opts=pool.slice(0,3);
  if(G.lvl===2&&SKILLS.filter(s=>G.up[s.id]>0).length===0&&G.rerolls===2)opts=['chain','damage','orbit'].map(id=>SKILLS.find(s=>s.id===id));
  opts=opts.map(s=>({...s,name:`[${s.tag}] ${s.name} ${G.up[s.id]+1}/${s.max}`}));
  if(!opts.length)opts=[{id:'heal',kind:'supply',name:'返场休息',desc:'技能已满，恢复 45 生命并获得 15 护盾'}];
  offerChoices('能力进化',`等级 ${G.lvl} · 选择构筑方向`,opts,true);
}
function takeChoice(i){
  const u=choiceSet[i];if(state!=='paused'||!u)return;
  if(u.kind==='relic'){
    G.relics.push(u.id);
    if(u.id==='power'){G.power*=1.2}
    if(u.id==='guard'){G.maxhp+=30;heal(40);G.shield=Math.min(75,G.shield+30)}
    if(u.id==='tempo'){G.surge+=1;G.rerolls++}
  }else if(u.kind==='supply'){
    if(u.id==='heal'){heal(45);G.shield=Math.min(75,G.shield+15)}
    if(u.id==='amp'){G.boost=12;G.energy=100;G.power*=1.04}
    if(u.id==='wisdom'){G.xp+=Math.ceil(G.need*.7);G.rerolls++}
  }else{
    if(G.up[u.id]>=SKILLS.find(s=>s.id===u.id).max)return;
    G.up[u.id]++;if(u.id==='armor'){G.maxhp+=20;heal(25)}
  }
  choiceSet=[];clearInput();state='playing';overlay.classList.add('hidden');
  notice('已获得 · '+u.name.replace(/^\[.*?\]\s*/,''),2);announceEvolution();
  if(G.xp>=G.need)levelUp();
}
function heal(amount){const gained=Math.min(amount,G.maxhp-G.hp);G.hp+=gained;G.healing+=gained;}
function bossDefeated(e){
  G.bossActive=false;G.bossesDefeated++;G.hostile=[];G.hazards=[];G.echoes=[];
  heal(20);G.energy=100;
  if(e.chapter===2){end(true);return}
  G.xp+=Math.ceil(G.need*.45);
  offerChoices('幕间 · 舞台遗物',`${e.name} 已完成 · 时间暂停，选择一件永久遗物`,[
    {id:'power',kind:'relic',name:'高音徽章',desc:'全局伤害永久 +20%，适合远程与连锁构筑'},
    {id:'guard',kind:'relic',name:'守护应援',desc:'生命上限 +30、恢复 40 生命，获得 30 护盾'},
    {id:'tempo',kind:'relic',name:'节拍核心',desc:'永久射速 +15%，升级重选次数 +1'},
  ]);
}
function startBoss(chapter){
  const data=SHOW.bosses[chapter];spawn('boss',clamp(G.px,-1250,1250),clamp(G.py-330,-800,800));
  const e=G.enemies.at(-1);Object.assign(e,{chapter,name:data.name,hp:data.hp*difficulty(),max:data.hp*difficulty(),phase:1,attack:0,fire:1.3,elite:false});
  G.bossIndex=chapter+1;G.bossActive=true;G.boss=true;
  G.hostile=[];notice(data.name+' · 登场',3);sound('boom');
}
function waveEvent(){
  G.eventCount++;G.eventTimer=18;const kind=(G.eventCount-1)%3;
  G.eventName=['灯海包围','舞步追击','追光封锁'][kind];notice('特别舞台 · '+G.eventName,3);
  if(kind===0){for(let i=0;i<8;i++){const a=i*TAU/8,x=clamp(G.px+Math.cos(a)*360,-1400,1400),y=clamp(G.py+Math.sin(a)*360,-1000,1000);addHazard({kind:'spawn',x,y,r:32,delay:1.5,life:.2,type:i%2?'shooter':'runner'})}}
  else if(kind===1){for(let i=0;i<4;i++){const a=i*TAU/4;addHazard({kind:'spawn',x:clamp(G.px+Math.cos(a)*330,-1400,1400),y:clamp(G.py+Math.sin(a)*330,-1000,1000),r:30,delay:1.4,life:.2,type:'charger'})}}
  else {for(let i=0;i<4;i++)addHazard({kind:'blast',x:clamp(G.px+rand(-230,230),-1400,1400),y:clamp(G.py+rand(-200,200),-1000,1000),r:72,delay:1.6+i*.3,life:1,damage:18})}
}
function spawnElite(){
  const p=safeSpawnPoint(420),e=spawn(G.t>300?'conductor':'brute',p.x,p.y);
  if(!e)return;e.elite=true;e.hp*=3.5;e.max=e.hp;e.speed*=1.12;e.r*=1.25;
  notice('精英舞台机关出现 · 击破获取大量经验',2.3);
}
function campaignTick(dt){
  if(G.bossIndex<3&&!G.bossActive&&G.t>=SHOW.bosses[G.bossIndex].at)startBoss(G.bossIndex);
  if(G.t>=G.nextEvent){G.nextEvent+=75;waveEvent()}
  G.eventTimer=Math.max(0,G.eventTimer-dt);
  if(G.t>=G.nextElite&&G.enemies.length<210){G.nextElite+=55;spawnElite()}
  if(G.t>=G.nextSupply){G.nextSupply+=90;G.supplies.push({x:clamp(G.px+rand(-180,180),-1400,1400),y:clamp(G.py+rand(-180,180),-1000,1000),life:50});notice('应援补给抵达 · 靠近领取',2.5)}
  G.supplies.forEach(s=>s.life-=dt);G.supplies=G.supplies.filter(s=>s.life>0);
  if(keys.has('e')&&nearSupply())openSupply();
  if(state!=='playing')return;
  updateHazards(dt);
  updateAdvancedWeapons(dt);
  if(G.t>=SHOW.duration&&state==='playing')end(false);
}
function safeSpawnPoint(radius){
  const a=rand(0,TAU);let x=clamp(G.px+Math.cos(a)*radius,-1440,1440),y=clamp(G.py+Math.sin(a)*radius,-1040,1040);
  if((x-G.px)**2+(y-G.py)**2<270**2){x=clamp(G.px-Math.sign(G.px||1)*500,-1440,1440);y=clamp(G.py-Math.sign(G.py||1)*350,-1040,1040)}
  return {x,y};
}
function spawnCampaignWave(){
  const progress=clamp(G.t/720,0,1);G.spawn=(.64-.39*progress)/difficulty();
  const count=1+Math.floor(G.t/190)+(G.eventTimer>0?1:0);
  for(let i=0;i<Math.min(count,5)&&G.enemies.length<210;i++){
    const a=rand(0,TAU),r=rand(520,650),roll=Math.random();
    let type=roll<.30?'shooter':'runner';
    if(G.t>90&&roll>.75)type='charger';
    if(G.t>160&&roll>.62&&roll<=.75)type='brute';
    if(G.t>300&&roll<.12)type='conductor';
    const point=safeSpawnPoint(r);spawn(type,point.x,point.y);
  }
}
function updateEnemyStage(e,dt){
  if(e.type==='charger'){
    e.chargeCD=(e.chargeCD??2)-dt;
    if(e.chargeCD<=0&&(e.chargeWarning||0)<=0&&(e.chargeRun||0)<=0){e.charges=(e.charges||0)+1;e.chargeWarning=.9;e.chargeAngle=Math.atan2(G.py-e.y,G.px-e.x);e.moveLock=true}
    if(e.chargeWarning>0){e.chargeWarning-=dt;if(e.chargeWarning<=0){e.chargeRun=.65;e.chargeCD=3.3}}
    else if(e.chargeRun>0){e.chargeRun-=dt;e.x=clamp(e.x+Math.cos(e.chargeAngle)*510*dt,-1450,1450);e.y=clamp(e.y+Math.sin(e.chargeAngle)*510*dt,-1050,1050);if(e.chargeRun<=0)e.moveLock=false}
  }
  if(e.type==='boss'){
    const phase=e.hp/e.max<.33?3:e.hp/e.max<.66?2:1;
    if(e.phase!==phase){e.phase=phase;notice(e.name+' · 第 '+phase+' 阶段',2);ring(e.x,e.y,240,'#ff86af',.6)}
  }
}
function bossAttack(e){
  const phase=e.phase||1,chapter=e.chapter||0,angle=Math.atan2(G.py-e.y,G.px-e.x);
  e.attack=(e.attack||0)+1;
  if(e.attack%3===1){
    const count=12+chapter*4+phase*2;
    for(let i=0;i<count;i++){const a=i*TAU/count+G.t*.24;hostileBullet(e.x+Math.cos(a)*48,e.y+Math.sin(a)*48,Math.cos(a),Math.sin(a),155+phase*20+chapter*10,12+chapter*2)}
    e.fire=1.8-phase*.15;
  }else if(e.attack%3===2){
    for(let j=0;j<phase+chapter;j++)addHazard({kind:'blast',x:clamp(G.px+rand(-90,90),-1400,1400),y:clamp(G.py+rand(-90,90),-1000,1000),r:78+chapter*10,delay:1.2+j*.25,life:.55,damage:18+chapter*3});
    const fan=3+phase*2;for(let i=0;i<fan;i++){const a=angle+(i-(fan-1)/2)*.16;hostileBullet(e.x+Math.cos(a)*48,e.y+Math.sin(a)*48,Math.cos(a),Math.sin(a),245,14)}
    e.fire=2.0;
  }else{
    addHazard({kind:'lane',x:e.x,y:e.y,x2:clamp(e.x+Math.cos(angle)*950,-1500,1500),y2:clamp(e.y+Math.sin(angle)*950,-1100,1100),r:24+chapter*6,delay:1.25,life:.65,damage:24});
    if(chapter>0)for(let side of [-1,1])addHazard({kind:'lane',x:G.px+side*180,y:G.py-450,x2:G.px+side*180,y2:G.py+450,r:20,delay:1.6,life:.7,damage:20});
    if(chapter===2)for(let i=0;i<3;i++)addHazard({kind:'spawn',x:clamp(e.x+rand(-220,220),-1400,1400),y:clamp(e.y+rand(-200,200),-1000,1000),r:25,delay:1.2,life:.1,type:'charger'});
    e.fire=2.4;
  }
}
function conductorAttack(e){
  const a=Math.atan2(G.py-e.y,G.px-e.x);for(let j=-2;j<=2;j++){const b=a+j*.25;hostileBullet(e.x,e.y,Math.cos(b),Math.sin(b),225,11)}
  e.fire=e.elite?1.1:1.9;
}
function addHazard(h){if(G.hazards.length<36)G.hazards.push({...h,age:0,done:false})}
function segmentDistance2(px,py,h){const dx=h.x2-h.x,dy=h.y2-h.y,t=clamp(((px-h.x)*dx+(py-h.y)*dy)/(dx*dx+dy*dy||1),0,1);return (px-h.x-t*dx)**2+(py-h.y-t*dy)**2}
function updateHazards(dt){
  for(const h of G.hazards){h.age+=dt;if(h.age<h.delay)continue;
    if(h.kind==='spawn'){if(!h.done&&G.enemies.length<215)spawn(h.type,h.x,h.y);h.done=true;continue}
    const hit=h.kind==='lane'?segmentDistance2(G.px,G.py,h)<(h.r+14)**2:dist2({x:G.px,y:G.py},h)<(h.r+14)**2;
    if(hit&&G.dashTime<=0)damagePlayer(h.damage);
  }
  G.hazards=G.hazards.filter(h=>h.age<h.delay+h.life&&!h.done);
}
function nearSupply(){return G.supplies.find(s=>(s.x-G.px)**2+(s.y-G.py)**2<115**2)}
function openSupply(){
  if(state!=='playing')return;const supply=nearSupply();if(!supply)return;
  G.supplies=G.supplies.filter(s=>s!==supply);G.supplyOpened++;
  offerChoices('应援补给','三选一 · 领取后继续计时',[
    {id:'heal',kind:'supply',name:'暖心应援',desc:'恢复 45 生命，获得 15 护盾'},
    {id:'amp',kind:'supply',name:'高能应援',desc:'12 秒超频、共鸣充满，永久伤害 +4%'},
    {id:'wisdom',kind:'supply',name:'灵感手册',desc:'获取下一级所需 70% 的经验，重选次数 +1'},
  ]);
}
function addMusicShot(angle,damage,pierce=0){if(G.shots.length<320)G.shots.push({x:G.px+Math.cos(angle)*27,y:G.py+Math.sin(angle)*27,vx:Math.cos(angle)*900,vy:Math.sin(angle)*900,t:1.1,pierce,hit:new Set(),damage})}
function updateAdvancedWeapons(dt){
  G.pulse-=dt;G.storm-=dt;
  if(G.up.pulse&&G.pulse<=0){
    G.pulse=Math.max(1.3,3.2-G.up.pulse*.24);const radius=135+G.up.pulse*24;
    ring(G.px,G.py,radius,'#eac1ff',.5);sound('chain');
    for(const e of G.enemies)if(e.live&&dist2(e,{x:G.px,y:G.py})<(radius+e.r)**2){hurtEnemy(e,(18+12*G.up.pulse)*musicPower());if(e.type!=='boss'){const n=norm(e.x-G.px,e.y-G.py);e.x=clamp(e.x+n.x*38,-1450,1450);e.y=clamp(e.y+n.y*38,-1050,1050)}}
  }
  if(G.evolutions.storm&&G.storm<=0){
    G.storm=2.5;const targets=G.enemies.filter(e=>e.live&&dist2(e,{x:G.px,y:G.py})<470**2).sort((a,b)=>dist2(a,{x:G.px,y:G.py})-dist2(b,{x:G.px,y:G.py})).slice(0,5);
    for(const e of targets){G.beams.push({x:G.px,y:G.py,xx:e.x,yy:e.y,t:.3});hurtEnemy(e,85*musicPower())}
  }
  if(G.hadDash&&G.dashTime<=0&&G.up.echo)G.echoes.push({x:G.px-G.dx*45,y:G.py-G.dy*45,t:.65});
  G.hadDash=G.dashTime>0;
  for(const e of G.echoes){e.t-=dt;if(e.t<=0){const r=105+G.up.echo*25;ring(e.x,e.y,r,'#8eeeff',.35);for(const other of G.enemies)if(other.live&&dist2(other,e)<(r+other.r)**2)hurtEnemy(other,(35+G.up.echo*30)*musicPower())}}
  G.echoes=G.echoes.filter(e=>e.t>0);
}
function themePause(){
  if(state!=='playing')return;clearInput();state='suspended';overlay.classList.remove('hidden');
  panel.innerHTML=`<h1>幕间暂停</h1><p class="sub">${SHOW.acts[actIndex()]} · ${timeLabel(G.t)} · ${G.difficulty==='hard'?'压轴':'巡演'}</p><div class="build-book">${RECIPES.map(r=>`<div><strong>${G.evolutions[r.id]?'已进化 · ':''}${r.name}</strong><small>${skillName(r.a)} ${G.up[r.a]}/${r.an} + ${skillName(r.b)} ${G.up[r.b]}/${r.bn}</small><small>${r.desc}</small></div>`).join('')}</div><p class="micro">已获 ${G.relics.length} 件遗物 · 重选 ${G.rerolls} 次 · 补给 ${G.supplyOpened} 次<br>Q 共鸣 / SPACE 冲刺 / E 补给</p><button class="mainbtn" id="resume">继续对决</button>`;
  panel.querySelector('#resume').onclick=()=>{clearInput();state='playing';overlay.classList.add('hidden');sound('collect')};
}
function themeEnd(win){
  if(state!=='playing'||G.ending)return;G.ending=true;saveRecord(win);clearInput();
  menu(win?'压轴完成！':'本场谢幕',`${timeLabel(G.t)} · ${G.kills} 次击破 · 等级 ${G.lvl}`,
    `<strong>${win?'马嘉祺完成了与哥哥丁程鑫的三幕舞台对决。':G.t>=SHOW.duration?'15 分钟已到，压轴挑战尚未完成。':'下次用冲刺化解弹幕，寻找预警区的空隙。'}</strong><br>完成 ${G.bossesDefeated}/3 场 Boss · ${Object.keys(G.evolutions).length} 项组合进化<br>吸弹 ${G.absorbed} 枚 · 共鸣 ${G.overloads} 次 · 最高爆发 ${G.bestBurst}<br>补给 ${G.supplyOpened} 次 · 遗物 ${G.relics.length} 件`,
    '再来一场',()=>themeIntro());
}
function drawStageWorld(){
  // Warning geometry uses exactly the same radius / segment as the hit test.
  for(const h of G.hazards){
    const active=h.age>=h.delay,color=h.kind==='spawn'?'#ffc972':'#ff709d';
    ctx.save();ctx.strokeStyle=rgba(color,active?.9:.65);ctx.fillStyle=rgba(color,active?.32:.10);
    if(h.kind==='lane'){
      ctx.lineWidth=h.r*2;ctx.strokeStyle=rgba(color,active?.45:.12);ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(h.x2,h.y2);ctx.stroke();
      ctx.lineWidth=3;ctx.strokeStyle=color;if(!active)ctx.setLineDash([14,10]);ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(h.x2,h.y2);ctx.stroke();ctx.setLineDash([]);
    }else{
      circle(h.x,h.y,h.r,rgba(color,active?.27:.09));arc(h.x,h.y,h.r,color,active?4:2);if(!active)arc(h.x,h.y,h.r+5,color,4,-Math.PI/2,-Math.PI/2+TAU*clamp(h.age/h.delay,0,1));
    }
    ctx.restore();
  }
  for(const supply of G.supplies){
    const near=(supply.x-G.px)**2+(supply.y-G.py)**2<115**2;
    circle(supply.x,supply.y,34,'#ffd78322');arc(supply.x,supply.y,35,'#ffda87',2);sprite('brute',supply.x,supply.y,54,0,false);
    label(near?'E / 领取补给':'应援补给',supply.x,supply.y-46,16,'#ffe2a7','center');
  }
  for(const echo of G.echoes){ctx.save();ctx.globalAlpha=.35;sprite('player',echo.x,echo.y,90,0,false);ctx.restore();arc(echo.x,echo.y,48,'#9af5ff',2)}
}
function drawStageHud(width,height,small,pad){
  label(SHOW.acts[actIndex()],width/2,small?153:148,small?16:18,'#d5c4ed','center');
  const boss=G.enemies.find(e=>e.live&&e.type==='boss');
  if(boss){
    const bw=Math.min(width-pad*2,600),left=(width-bw)/2;
    label(`${boss.name} · 阶段 ${boss.phase||1}/3`,width/2,small?177:171,small?14:16,'#ffb8d1','center');
    bar(left,small?187:182,bw,small?9:10,boss.hp/boss.max,'#ef558a');
  }else if(G.eventTimer>0)label(`${G.eventName} · ${Math.ceil(G.eventTimer)}s`,width/2,small?182:176,small?14:16,'#ffd58c','center');
  if(G.supplies.length)label(`补给 ${G.supplies.length} · ${G.bossesDefeated}/3 幕`,pad,height-(touchMode?230:80),small?14:15,'#ffd58c');
}
