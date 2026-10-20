
'use strict';
const c=document.querySelector('#c'),ctx=c.getContext('2d'),stage=document.querySelector('#stage'),overlay=document.querySelector('#overlay'),panel=document.querySelector('#panel');
let W=1280,H=720;
const TAU=Math.PI*2,keys=new Set(),mouse={x:640,y:360,held:false};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),rand=(a,b)=>a+Math.random()*(b-a),dist2=(a,b)=>{const x=a.x-b.x,y=a.y-b.y;return x*x+y*y},norm=(x,y)=>{let d=Math.hypot(x,y)||1;return{x:x/d,y:y/d}},rgba=(hex,a)=>{let n=parseInt(hex.replace('#',''),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
const upgrades=SKILLS;
let G, state='menu',last=0,audio=null,choiceSet=[],shake=0,flash=0;
function reset(){G={t:0,kills:0,lvl:1,xp:0,need:6,hp:100,maxhp:100,energy:50,px:0,py:0,aim:0,moveX:0,moveY:0,inv:0,dash:0,dashTime:0,dx:0,dy:0,shoot:0,spawn:.6,orbitTick:0,boss:false,uid:0,up:Object.fromEntries(upgrades.map(u=>[u.id,0])),enemies:[],shots:[],hostile:[],gems:[],fx:[],rings:[],beams:[],floaters:[],notice:'',noticeT:0,chainBudget:40,boost:0,shield:0,absorbed:0,dashCount:0,dashHits:0,overloads:0,bestBurst:0,lastBurst:0,burstT:0,hitStop:0,combo:0,comboT:0,missile:0,trail:[],muted:false};Object.assign(G,campaignState());shake=flash=0;}
let muted=false,lastSounds={},compressor,master;
function sound(kind){if(muted)return;try{
 if(!audio){audio=new(window.AudioContext||window.webkitAudioContext)();compressor=audio.createDynamicsCompressor();master=audio.createGain();master.gain.value=.55;compressor.connect(master);master.connect(audio.destination)}
 if(audio.state==='suspended')audio.resume();const t=audio.currentTime;if(t-(lastSounds[kind]||-10)<({shoot:.065,collect:.045,hit:.065,chain:.09}[kind]||.04))return;lastSounds[kind]=t;
 const boom=kind==='boom',collect=kind==='collect',dashSound=kind==='dash',level=kind==='level';
 const duration=boom?.8:dashSound?.24:collect?.16:level?.5:.10;
 const osc=audio.createOscillator(),gain=audio.createGain();osc.type=collect||level?'sine':'triangle';let high=boom?100:collect?650+Math.min(G.combo,10)*60:dashSound?320:level?440:kind==='chain'?1400:220;osc.frequency.setValueAtTime(high,t);osc.frequency.exponentialRampToValueAtTime(boom?25:collect?high*2:level?880:45,t+duration);gain.gain.setValueAtTime(boom?.65:collect?.12:level?.2:.10,t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);osc.connect(gain);gain.connect(compressor);osc.start();osc.stop(t+duration);
 if(!collect&&!level){const buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);const noise=audio.createBufferSource(),filter=audio.createBiquadFilter(),ng=audio.createGain();noise.buffer=buffer;filter.type=boom?'lowpass':'bandpass';filter.frequency.value=boom?650:dashSound?1800:kind==='chain'?3000:2400;ng.gain.setValueAtTime(boom?.65:dashSound?.25:.09,t);ng.gain.exponentialRampToValueAtTime(.001,t+duration);noise.connect(filter);filter.connect(ng);ng.connect(compressor);noise.start();noise.stop(t+duration)}
 }catch(e){console.warn('Audio unavailable',e.message)}}
function menu(title,subtitle,body,button,fn){state='paused';overlay.classList.remove('hidden');panel.innerHTML=`<div class="wordmark">STAGE / DUEL</div><h1>${title===SHOW.title?'<span class="title-line">马嘉祺大战</span><span class="title-line">我哥哥丁程鑫</span>':title}</h1><div class="cast" aria-hidden="true"><div></div><span>VS</span><div></div></div><p class="sub">${subtitle}</p><div class="rules">${body}</div><button class="mainbtn" id="action">${button}</button><div class="micro">非官方同人 · 舞台幻想对决 · 建议佩戴耳机</div>`;panel.querySelector('#action').onclick=fn}
function begin(){reset();clearInput();state='playing';overlay.classList.add('hidden');sound('level');for(let i=0;i<3;i++){let a=i*TAU/3;spawn('shooter',Math.cos(a)*410,Math.sin(a)*290)}notice('马嘉祺登场 · 冲刺吸弹，蓄满全场共鸣',3)}
function intro(){themeIntro()}
function addFx(x,y,color,count=8,power=180){for(let i=0;i<count&&G.fx.length<650;i++){const a=rand(0,TAU),sp=rand(power*.16,power);G.fx.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:rand(.20,.58),max:.58,color,size:rand(2,5)})}}
function ring(x,y,r,color,d=.3){G.rings.push({x,y,r,t:d,max:d,color})}
function text(x,y,label,color='#ffeea6'){if(G.floaters.length<70)G.floaters.push({x,y,label,color,t:.65})}
function notice(s,d=2){G.notice=s;G.noticeT=d}
function spawn(type,x,y){
 if(type!=='boss'&&G.enemies.length>=210)return null;
 const spec={runner:[32,124,17],shooter:[64,74,21],brute:[180,60,30],charger:[76,98,20],conductor:[145,58,25],boss:[3600,65,48]}[type];
 const scale=type==='boss'?1:(1+G.t/310)*difficulty();
 const enemy={id:++G.uid,type,x,y,hp:spec[0]*scale,max:spec[0]*scale,speed:spec[1]*(G.difficulty==='hard'?1.12:1),r:spec[2],fire:rand(.6,1.5),hurt:0,live:true,spin:rand(0,TAU)};G.enemies.push(enemy);return enemy;
}
function hurtEnemy(e,damage){if(!e.live)return;e.hp-=damage;e.hurt=.13;if(damage>35&&Math.random()<.35)text(e.x,e.y-20,Math.round(damage));if(e.hp<=0){e.live=false;kill(e)}}
function kill(e){G.kills++;G.combo++;G.comboT=1.6;if(G.combo%4===0)sound('chain');addFx(e.x,e.y,e.type==='boss'?'#bd84ff':'#ffba77',e.type==='boss'?70:12,e.type==='boss'?420:240);ring(e.x,e.y,e.type==='boss'?170:42,e.type==='boss'?'#bb88ff':'#fd8c9a',e.type==='boss'?.7:.28);if(e.type==='boss'){bossDefeated(e);return}if(G.gems.length<270)G.gems.push({x:e.x,y:e.y,value:e.elite?18:e.type==='brute'||e.type==='conductor'?4:e.type==='shooter'?2:1,spin:0});if(G.up.capacitor)G.energy=clamp(G.energy+G.up.capacitor*1.8,0,100);if(G.up.vamp&&G.kills%18===0){heal(4+G.up.vamp*3);text(G.px,G.py-42,'返场修复','#9dffc3')}
if(G.chainBudget>0&&G.up.chain){G.chainBudget--;let list=G.enemies.filter(n=>n.live&&dist2(n,e)<220**2).sort((a,b)=>dist2(a,e)-dist2(b,e));for(const other of list.slice(0,1+G.up.chain)){G.beams.push({x:e.x,y:e.y,xx:other.x,yy:other.y,t:.15});hurtEnemy(other,(20+12*G.up.chain)*musicPower()*(G.evolutions.storm?1.3:1))}}
if(G.chainBudget>0&&G.up.bomb){G.chainBudget--;let r=80+G.up.bomb*20;ring(e.x,e.y,r,'#ffb86b');for(const other of G.enemies){if(other.live&&Math.hypot(other.x-e.x,other.y-e.y)<r+other.r)hurtEnemy(other,(18+14*G.up.bomb)*musicPower())}}
}

