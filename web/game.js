
'use strict';
const c=document.querySelector('#c'),ctx=c.getContext('2d'),stage=document.querySelector('#stage'),overlay=document.querySelector('#overlay'),panel=document.querySelector('#panel');
let W=1280,H=720;
const TAU=Math.PI*2,keys=new Set(),mouse={x:640,y:360,held:false};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),rand=(a,b)=>a+Math.random()*(b-a),dist2=(a,b)=>{const x=a.x-b.x,y=a.y-b.y;return x*x+y*y},norm=(x,y)=>{let d=Math.hypot(x,y)||1;return{x:x/d,y:y/d}},rgba=(hex,a)=>{let n=parseInt(hex.replace('#',''),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
const upgrades=SKILLS;
let G, state='menu',last=0,audio=null,choiceSet=[],shake=0,flash=0,deploymentButton=null;
function reset(){G={t:0,kills:0,lvl:1,xp:0,need:6,hp:100,maxhp:100,energy:50,px:0,py:0,aim:0,moveX:0,moveY:0,inv:0,dash:0,dashTime:0,dx:0,dy:0,shoot:0,spawn:.6,orbitTick:0,boss:false,uid:0,up:Object.fromEntries(upgrades.map(u=>[u.id,0])),enemies:[],shots:[],hostile:[],gems:[],fx:[],rings:[],beams:[],floaters:[],notice:'',noticeT:0,chainBudget:40,boost:0,shield:0,absorbed:0,dashCount:0,dashHits:0,overloads:0,bestBurst:0,lastBurst:0,burstT:0,hitStop:0,combo:0,comboT:0,missile:0,trail:[],muted:false};Object.assign(G,campaignState(),combatState(),arsenalState(),tacticsState());shake=flash=0;}
let muted=false,lastSounds={},compressor,master;
function sound(kind){if(muted)return;try{
 if(!audio){audio=new(window.AudioContext||window.webkitAudioContext)();compressor=audio.createDynamicsCompressor();master=audio.createGain();master.gain.value=.55;compressor.connect(master);master.connect(audio.destination)}
 if(audio.state==='suspended')audio.resume();const t=audio.currentTime;if(t-(lastSounds[kind]||-10)<({shoot:.065,collect:.045,hit:.065,chain:.09}[kind]||.04))return;lastSounds[kind]=t;
 const boom=kind==='boom',collect=kind==='collect',dashSound=kind==='dash',level=kind==='level';
 const duration=boom?.8:dashSound?.24:collect?.16:level?.5:.10;
 const osc=audio.createOscillator(),gain=audio.createGain();osc.type=collect||level?'sine':'triangle';let high=boom?100:collect?650+Math.min(G.combo,10)*60:dashSound?320:level?440:kind==='chain'?1400:220;osc.frequency.setValueAtTime(high,t);osc.frequency.exponentialRampToValueAtTime(boom?25:collect?high*2:level?880:45,t+duration);gain.gain.setValueAtTime(boom?.65:collect?.12:level?.2:.10,t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(gain);gain.connect(compressor);osc.start();osc.stop(t+duration);
 if(!collect&&!level){const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);const noise=audio.createBufferSource(),filter=audio.createBiquadFilter(),ng=audio.createGain();noise.buffer=buffer;filter.type=boom?'lowpass':'bandpass';filter.frequency.value=boom?650:dashSound?1800:kind==='chain'?3000:2400;ng.gain.setValueAtTime(boom?.65:dashSound?.25:.09,t);ng.gain.exponentialRampToValueAtTime(.001,t+duration);noise.connect(filter);filter.connect(ng);ng.connect(compressor);noise.start();noise.stop(t+duration)}
 }catch(e){console.warn('Audio unavailable',e.message)}}
function menu(title,subtitle,body,button,fn){
 state='paused';overlay.classList.remove('hidden');const deployment=title===SHOW.title;panel.className='panel'+(deployment?' deployment':'');
 panel.innerHTML=`<h1>${title}</h1>${deployment?'<div class="wordmark">OVERLOAD ZERO</div><div class="cast">'+portraitMarkup('ma')+'<small>自定义驾驶员</small></div>':''}<p class="sub">${subtitle}</p><div class="rules">${body}</div><button class="mainbtn" id="action">${button}</button><div class="micro">单局 12–15 分钟 · 自动射击 · 支持触屏</div>`;
 panel.querySelector('#action').onclick=fn;deploymentButton=deployment?panel.querySelector('#action'):null;refreshDeployment();refreshPortraitBadges();
}
function begin(){reset();clearInput();state='playing';overlay.classList.add('hidden');sound('level');for(let i=0;i<3;i++){let a=i*TAU/3;spawn('shooter',Math.cos(a)*410,Math.sin(a)*290)}notice('冲刺吸弹 · 贴身打断蓄力 · Q 超载',3)}
function intro(){themeIntro()}
function addFx(x,y,color,count=8,power=180){for(let i=0;i<count&&G.fx.length<650;i++){const a=rand(0,TAU),sp=rand(power*.16,power);G.fx.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:rand(.20,.58),max:.58,color,size:rand(2,5)})}}
function ring(x,y,r,color,d=.3){G.rings.push({x,y,r,t:d,max:d,color})}
function text(x,y,label,color='#a8d8f0'){if(G.floaters.length<70)G.floaters.push({x,y,label,color,t:.65})}
function notice(s,d=2){G.notice=s;G.noticeT=d}
function spawn(type,x,y){
 if(type!=='boss'&&G.enemies.length>=210)return null;
 const spec={runner:[32,124,17],shooter:[64,74,21],brute:[180,60,30],charger:[76,98,20],conductor:[145,58,25],shield:[160,70,27],sniper:[80,48,23],healer:[100,65,24],summoner:[135,50,26],clock:[90,95,23],printer:[165,46,27],box:[120,85,24],boss:[3600,65,48]}[type];
 const scale=type==='boss'?1:(1+G.t/310)*difficulty();
 const enemy={id:++G.uid,type,x,y,hp:spec[0]*scale,max:spec[0]*scale,speed:spec[1]*(G.difficulty==='hard'?1.12:1),r:spec[2],fire:rand(.6,1.5),hurt:0,live:true,spin:rand(0,TAU)};G.enemies.push(enemy);return enemy;
}
function hurtEnemy(e,damage,origin){if(!e.live)return;damage=extraEnemyDamage(e,damage,origin)*(e.recovery>0||e.stagger>0?1.25:1);e.hp-=damage;e.hurt=.13;if(e.hp>0)tacticalImpact(e,damage);if(damage>35&&Math.random()<.35)text(e.x,e.y-20,Math.round(damage));if(e.hp<=0){e.live=false;kill(e)}}
function kill(e){cancelEnemyPlans(e);G.kills++;cleanKillReward();G.combo++;G.comboT=1.6;if(G.combo%4===0)sound('chain');addFx(e.x,e.y,e.type==='boss'?'#bd84ff':'#ffba77',e.type==='boss'?70:12,e.type==='boss'?420:240);ring(e.x,e.y,e.type==='boss'?170:42,e.type==='boss'?'#bb88ff':'#fd8c9a',e.type==='boss'?.7:.28);if(e.type==='boss'){bossDefeated(e);return}if(e.elite)skillEffect('burst',e.x,e.y,120);if(G.gems.length<270)G.gems.push({x:e.x,y:e.y,value:e.elite?18:e.type==='brute'||e.type==='conductor'?4:e.type==='shooter'?2:1,spin:0});if(G.up.capacitor)G.energy=clamp(G.energy+G.up.capacitor*1.8,0,100);if(G.up.vamp&&G.kills%18===0){heal(4+G.up.vamp*3);text(G.px,G.py-42,'纳米修复','#6bf5bb')}
if(G.chainBudget>0&&G.up.chain){G.chainBudget--;let list=G.enemies.filter(n=>n.live&&dist2(n,e)<220**2).sort((a,b)=>dist2(a,e)-dist2(b,e));for(const other of list.slice(0,1+G.up.chain)){G.beams.push({x:e.x,y:e.y,xx:other.x,yy:other.y,t:.15});hurtEnemy(other,(20+12*G.up.chain)*musicPower()*(G.evolutions.storm?1.3:1))}}
if(G.chainBudget>0&&G.up.bomb){G.chainBudget--;let r=80+G.up.bomb*20;skillEffect('burst',e.x,e.y,r);ring(e.x,e.y,r,'#ffb86b');for(const other of G.enemies){if(other.live&&Math.hypot(other.x-e.x,other.y-e.y)<r+other.r)hurtEnemy(other,(18+14*G.up.bomb)*musicPower())}}
}