function fireShot(){
 const count=1+G.up.multi,damage=24*musicPower()*(G.boost>0?1.6:1)*(G.evolutions.chorus?1.4:1);
 for(let i=0;i<count;i++)addMusicShot(G.aim+(i-(count-1)/2)*.17+rand(-.02,.02),damage,G.up.pierce);
 if(G.evolutions.chorus)for(let i=-1;i<=1;i++)addMusicShot(G.aim+Math.PI+i*.22,damage*.7,G.up.pierce);
 sound('shoot')
}
function absorb(b){b.live=false;const wasReady=chargeReady();G.absorbed++;G.dashHits++;G.boost=2.0;G.shield=Math.min(75,G.shield+3);G.energy=clamp(G.energy+10*(1+.35*G.up.recycler),0,100);G.dash=Math.max(.18,G.dash-.10);G.inv=Math.max(G.inv,.28);addFx(b.x,b.y,'#80fcff',8,210);G.beams.push({x:b.x,y:b.y,xx:G.px,yy:G.py,t:.2});ring(b.x,b.y,38,'#82f5fd',.2);text(G.px,G.py-55,'吸收 · 反击超频','#8fffff');sound('collect');if(!wasReady&&chargeReady()){notice('共鸣就绪 · Q 释放全场共鸣',2);sound('level')}if(navigator.vibrate&&G.dashHits%3===0)navigator.vibrate(12)}
function dash(){if(G.dash>0||G.dashTime>0)return;let n=norm(G.moveX,G.moveY);if(!G.moveX&&!G.moveY)n={x:Math.cos(G.aim),y:Math.sin(G.aim)};G.dashCount++;G.dashHits=0;G.dx=n.x;G.dy=n.y;G.dashTime=.23;G.dash=1.35*.85**G.up.dash*(G.evolutions.blade?.8:1);G.inv=Math.max(G.inv,.34);shake=4;addFx(G.px,G.py,'#70eaff',15,210);sound('dash')}
function overload(){if(!chargeReady()||state!=='playing')return;G.energy=0;if(G.evolutions.encore){G.boost=4;G.shield=Math.min(75,G.shield+20)};G.overloads++;G.chainBudget=50;let before=G.kills,radius=420*(1+.23*G.up.blast),damage=180*(1+.25*G.up.blast)*musicPower();G.hitStop=.075;G.burstT=1.8;ring(G.px,G.py,radius,'#85e9ff',.75);ring(G.px,G.py,radius*.84,'#ffb85f',.65);addFx(G.px,G.py,'#ffbd6e',100,720);shake=19;flash=.75;for(const e of G.enemies){if(e.live&&Math.hypot(e.x-G.px,e.y-G.py)<radius+e.r){G.beams.push({x:G.px,y:G.py,xx:e.x,yy:e.y,t:.45});hurtEnemy(e,damage)}}for(const b of G.hostile)if(b.live&&Math.hypot(b.x-G.px,b.y-G.py)<radius*1.2)b.live=false;G.lastBurst=G.kills-before;G.bestBurst=Math.max(G.bestBurst,G.lastBurst);notice('全场共鸣 · '+G.lastBurst+' 击破',1.8);sound('boom');if(navigator.vibrate)navigator.vibrate([30,30,60])}
function damagePlayer(d){if(G.inv>0||state!=='playing')return;d*=difficulty();const blocked=Math.min(G.shield,d);G.shield-=blocked;d-=blocked;G.hp=Math.max(0,G.hp-d);G.damageTaken+=d;G.inv=.65;flash=.24;shake=9;addFx(G.px,G.py,'#ff7285',9,200);text(G.px,G.py-33,`-${Math.round(d)}`,'#ff7085');sound('hurt');if(G.hp<=0)end(false)}
function chooseUp(){offerUpgrade()}
function pick(i){takeChoice(i)}
function levelUp(){if(state!=='playing'||G.xp<G.need)return;G.xp-=G.need;G.lvl++;G.need=8+G.lvl*6;heal(2);chooseUp()}
function end(win){themeEnd(win)}
function update(dt){if(state!=='playing')return;dt=Math.min(dt,.045);if(G.hitStop>0){G.hitStop-=dt;return}G.t+=dt;G.chainBudget=40;G.boost=Math.max(0,G.boost-dt);G.comboT=Math.max(0,G.comboT-dt);if(!G.comboT)G.combo=0;G.burstT=Math.max(0,G.burstT-dt);G.missile-=dt;G.inv=Math.max(0,G.inv-dt);G.dash=Math.max(0,G.dash-dt);G.dashTime=Math.max(0,G.dashTime-dt);G.shoot-=dt;G.spawn-=dt;G.orbitTick-=dt;G.noticeT=Math.max(0,G.noticeT-dt);shake=Math.max(0,shake-22*dt);flash=Math.max(0,flash-2.7*dt);campaignTick(dt);if(state!=='playing')return;
const dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));const dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));const n=norm(dx,dy);G.moveX=touch.x||((dx||dy)?n.x:0);G.moveY=touch.y||((dx||dy)?n.y:0);
let target=null,best=1e10;for(const e of G.enemies){if(!e.live)continue;let d=dist2(e,{x:G.px,y:G.py});if(d<best){best=d;target=e}}if(target)G.aim=Math.atan2(target.y-G.py,target.x-G.px);if(mouse.held){let mx=mouse.x-W/2,my=mouse.y-H/2;if(Math.hypot(mx,my)>22)G.aim=Math.atan2(my,mx)}
if(keys.has(' ')&&G.dash<=0)dash();if(keys.has('q')&&chargeReady())overload();
if(G.dashTime>0){G.px+=G.dx*790*(1+.10*G.up.dash)*dt;G.py+=G.dy*790*(1+.10*G.up.dash)*dt;if(Math.random()<.85)addFx(G.px,G.py,'#80efff',2,120)}else{G.px+=G.moveX*282*dt;G.py+=G.moveY*282*dt}G.px=clamp(G.px,-1480,1480);G.py=clamp(G.py,-1070,1070);
if(G.shoot<=0&&best<900**2){fireShot();G.shoot=.26/(1+.22*G.up.rapid)/(G.boost>0?1.8:1)/(1+.15*G.surge)}
if(G.spawn<=0&&G.enemies.length<210)spawnCampaignWave();
for(const e of G.enemies){if(!e.live)continue;e.hurt=Math.max(0,e.hurt-dt);e.spin+=dt*2;e.fire-=dt;updateEnemyStage(e,dt);e.slow=Math.max(0,(e.slow||0)-dt);let nx=G.px-e.x,ny=G.py-e.y,d=Math.hypot(nx,ny)||1,move=e.moveLock?0:e.type==='shooter'&&d<300?-.27:e.type==='boss'&&d<220?-.16:1;e.x+=nx/d*e.speed*dt*move*(e.slow>0?.45:1);e.y+=ny/d*e.speed*dt*move*(e.slow>0?.45:1);if(e.fire<=0&&d<710){if(e.type==='shooter'){for(let j=-1;j<=1;j++){const a=Math.atan2(ny,nx)+j*.18;hostileBullet(e.x,e.y,Math.cos(a),Math.sin(a),210,10)}e.fire=rand(1.6,2.2)}else if(e.type==='conductor')conductorAttack(e);else if(e.type==='boss')bossAttack(e)}if(d<e.r+18&&G.dashTime<=0)damagePlayer(e.type==='boss'?17:10)}
if(G.up.damage&&G.missile<=0&&target){G.missile=1.8;for(let j=0;j<G.up.damage;j++)G.shots.push({x:G.px,y:G.py,vx:Math.cos(G.aim+j*.3)*350,vy:Math.sin(G.aim+j*.3)*350,t:3.0,pierce:0,hit:new Set(),damage:65*musicPower(),missile:true})}
for(const b of G.shots){if(b.missile&&target){const a=Math.atan2(target.y-b.y,target.x-b.x);b.vx+=(Math.cos(a)*580-b.vx)*Math.min(1,dt*5);b.vy+=(Math.sin(a)*580-b.vy)*Math.min(1,dt*5)}b.x+=b.vx*dt;b.y+=b.vy*dt;b.t-=dt;for(const e of G.enemies){if(!e.live||b.t<=0||b.hit.has(e.id))continue;if(Math.hypot(b.x-e.x,b.y-e.y)<e.r+5){b.hit.add(e.id);if(b.missile){ring(b.x,b.y,110,'#ffba69',.35);addFx(b.x,b.y,'#ffab54',20,260);for(const other of G.enemies)if(other.live&&other!==e&&dist2(other,b)<110**2)hurtEnemy(other,40*musicPower());sound('chain')}if(G.up.pierce)e.slow=1.4;hurtEnemy(e,b.damage);sound('hit');addFx(b.x,b.y,'#ffbc81',4,165);b.pierce--;if(b.pierce<0)b.t=-1}}}
for(const b of G.hostile){if(!b.live)continue;b.x+=b.vx*dt;b.y+=b.vy*dt;b.t-=dt;if(b.t<=0){b.live=false;continue}let d2=(b.x-G.px)**2+(b.y-G.py)**2;if(G.dashTime>0&&d2<100**2)absorb(b);else if(d2<(b.r+17)**2){b.live=false;damagePlayer(b.damage)}}
if(G.up.orbit&&G.orbitTick<=0){G.orbitTick=.18;for(let j=0;j<G.up.orbit+1;j++){let a=G.t*3.2+j*TAU/(G.up.orbit+1),x=G.px+Math.cos(a)*(G.evolutions.blade?G.dashTime>0?165:118:G.dashTime>0?130:90),y=G.py+Math.sin(a)*(G.evolutions.blade?G.dashTime>0?165:118:G.dashTime>0?130:90);for(const e of G.enemies)if(e.live&&Math.hypot(e.x-x,e.y-y)<e.r+14)hurtEnemy(e,(10+G.up.orbit*2)*musicPower()*(G.evolutions.blade?2:1))}}
for(const g of G.gems){g.spin+=dt*3;let x=G.px-g.x,y=G.py-g.y,d=Math.hypot(x,y);if(d<145+85*G.up.magnet&&d>1){g.x+=x/d*(490-d*.6)*dt;g.y+=y/d*(490-d*.6)*dt}if(d<26){g.taken=true;G.xp+=g.value;if(Math.random()<.2)sound('collect')}}
G.enemies=G.enemies.filter(e=>e.live);G.shots=G.shots.filter(b=>b.t>0);G.hostile=G.hostile.filter(b=>b.live);G.gems=G.gems.filter(g=>!g.taken);
for(const p of G.fx){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=1-3*dt;p.vy*=1-3*dt}G.fx=G.fx.filter(p=>p.t>0);
for(const r of G.rings)r.t-=dt;G.rings=G.rings.filter(r=>r.t>0);for(const b of G.beams)b.t-=dt;G.beams=G.beams.filter(b=>b.t>0);for(const f of G.floaters){f.t-=dt;f.y-=dt*40}G.floaters=G.floaters.filter(f=>f.t>0);
if(G.xp>=G.need)levelUp();
}
function hostileBullet(x,y,dx,dy,speed,damage){if(G.hostile.length>=520)return;G.hostile.push({x:x+dx*22,y:y+dy*22,vx:dx*speed,vy:dy*speed,r:damage>12?9:7,damage,t:5.6,live:true})}
function rect(x,y,w,h,color,border){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);if(border){ctx.strokeStyle=border;ctx.strokeRect(x,y,w,h)}}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,Math.max(.1,r),0,TAU);ctx.fill()}
function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fill()}
function arc(x,y,r,color,width=3,a=0,b=TAU){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,a,b);ctx.stroke()}
function label(txt,x,y,size,color='#e7f8ff',align='left',weight=600){ctx.fillStyle=color;ctx.font=`${weight} ${size}px 'Microsoft YaHei', system-ui, sans-serif`;ctx.textAlign=align;ctx.fillText(txt,x,y)}
function bar(x,y,w,h,value,color){rect(x,y,w,h,'#17293b');rect(x,y,w*clamp(value,0,1),h,color);ctx.strokeStyle='#53758a';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h)}
function draw(){rect(0,0,W,H,'#081323');if(!G)return;ctx.save();ctx.translate(W/2-G.px+(Math.random()-.5)*(reducedMotion?0:shake)*2,H/2-G.py+(Math.random()-.5)*(reducedMotion?0:shake)*2);
if(floor.complete&&floor.naturalWidth){ctx.drawImage(floor,-1500,-1100,3000,2200);rect(-1500,-1100,3000,2200,'#110b231c')}else rect(-1500,-1100,3000,2200,'#171022');ctx.strokeStyle='#b57aab77';ctx.lineWidth=8;ctx.strokeRect(-1500,-1100,3000,2200);
drawStageWorld();
for(const g of G.gems){circle(g.x,g.y,15,'#4affd020');let s=9+Math.sin(g.spin)*2;polygon([[g.x,g.y-s],[g.x+s*.75,g.y],[g.x,g.y+s],[g.x-s*.75,g.y]],g.value>1?'#c49eff':'#79ffd1')}
for(const e of G.enemies){let col={runner:'#fd6280',shooter:'#c68cff',brute:'#ffb260',boss:'#f26d9e',charger:'#ffcb7b',conductor:'#b9a0ff'}[e.type];circle(e.x,e.y+e.r*.4,e.r,'#0007');sprite(e.type,e.x,e.y,e.r*3.3,Math.atan2(G.py-e.y,G.px-e.x),e.hurt>0);if(e.elite)arc(e.x,e.y,e.r+9,'#ffda7e',3);if(e.type==='boss')label('丁程鑫',e.x,e.y-e.r-32,18,'#ffbad4','center');if(e.chargeWarning>0){ctx.strokeStyle='#ffbfa6';ctx.lineWidth=3;ctx.setLineDash([12,8]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(e.chargeAngle)*330,e.y+Math.sin(e.chargeAngle)*330);ctx.stroke();ctx.setLineDash([])}if(e.slow>0)arc(e.x,e.y,e.r+5,'#98eaff',2);if(e.type!=='runner')bar(e.x-e.r,e.y-e.r-18,e.r*2,4,e.hp/e.max,col)}
for(const b of G.shots){let a=Math.atan2(b.vy,b.vx);ctx.strokeStyle=b.missile?'#ff8a42':G.up.pierce?'#8deaff':'#ffecb6';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(b.x-Math.cos(a)*19,b.y-Math.sin(a)*19);ctx.lineTo(b.x+Math.cos(a)*8,b.y+Math.sin(a)*8);ctx.stroke();circle(b.x,b.y,4,'#fff')}
for(const b of G.hostile){circle(b.x,b.y,b.r*2.1,'#ff719a18');circle(b.x,b.y,b.r*.75,'#ff85ab');circle(b.x,b.y,b.r*.3,'#fff4e5');ctx.strokeStyle='#ffa4bf';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x+b.r*.6,b.y);ctx.lineTo(b.x+b.r*.6,b.y-17);ctx.lineTo(b.x+b.r*.6+7,b.y-12);ctx.stroke()}
let px=G.px,py=G.py;circle(px,py,37,'#42d9ff22');if(chargeReady())arc(px,py,45,'#c7ffdd',3);if(G.shield>0)arc(px,py,40,'#81e8ff',2);if(G.dashTime>0){G.trail.push({x:px,y:py,t:.18});arc(px,py,100,'#93f4ff55',2)}for(const t of G.trail){t.t-=.016;circle(t.x,t.y,24,rgba('#70eeff',Math.max(0,t.t)*1.2))}G.trail=G.trail.filter(t=>t.t>0);sprite('player',px,py,90,G.aim,G.inv>0&&Math.floor(G.t*18)%2);label('马嘉祺',px,py-46,16,'#b1f9ff','center');if(G.boost>0){arc(px,py,49,'#6bffff',3,G.t*5,G.t*5+4);label('反击超频',px,py-60,16,'#a1ffff','center')}
for(let j=0;j<G.up.orbit+1&&G.up.orbit;j++){let a=G.t*3.2+j*TAU/(G.up.orbit+1),x=px+Math.cos(a)*(G.evolutions.blade?G.dashTime>0?165:118:G.dashTime>0?130:90),y=py+Math.sin(a)*(G.evolutions.blade?G.dashTime>0?165:118:G.dashTime>0?130:90);circle(x,y,20,'#59c9ff35');polygon([[x,y-20],[x+11,y],[x,y+20],[x-11,y]],'#81d8ff')}
for(const r of G.rings){let phase=1-r.t/r.max;arc(r.x,r.y,r.r*phase,rgba(r.color,(1-phase)*.88),5)}for(const b of G.beams){ctx.strokeStyle=rgba('#9be5ff',Math.max(0,b.t/.15));ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(b.x,b.y);const vx=b.xx-b.x,vy=b.yy-b.y;for(let i=1;i<7;i++){const jitter=Math.sin(i*11.7+b.t*20)*15;ctx.lineTo(b.x+vx*i/7-vy/(Math.hypot(vx,vy)||1)*jitter,b.y+vy*i/7+vx/(Math.hypot(vx,vy)||1)*jitter)}ctx.lineTo(b.xx,b.yy);ctx.shadowColor='#50dfff';ctx.shadowBlur=12;ctx.stroke();ctx.shadowBlur=0}for(const p of G.fx)circle(p.x,p.y,p.size*p.t/p.max,rgba(p.color,clamp(p.t/p.max,0,1)));for(const f of G.floaters)label(f.label,f.x,f.y,20,rgba(f.color,f.t/.65),'center');ctx.restore();
// Compact stable HUD, sized for portrait and landscape.
const hudScale=W<900?1.4:1;ctx.save();ctx.scale(hudScale,hudScale);(function drawHud(W,H){
const small=W<900,pad=small?14:26,hudW=small?W*.40:280;
rect(pad,20,hudW,91,'#071017df','#536670');label('生命',pad+12,44,15,'#c7d7dd');bar(pad+60,31,hudW-76,12,G.hp/G.maxhp,'#ec5363');label('共鸣',pad+12,73,15,'#93ebf7');bar(pad+60,60,hudW-76,12,G.energy/resonanceCost(),chargeReady()?'#eaffac':'#65e5f9');label(`HP ${Math.ceil(G.hp)} · 护盾 ${Math.round(G.shield)} · LV ${G.lvl}`,pad+12,98,13,'#b5c8d0');
label(`${String(Math.floor(G.t/60)).padStart(2,'0')}:${String(Math.floor(G.t%60)).padStart(2,'0')}`,W/2,51,small?27:32,'#f0f7f8','center',800);label(`${G.kills} 击破`,W-pad,48,small?21:25,'#f4e7ca','right');label(G.bossActive?'丁程鑫 · 对决中':`下场 ${timeLabel(Math.max(0,(SHOW.bosses[G.bossIndex]?.at||900)-G.t))}`,W-pad,76,small?12:14,'#c8b8e0','right');bar(pad,121,W-pad*2,4,G.xp/G.need,'#c2a0fa');
if(!small&&!touchMode){label('SPACE / 冲刺吸弹',pad,H-44,17,'#cfecf3');label(G.dash>0?G.dash.toFixed(1)+'s':'就绪',pad,H-22,15,G.dash?'#91a4ae':'#6be8e8');label('Q / 全场共鸣',W-pad,H-44,17,'#cfecf3','right');label(chargeReady()?'就绪 · 突入后释放':'吸弹充能',W-pad,H-22,15,'#a6f5ed','right')}
const build=upgrades.filter(u=>G.up[u.id]).map(u=>u.name+(G.up[u.id]>1?' ×'+G.up[u.id]:'')).join(' / ');if(build)label(build.length>45?build.slice(0,45)+'…':build,W/2,H-(touchMode?220:28),small?15:16,'#b0bdcf','center');
drawStageHud(W,H,small,pad);
if(G.combo>=3&&G.comboT>0)label(`${G.combo} 连锁`,W-pad,125,small?22:30,'#ffcd82','right',900);
if(G.noticeT>0){ctx.shadowColor='#4cecff';ctx.shadowBlur=12;label(G.notice,W/2,small?245:225,small?23:27,rgba('#d6fbff',Math.min(1,G.noticeT/.28)),'center');ctx.shadowBlur=0}if(flash>0&&!reducedMotion)rect(0,0,W,H,`rgba(170,235,255,${flash*.22})`);
})(W/hudScale,H/hudScale);ctx.restore();syncControls();
}

function frame(ts){let dt=last?(ts-last)/1000:0;last=ts;update(dt);draw();requestAnimationFrame(frame)}
const touch={x:0,y:0,id:null};
const touchMode=window.matchMedia?.('(pointer: coarse)').matches||false;
const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
const atlas=new Image();atlas.src='assets/stage-units.png';const oldAtlas=new Image();oldAtlas.src='assets/units.png';const floor=new Image();floor.src='assets/stage-floor.png';
function sprite(type,x,y,size,angle,hit){
 const q={player:[0,0],boss:[1,0],shooter:[0,1],conductor:[0,1],brute:[1,1],runner:[1,0],charger:[1,0]}[type];
 const img=type==='runner'||type==='charger'?oldAtlas:atlas;if(!img.complete||!img.naturalWidth)return;
 const sw=img.naturalWidth/2,sh=img.naturalHeight/2;ctx.save();ctx.translate(x,y);if(type==='player'||type==='boss'){if(Math.cos(angle)<0)ctx.scale(-1,1)}else ctx.rotate(angle);
 if(type==='charger')ctx.filter='hue-rotate(30deg)';if(type==='conductor')ctx.filter='hue-rotate(35deg)';
 if(hit)ctx.globalAlpha=.65;ctx.drawImage(img,q[0]*sw,q[1]*sh,sw,sh,-size/2,-size/2,size,size);ctx.restore();
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
function syncControls(){const d=document.querySelector('#dash-btn'),o=document.querySelector('#overload-btn');d.classList.toggle('ready',G.dash<=0);d.querySelector('small').textContent=G.dash>0?G.dash.toFixed(1)+'s':'冲刺';o.classList.toggle('ready',chargeReady());o.querySelector('small').textContent=chargeReady()?'释放共鸣':Math.floor(G.energy)+'%';d.setAttribute('aria-disabled',String(G.dash>0));o.setAttribute('aria-disabled',String(!chargeReady()));document.querySelector('#controls').hidden=state!=='playing';const supply=document.querySelector('#supply-btn');supply.hidden=state!=='playing'||!nearSupply();supply.textContent='领取补给 E'}
window.addEventListener('resize',resize);reset();resize();intro();requestAnimationFrame(frame);