function fireShot(){
 const count=1+G.up.multi,damage=24*musicPower()*(G.boost>0?1.6:1)*(G.evolutions.chorus?1.4:1);
 for(let i=0;i<count;i++)addMusicShot(G.aim+(i-(count-1)/2)*.17+rand(-.02,.02),damage,G.up.pierce);
 if(G.evolutions.chorus)for(let i=-1;i<=1;i++)addMusicShot(G.aim+Math.PI+i*.22,damage*.7,G.up.pierce);
 sound('shoot')
}
function absorb(b){b.live=false;const wasReady=chargeReady();G.absorbed++;G.dashHits++;G.boost=2.0;G.shield=Math.min(75,G.shield+3);G.energy=clamp(G.energy+10*(1+.35*G.up.recycler),0,100);G.dash=Math.max(.18,G.dash-.10);G.inv=Math.max(G.inv,.28);addFx(b.x,b.y,'#80fcff',8,210);G.beams.push({x:b.x,y:b.y,xx:G.px,yy:G.py,t:.2});ring(b.x,b.y,38,'#82f5fd',.2);text(G.px,G.py-55,'吸收 · 反击超频','#78e6ff');sound('collect');if(!wasReady&&chargeReady()){notice('能量就绪 · Q 释放超载脉冲',2);sound('level')}if(navigator.vibrate&&G.dashHits%3===0)navigator.vibrate(12)}
function dash(){if(G.dash>0||G.dashTime>0)return;let n=norm(G.moveX,G.moveY);if(!G.moveX&&!G.moveY)n={x:Math.cos(G.aim),y:Math.sin(G.aim)};G.dashCount++;G.dashHits=0;G.dx=n.x;G.dy=n.y;G.dashTime=.23;G.dash=1.35*.85**G.up.dash*(G.evolutions.blade?.8:1);G.inv=Math.max(G.inv,.34);shake=4;skillEffect('slash',G.px,G.py,90,G.aim);addFx(G.px,G.py,'#70eaff',15,210);sound('dash')}
function overload(){if(!chargeReady()||state!=='playing')return;G.energy=0;if(G.evolutions.feedback){G.boost=4;G.shield=Math.min(75,G.shield+20)};G.overloads++;G.chainBudget=50;let before=G.kills,radius=420*(1+.23*G.up.blast),damage=180*(1+.25*G.up.blast)*musicPower();G.hitStop=.075;G.burstT=1.8;skillEffect('burst',G.px,G.py,radius*.65);skillEffect('sonic',G.px,G.py,radius);ring(G.px,G.py,radius,'#85e9ff',.75);ring(G.px,G.py,radius*.84,'#ffb85f',.65);addFx(G.px,G.py,'#ffbd6e',100,720);shake=19;flash=.75;for(const e of G.enemies){if(e.live&&Math.hypot(e.x-G.px,e.y-G.py)<radius+e.r){G.beams.push({x:G.px,y:G.py,xx:e.x,yy:e.y,t:.45});hurtEnemy(e,damage)}}for(const b of G.hostile)if(b.live&&Math.hypot(b.x-G.px,b.y-G.py)<radius*1.2)b.live=false;G.lastBurst=G.kills-before;G.bestBurst=Math.max(G.bestBurst,G.lastBurst);notice('超载脉冲 · '+G.lastBurst+' 击破',1.8);sound('boom');if(navigator.vibrate)navigator.vibrate([30,30,60])}
function damagePlayer(d){if(G.inv>0||state!=='playing')return;d*=difficulty();const blocked=Math.min(G.shield,d);G.shield-=blocked;d-=blocked;G.hp=Math.max(0,G.hp-d);G.damageTaken+=d;if(d>0)G.cleanKills=0;G.inv=.65;flash=.24;shake=9;addFx(G.px,G.py,'#ff7285',9,200);text(G.px,G.py-33,`-${Math.round(d)}`,'#ff7085');sound('hurt');if(G.hp<=0)end(false)}
function chooseUp(){offerUpgrade()}
function pick(i){takeChoice(i)}
function levelUp(){if(state!=='playing'||G.xp<G.need)return;G.xp-=G.need;G.lvl++;G.need=8+G.lvl*6;heal(2);chooseUp()}
function end(win){themeEnd(win)}
function update(dt){if(state!=='playing')return;dt=Math.min(dt,.045);if(G.hitStop>0){G.hitStop-=dt;return}G.t+=dt;G.chainBudget=40;G.boost=Math.max(0,G.boost-dt);G.comboT=Math.max(0,G.comboT-dt);if(!G.comboT)G.combo=0;G.burstT=Math.max(0,G.burstT-dt);G.missile-=dt;G.inv=Math.max(0,G.inv-dt);G.dash=Math.max(0,G.dash-dt);G.dashTime=Math.max(0,G.dashTime-dt);G.shoot-=dt;G.spawn-=dt;G.orbitTick-=dt;G.noticeT=Math.max(0,G.noticeT-dt);shake=Math.max(0,shake-22*dt);flash=Math.max(0,flash-2.7*dt);campaignTick(dt);if(state!=='playing')return;
const dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));const dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));const n=norm(dx,dy);G.moveX=touch.x||((dx||dy)?n.x:0);G.moveY=touch.y||((dx||dy)?n.y:0);
const previousX=G.px,previousY=G.py;
let target=null,best=1e10;for(const e of G.enemies){if(!e.live)continue;let d=dist2(e,{x:G.px,y:G.py});if(d<best){best=d;target=e}}if(target)G.aim=Math.atan2(target.y-G.py,target.x-G.px);if(mouse.held){let mx=mouse.x-W/2,my=mouse.y-H/2;if(Math.hypot(mx,my)>22)G.aim=Math.atan2(my,mx)}
if(keys.has(' ')&&G.dash<=0)dash();if(keys.has('q')&&chargeReady())overload();
if(G.dashTime>0){G.px+=G.dx*790*(1+.10*G.up.dash)*dt;G.py+=G.dy*790*(1+.10*G.up.dash)*dt;if(Math.random()<.85)addFx(G.px,G.py,'#80efff',2,120)}else{G.px+=G.moveX*282*(G.slowTimer>0?.7:1)*(G.breakTime>0?1.15:1)*dt;G.py+=G.moveY*282*(G.slowTimer>0?.7:1)*(G.breakTime>0?1.15:1)*dt}G.px=clamp(G.px,-1480,1480);G.py=clamp(G.py,-1070,1070);G.pvx=(G.px-previousX)/(dt||1);G.pvy=(G.py-previousY)/(dt||1);
if(G.shoot<=0&&best<900**2){fireShot();G.shoot=.26/(1+.22*G.up.rapid)/(G.boost>0?1.8:1)/(1+.15*G.surge)}
if(G.spawn<=0&&G.enemies.length<210)spawnCampaignWave();
for(const e of G.enemies){
 if(!e.live)continue;e.hurt=Math.max(0,e.hurt-dt);e.spin+=dt*2;e.fire-=dt;updateEnemyStage(e,dt);e.slow=Math.max(0,(e.slow||0)-dt);
 const velocity=tacticalVelocity(e);if(!e.moveLock){e.x=clamp(e.x+velocity.x*e.speed*dt*(e.slow>0?.45:1),-1450,1450);e.y=clamp(e.y+velocity.y*e.speed*dt*(e.slow>0?.45:1),-1050,1050)}
 const nx=G.px-e.x,ny=G.py-e.y,d=Math.hypot(nx,ny)||1;
 if(e.fire<=0&&d<710&&!(e.stagger>0)&&!(e.recovery>0)&&!isEnemyCasting(e)&&!e.commandedBy){
   if(e.type==='shooter'){const point=predictPlayer(e,210,.35),angle=Math.atan2(point.y-e.y,point.x-e.x);for(let j=-1;j<=1;j++){const a=angle+j*.18;hostileBullet(e.x,e.y,Math.cos(a),Math.sin(a),210,10)}e.fire=rand(1.6,2.2)}
   else if(['sniper','healer','summoner','printer','clock'].includes(e.type))supportAttack(e);
   else if(e.type==='conductor')conductorAttack(e);else if(e.type==='boss')bossAttack(e);
 }
 if(d<e.r+18&&G.dashTime<=0&&!(e.stagger>0))damagePlayer(e.type==='boss'?17:10);
}
if(G.up.damage&&G.missile<=0&&target){G.missile=1.8;for(let j=0;j<G.up.damage;j++)G.shots.push({x:G.px,y:G.py,vx:Math.cos(G.aim+j*.3)*350,vy:Math.sin(G.aim+j*.3)*350,t:3.0,pierce:0,hit:new Set(),damage:65*musicPower(),missile:true})}
for(const b of G.shots){if(b.missile&&target){const a=Math.atan2(target.y-b.y,target.x-b.x);b.vx+=(Math.cos(a)*580-b.vx)*Math.min(1,dt*5);b.vy+=(Math.sin(a)*580-b.vy)*Math.min(1,dt*5)}b.x+=b.vx*dt;b.y+=b.vy*dt;b.t-=dt;for(const e of G.enemies){if(!e.live||b.t<=0||b.hit.has(e.id))continue;if(Math.hypot(b.x-e.x,b.y-e.y)<e.r+5){b.hit.add(e.id);if(b.missile){skillEffect('burst',b.x,b.y,95);ring(b.x,b.y,110,'#ffba69',.35);addFx(b.x,b.y,'#ffab54',20,260);for(const other of G.enemies)if(other.live&&other!==e&&dist2(other,b)<110**2)hurtEnemy(other,40*musicPower());sound('chain')}if(G.up.pierce)e.slow=1.4;hurtEnemy(e,b.damage,{x:b.x-b.vx*.45,y:b.y-b.vy*.45});sound('hit');addFx(b.x,b.y,'#ffbc81',4,165);if(b.disc){if(bounceDisc(b,e))break;b.t=-1}else{b.pierce--;if(b.pierce<0)b.t=-1}}}}
for(const b of G.hostile){if(!b.live)continue;b.x+=b.vx*dt;b.y+=b.vy*dt;b.t-=dt;if(b.t<=0){b.live=false;continue}let d2=(b.x-G.px)**2+(b.y-G.py)**2;if(G.dashTime>0&&d2<100**2)absorb(b);else if(d2<(b.r+17)**2){b.live=false;const couldHit=G.inv<=0;damagePlayer(b.damage);if(couldHit&&b.slow)G.slowTimer=Math.max(G.slowTimer,b.slow)}}
if(G.up.orbit&&G.orbitTick<=0){G.orbitTick=.18;for(let j=0;j<G.up.orbit+1;j++){let a=G.t*3.2+j*TAU/(G.up.orbit+1),x=G.px+Math.cos(a)*(G.evolutions.blade?G.dashTime>0?165:118:G.dashTime>0?130:90),y=G.py+Math.sin(a)*(G.evolutions.blade?G.dashTime>0?165:118:G.dashTime>0?130:90);for(const e of G.enemies)if(e.live&&Math.hypot(e.x-x,e.y-y)<e.r+14)hurtEnemy(e,(10+G.up.orbit*2)*musicPower()*(G.evolutions.blade?2:1))}}
for(const g of G.gems){g.spin+=dt*3;let x=G.px-g.x,y=G.py-g.y,d=Math.hypot(x,y);if(d<145+85*G.up.magnet&&d>1){g.x+=x/d*(490-d*.6)*dt;g.y+=y/d*(490-d*.6)*dt}if(d<26){g.taken=true;G.xp+=g.value;if(Math.random()<.2)sound('collect')}}
G.enemies=G.enemies.filter(e=>e.live);G.shots=G.shots.filter(b=>b.t>0);G.hostile=G.hostile.filter(b=>b.live);G.gems=G.gems.filter(g=>!g.taken);
for(const p of G.fx){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=1-3*dt;p.vy*=1-3*dt}G.fx=G.fx.filter(p=>p.t>0);
for(const r of G.rings)r.t-=dt;G.rings=G.rings.filter(r=>r.t>0);for(const b of G.beams)b.t-=dt;G.beams=G.beams.filter(b=>b.t>0);for(const f of G.floaters){f.t-=dt;f.y-=dt*40}G.floaters=G.floaters.filter(f=>f.t>0);
if(G.xp>=G.need)levelUp();
}
function hostileBullet(x,y,dx,dy,speed,damage){if(G.hostile.length>=520)return null;const bullet={x:x+dx*22,y:y+dy*22,vx:dx*speed,vy:dy*speed,r:damage>12?9:7,damage,t:5.6,live:true};G.hostile.push(bullet);return bullet}
function rect(x,y,w,h,color,border){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);if(border){ctx.strokeStyle=border;ctx.strokeRect(x,y,w,h)}}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,TAU);ctx.fill()}
function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fill()}
function arc(x,y,r,color,width=3,a=0,b=TAU){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,a,b);ctx.stroke()}
function label(txt,x,y,size,color='#d6ecfa',align='left',weight=600){ctx.fillStyle=color;ctx.font=`${weight} ${size}px 'Microsoft YaHei', system-ui, sans-serif`;ctx.textAlign=align;ctx.fillText(txt,x,y)}
function bar(x,y,w,h,value,color){rect(x,y,w,h,'#102431');rect(x,y,w*clamp(value,0,1),h,color);ctx.strokeStyle='#31576a';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h)}
function draw(){rect(0,0,W,H,'#050b14');if(!G)return;if(floor.complete&&floor.naturalWidth){ctx.drawImage(floor,-W*.035-G.px*.018,-H*.035-G.py*.018,W*1.07,H*1.07)}ctx.save();ctx.translate(W/2-G.px+(Math.random()-.5)*(reducedMotion?0:shake)*2,H/2-G.py+(Math.random()-.5)*(reducedMotion?0:shake)*2);
ctx.strokeStyle='#78b7d00c';ctx.lineWidth=1;for(let x=-1500;x<=1500;x+=180){ctx.beginPath();ctx.moveTo(x,-1100);ctx.lineTo(x,1100);ctx.stroke()}for(let y=-1100;y<=1100;y+=180){ctx.beginPath();ctx.moveTo(-1500,y);ctx.lineTo(1500,y);ctx.stroke()}ctx.strokeStyle='#78e6ff66';ctx.lineWidth=5;ctx.strokeRect(-1500,-1100,3000,2200);
drawSkillEffects();drawStageWorld();drawTacticalLinks();
for(const g of G.gems){circle(g.x,g.y,15,'#4affd020');let s=9+Math.sin(g.spin)*2;polygon([[g.x,g.y-s],[g.x+s*.75,g.y],[g.x,g.y+s],[g.x-s*.75,g.y]],g.value>1?'#c49eff':'#79ffd1')}
for(const e of G.enemies){drawEnemyDetails(e);let col={runner:'#fd6280',shooter:'#c68cff',brute:'#ffb260',boss:'#f26d9e',charger:'#ffcb7b',conductor:'#906d96',shield:'#418f9c',sniper:'#d15d4e',healer:'#d983a3',summoner:'#a78240',clock:'#c69339',printer:'#b6574c',box:'#a67b49'}[e.type];circle(e.x,e.y+e.r*.4,e.r,'#0007');sprite(e.type,e.x,e.y,e.r*3.3,Math.atan2(G.py-e.y,G.px-e.x),e.hurt>0,e.chapter||0);if(e.elite)arc(e.x,e.y,e.r+9,'#ffda7e',3);if(e.chargeWarning>0){ctx.strokeStyle='#ffbfa6';ctx.lineWidth=3;ctx.setLineDash([12,8]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(e.chargeAngle)*330,e.y+Math.sin(e.chargeAngle)*330);ctx.stroke();ctx.setLineDash([])}if(e.slow>0)arc(e.x,e.y,e.r+5,'#98eaff',2);if(e.type!=='runner'&&e.type!=='boss')bar(e.x-e.r,e.y-e.r-18,e.r*2,4,e.hp/e.max,col)}
for(const b of G.shots){if(b.disc){drawDiscShot(b);continue}let a=Math.atan2(b.vy,b.vx);ctx.strokeStyle=b.missile?'#ff8a42':G.up.pierce?'#bdc2ff':'#78e6ff';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(b.x-Math.cos(a)*19,b.y-Math.sin(a)*19);ctx.lineTo(b.x+Math.cos(a)*8,b.y+Math.sin(a)*8);ctx.stroke();circle(b.x,b.y,4,'#fff')}
for(const b of G.hostile){if(drawMachineProjectile(b))continue;circle(b.x,b.y,b.r*2.2,'#ff4bad1a');arc(b.x,b.y,b.r,'#ff66ba',2.5);circle(b.x,b.y,b.r*.35,'#ffe2f4')}
let px=G.px,py=G.py;circle(px,py,37,'#42d9ff22');if(chargeReady())arc(px,py,45,'#c7ffdd',3);if(G.shield>0)arc(px,py,40,'#81e8ff',2);if(G.dashTime>0){G.trail.push({x:px,y:py,t:.18});arc(px,py,100,'#93f4ff55',2)}for(const t of G.trail){t.t-=.016;circle(t.x,t.y,24,rgba('#70eeff',Math.max(0,t.t)*1.2))}G.trail=G.trail.filter(t=>t.t>0);sprite('player',px,py,104,G.aim,G.inv>0&&Math.floor(G.t*18)%2);label('驾驶员',px,py-61,14,'#9ceaff','center');if(G.breakTime>0)label('自律超频',px,py-104,18,'#7df3bf','center');if(G.slowTimer>0)label('干扰命中 · 减速',px,py+60,16,'#ffc66e','center');if(G.boost>0){arc(px,py,49,'#6bffff',3,G.t*5,G.t*5+4);label('反击超频',px,py-82,16,'#a1ffff','center')}
for(let j=0;j<G.up.orbit+1&&G.up.orbit;j++){let a=G.t*3.2+j*TAU/(G.up.orbit+1),x=px+Math.cos(a)*(G.evolutions.blade?G.dashTime>0?165:118:G.dashTime>0?130:90),y=py+Math.sin(a)*(G.evolutions.blade?G.dashTime>0?165:118:G.dashTime>0?130:90);circle(x,y,20,'#59c9ff35');polygon([[x,y-20],[x+11,y],[x,y+20],[x-11,y]],'#81d8ff')}
for(const r of G.rings){let phase=1-r.t/r.max;arc(r.x,r.y,r.r*phase,rgba(r.color,(1-phase)*.88),5)}for(const b of G.beams){ctx.strokeStyle=rgba(b.color||'#4397a9',Math.max(0,b.t/.15));ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(b.x,b.y);const vx=b.xx-b.x,vy=b.yy-b.y;for(let i=1;i<7;i++){const jitter=Math.sin(i*11.7+b.t*20)*15;ctx.lineTo(b.x+vx*i/7-vy/(Math.hypot(vx,vy)||1)*jitter,b.y+vy*i/7+vx/(Math.hypot(vx,vy)||1)*jitter)}ctx.lineTo(b.xx,b.yy);ctx.shadowColor='#50dfff';ctx.shadowBlur=12;ctx.stroke();ctx.shadowBlur=0}for(const p of G.fx)circle(p.x,p.y,p.size*p.t/p.max,rgba(p.color,clamp(p.t/p.max,0,1)));for(const f of G.floaters)label(f.label,f.x,f.y,20,rgba(f.color,f.t/.65),'center');ctx.restore();
// Compact stable HUD, sized for portrait and landscape.
const hudScale=W<900?1.4:1;ctx.save();ctx.scale(hudScale,hudScale);(function drawHud(W,H){
const small=W<900,pad=small?14:26,hudW=small?W*.38:280;
const timerWidth=small?84:160;rect(W/2-timerWidth/2,20,timerWidth,48,'#061523ed','#24475a');
if(!small&&!touchMode){rect(pad-8,H-68,228,62,'#061523e8','#31576a');rect(W-pad-260,H-68,268,62,'#061523e8','#31576a')}
const hasBuild=upgrades.some(u=>G.up[u.id]),railWidth=Math.min(W-pad*2,hasBuild?(touchMode?460:570):320);rect(W/2-railWidth/2,H-(touchMode?(hasBuild?245:215):(hasBuild?83:77)),railWidth,hasBuild?(touchMode?78:74):(touchMode?39:34),'#061523d9');
rect(pad,20,hudW,91,'#071625eb','#31576a');label('生命',pad+12,44,15,'#c6dae8');bar(pad+60,31,hudW-76,12,G.hp/G.maxhp,'#ec5363');label('能量',pad+12,73,15,'#78e6ff');bar(pad+60,60,hudW-76,12,G.energy/resonanceCost(),chargeReady()?'#eaffac':'#65e5f9');label(`HP ${Math.ceil(G.hp)} · 护盾 ${Math.round(G.shield)} · LV ${G.lvl}`,pad+12,98,13,'#a3bfd0');
label(`${String(Math.floor(G.t/60)).padStart(2,'0')}:${String(Math.floor(G.t%60)).padStart(2,'0')}`,W/2,51,small?27:32,'#e7f5ff','center',800);label(`${G.kills} 击破`,W-pad,48,small?21:25,'#c0e9ff','right');label(G.bossActive?'敌方主核 · 作战中':`下场 ${timeLabel(Math.max(0,(SHOW.bosses[G.bossIndex]?.at||900)-G.t))}`,W-pad,76,small?12:14,'#9ab6c9','right');bar(pad,121,W-pad*2,4,G.xp/G.need,'#c2a0fa');
if(!small&&!touchMode){label('SPACE / 冲刺吸弹',pad,H-44,17,'#bdd4e3');label(G.dash>0?G.dash.toFixed(1)+'s':'就绪',pad,H-22,15,G.dash?'#829db2':'#78e6ff');label('Q / 超载脉冲',W-pad,H-44,17,'#bdd4e3','right');label(chargeReady()?'就绪 · 突入后释放':'吸弹充能',W-pad,H-22,15,'#78e6ff','right')}
const build=upgrades.filter(u=>G.up[u.id]).map(u=>u.name+(G.up[u.id]>1?' ×'+G.up[u.id]:'')).join(' / ');if(build)label(build.length>45?build.slice(0,45)+'…':build,W/2,H-(touchMode?220:28),small?15:16,'#b0c9d9','center');
drawStageHud(W,H,small,pad);label(G.breakCooldown>0?'超频奖励冷却 '+Math.ceil(G.breakCooldown)+'s':'无伤歼灭 '+G.cleanKills+'/20 · 自律超频',W/2,H-(touchMode?190:57),small?13:14,'#8acbc9','center');
if(G.combo>=3&&G.comboT>0)label(`${G.combo} 连锁`,W-pad,125,small?22:30,'#ffc66e','right',900);
if(G.noticeT>0){ctx.shadowColor='#4cecff';ctx.shadowBlur=12;label(G.notice,W/2,G.bossActive?270:small?245:225,small?23:27,rgba('#b8edff',Math.min(1,G.noticeT/.28)),'center');ctx.shadowBlur=0}if(flash>0&&!reducedMotion)rect(0,0,W,H,`rgba(170,235,255,${flash*.22})`);
})(W/hudScale,H/hudScale);ctx.restore();syncControls();
}

function frame(ts){let dt=last?(ts-last)/1000:0;last=ts;update(dt);draw();requestAnimationFrame(frame)}
const touch={x:0,y:0,id:null};
const touchMode=window.matchMedia?.('(pointer: coarse)').matches||false;
const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
const enemyAtlas=new Image();enemyAtlas.src='assets/machine-enemies.png';const bossAtlas=new Image();bossAtlas.src='assets/machine-bosses.png';const bodyAtlas=new Image();bodyAtlas.src='assets/pilot.png';const effectAtlas=new Image();effectAtlas.src='assets/plasma-fx.png';const floor=new Image();floor.src='assets/reactor-deck.png';const systemAtlas=new Image();systemAtlas.src='assets/systems.png';
const artImages=[enemyAtlas,bossAtlas,bodyAtlas,effectAtlas,floor,systemAtlas],failedArt=new Set();
function refreshDeployment(){
 if(!deploymentButton?.isConnected)return;
 const pending=artImages.some(img=>!img.complete||!img.naturalWidth);
 deploymentButton.disabled=pending&&!failedArt.size;
 deploymentButton.textContent=failedArt.size?'重试加载素材':pending?'素材加载中…':'部署出击';
 deploymentButton.onclick=failedArt.size?()=>{const retry=[...failedArt];failedArt.clear();for(const img of retry)img.src=img.src.split('?')[0]+'?retry='+Date.now();refreshDeployment()}:begin;
}
for(const img of artImages){img.onload=()=>{failedArt.delete(img);refreshDeployment()};img.onerror=()=>{failedArt.add(img);refreshDeployment()}}
function sprite(type,x,y,size,angle,hit,chapter=0){
 if(type==='player'){drawPilot(type,x,y,size,angle,hit);return}
 if(type==='boss'){drawMachineBoss(x,y,size,angle,hit,chapter);return}
 const cell={runner:[0,0],shooter:[1,0],brute:[2,0],charger:[3,0],conductor:[0,1],shield:[1,1],sniper:[2,1],healer:[3,1],summoner:[0,2],clock:[1,2],printer:[2,2],box:[3,2]}[type];
 if(!cell||!enemyAtlas.complete||!enemyAtlas.naturalWidth)return;
 const sw=enemyAtlas.naturalWidth/4,sh=enemyAtlas.naturalHeight/3;ctx.save();ctx.translate(x,y);ctx.rotate(angle*.08);if(hit)ctx.globalAlpha=.65;
 ctx.drawImage(enemyAtlas,cell[0]*sw,cell[1]*sh,sw,sh,-size/2,-size/2,size,size);ctx.restore();
}
function resize(){const r=stage.getBoundingClientRect();W=r.width/r.height<.9?720:1280;H=Math.round(W*r.height/r.width);c.width=W;c.height=H;clearInput()}
function clearInput(){keys.clear();mouse.held=false;touch.x=touch.y=0;touch.id=null;document.querySelector('#stick-knob').style.transform='translate(-50%,-50%)'}
function pause(){themePause()}
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();if(k==='escape'){pause();return}if(state==='paused'&&choiceSet.length&&['1','2','3'].includes(k)&&panel.querySelector('.choices')){pick(Number(k)-1);return}if(state==='playing'&&!e.repeat){if(k===' ')dash();if(k==='q')overload();if(k==='e')openSupply()}keys.add(k)},{passive:false});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
function mouseUpdate(e){const r=c.getBoundingClientRect();mouse.x=(e.clientX-r.left)*W/r.width;mouse.y=(e.clientY-r.top)*H/r.height}c.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')mouseUpdate(e)});c.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){mouseUpdate(e);mouse.held=true}});window.addEventListener('pointerup',()=>mouse.held=false);
const stick=document.querySelector('#stick'),knob=document.querySelector('#stick-knob');
function moveStick(e){const r=stick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,max=r.width*.32,length=Math.hypot(x,y),scale=length>max?max/length:1;touch.x=length<6?0:x*scale/max;touch.y=length<6?0:y*scale/max;knob.style.transform=`translate(calc(-50% + ${x*scale}px),calc(-50% + ${y*scale}px))`}
stick.addEventListener('pointerdown',e=>{e.preventDefault();if(touch.id!==null||state!=='playing')return;touch.id=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e)});stick.addEventListener('pointermove',e=>{if(e.pointerId===touch.id)moveStick(e)});for(const name of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(name,e=>{if(e.pointerId===touch.id){touch.x=touch.y=0;touch.id=null;knob.style.transform='translate(-50%,-50%)'}});
for(const [id,fn] of [['dash-btn',dash],['overload-btn',overload]])document.querySelector('#'+id).addEventListener('pointerdown',e=>{e.preventDefault();if(state==='playing')fn()});
document.querySelector('#supply-btn').onclick=openSupply;document.querySelector('#pause-btn').onclick=pause;document.querySelector('#sound-btn').onclick=()=>{muted=!muted;document.querySelector('#sound-btn').textContent=muted?'声音：关':'声音：开';if(!muted)sound('collect')};
function syncControls(){const d=document.querySelector('#dash-btn'),o=document.querySelector('#overload-btn');d.classList.toggle('ready',G.dash<=0);d.querySelector('small').textContent=G.dash>0?G.dash.toFixed(1)+'s':'冲刺';o.classList.toggle('ready',chargeReady());o.querySelector('small').textContent=chargeReady()?'超载就绪':Math.floor(G.energy)+'%';d.setAttribute('aria-disabled',String(G.dash>0));o.setAttribute('aria-disabled',String(!chargeReady()));document.querySelector('#controls').hidden=state!=='playing';const supply=document.querySelector('#supply-btn');supply.hidden=state!=='playing'||!nearSupply();supply.textContent='领取补给 E'}
window.addEventListener('resize',resize);reset();resize();initPortraits();intro();requestAnimationFrame(frame);
