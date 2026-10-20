'use strict';
// Shared squad decisions are sampled at 4 Hz; movement and telegraphs run each frame.
const BACKLINE_ROLES=['healer','summoner','sniper','printer','shooter'];
const RANGED_ROLES=[...BACKLINE_ROLES,'conductor','clock'];
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
function tacticsState(){return{tacticTimer:0,enemyById:new Map(),pvx:0,pvy:0,interrupts:0};}
function findTacticalEnemy(id){if(!id)return null;return G.enemyById.get(id)||G.enemies.find(e=>e.id===id);}
function predictPlayer(origin,speed,maxLead=.5){
 const lead=Math.min(maxLead,Math.hypot(G.px-origin.x,G.py-origin.y)/speed);
 return{x:clamp(G.px+clamp(G.pvx,-300,300)*lead,-1460,1460),y:clamp(G.py+clamp(G.pvy,-300,300)*lead,-1050,1050)};
}
function refreshSquads(){
 const live=G.enemies.filter(e=>e.live);G.enemyById=new Map(live.map(e=>[e.id,e]));
 const backline=live.filter(e=>BACKLINE_ROLES.includes(e.type)),claimed=new Set(),cells=new Map();
 for(const e of live){const key=Math.floor(e.x/96)+','+Math.floor(e.y/96);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(e)}
 for(const e of live){
   e.sepX=e.sepY=0;let neighbours=0;
   const cx=Math.floor(e.x/96),cy=Math.floor(e.y/96);
   for(let gx=cx-1;gx<=cx+1;gx++)for(let gy=cy-1;gy<=cy+1;gy++)for(const other of cells.get(gx+','+gy)||[]){
     if(other===e)continue;const dx=e.x-other.x,dy=e.y-other.y,d2=dx*dx+dy*dy;
     if(d2>0&&d2<72**2){const d=Math.sqrt(d2),weight=(72-d)/72;e.sepX+=dx/d*weight;e.sepY+=dy/d*weight;neighbours++}
   }
   if(neighbours){e.sepX/=neighbours;e.sepY/=neighbours}
   if(e.type==='shield'){
     const options=backline.filter(a=>!claimed.has(a.id)&&dist2(e,a)<380**2);
     options.sort((a,b)=>(dist2(e,a)+(a.type==='healer'?-30000:0))-(dist2(e,b)+(b.type==='healer'?-30000:0)));
     e.escortId=options[0]?.id||0;if(e.escortId)claimed.add(e.escortId);
   }
   if(e.type==='healer'){
     const wounded=live.filter(a=>a!==e&&a.type!=='boss'&&a.hp<a.max&&dist2(a,e)<420**2);
     wounded.sort((a,b)=>a.hp/a.max-b.hp/b.max);e.escortId=wounded[0]?.id||0;
   }
 }
}
function tacticsTick(dt){G.tacticTimer-=dt;if(G.tacticTimer<=0){G.tacticTimer=.25;refreshSquads()}}
function tacticalVelocity(e){
 if(e.moveLock||e.stagger>0)return{x:0,y:0};
 const dx=G.px-e.x,dy=G.py-e.y,d=Math.hypot(dx,dy)||1,n={x:dx/d,y:dy/d},ally=findTacticalEnemy(e.escortId);
 let x=n.x,y=n.y;
 if(e.type==='shield'&&ally?.live&&!(e.guardDown>0)){
   const toward=norm(G.px-ally.x,G.py-ally.y),point={x:ally.x+toward.x*105,y:ally.y+toward.y*105};
   const distance=Math.hypot(point.x-e.x,point.y-e.y);if(distance<16)return{x:0,y:0};
   const move=norm(point.x-e.x,point.y-e.y);x=move.x*Math.min(1,distance/65);y=move.y*Math.min(1,distance/65);
 }else if(e.type==='healer'&&ally?.live&&d>220){
   const away=norm(ally.x-G.px,ally.y-G.py),move=norm(ally.x+away.x*105-e.x,ally.y+away.y*105-e.y);x=move.x;y=move.y;
 }else if(RANGED_ROLES.includes(e.type)){
   const range=e.type==='sniper'?440:e.type==='healer'||e.type==='summoner'?370:310,radial=clamp((d-range)/110,-.8,1),side=e.id%2?1:-1;
   x=n.x*radial-n.y*side*.42;y=n.y*radial+n.x*side*.42;
 }else if(['runner','box','charger'].includes(e.type)&&d>130&&d<600){
   const flank=(e.id%2?1:-1)*.6;x=n.x*Math.cos(flank)-n.y*Math.sin(flank);y=n.x*Math.sin(flank)+n.y*Math.cos(flank);
 }else if(e.type==='boss'&&d<220){x=-n.x*.16;y=-n.y*.16}
 x+=(e.sepX||0)*.55;y+=(e.sepY||0)*.55;const length=Math.max(1,Math.hypot(x,y));return{x:x/length,y:y/length};
}
function coverDamage(target,damage,origin){
 // Area damage bypasses interception. Cover must physically intersect an incoming shot.
 if(!origin||damage>=80||target.type==='boss')return damage;
 const dx=target.x-origin.x,dy=target.y-origin.y,len2=dx*dx+dy*dy;if(len2<1)return damage;
 for(const guard of G.enemies){
   if(!guard.live||guard.type!=='shield'||guard.escortId!==target.id||guard.guardDown>0||guard.stagger>0||dist2(guard,target)>170**2)continue;
   const t=((guard.x-origin.x)*dx+(guard.y-origin.y)*dy)/len2;
   if(t<=0||t>=1)continue;
   const facing=guard.guardAngle??Math.atan2(G.py-guard.y,G.px-guard.x),incoming=Math.atan2(origin.y-guard.y,origin.x-guard.x);
   if(Math.abs(angleDelta(facing,incoming))<1.2&&segmentDistance2(guard.x,guard.y,{x:origin.x,y:origin.y,x2:target.x,y2:target.y})<(guard.r+12)**2){
     guard.coverFlash=.2;return damage*.45;
   }
 }
 return damage;
}
function isEnemyCasting(e){return(e.snipeWarning||0)>0||(e.printWarning||0)>0||(e.clockWarning||0)>0||(e.healCast||0)>0||(e.summonCast||0)>0||(e.commandCast||0)>0||(e.bossCast||0)>0||(e.chargeWarning||0)>0||e.boxState==='tell';}
function releaseCommand(e){
 for(const ally of G.enemies)if(ally.commandedBy===e.id){ally.commandedBy=0;if(!(ally.stagger>0)&&!isEnemyCasting(ally))ally.moveLock=false}
}
function cancelEnemyPlans(e){
 G.hazards=G.hazards.filter(h=>h.ownerId!==e.id||h.age>=h.delay);
 releaseCommand(e);e.commandIds=[];
}
function interruptEnemy(e,byDash=false){
 if(!e.live||e.interruptLock>0||(!isEnemyCasting(e)&&!(byDash&&e.type==='shield'&&!(e.guardDown>0))))return false;
 cancelEnemyPlans(e);
 e.snipeWarning=e.printWarning=e.clockWarning=e.healCast=e.summonCast=e.commandCast=e.bossCast=e.chargeWarning=0;
 e.ringBursts=e.printRemaining=e.chargeRun=0;e.boxState='';e.boxCD=4.5;
 e.stagger=e.type==='boss'?1.8:1.15;e.interruptLock=2.8;e.moveLock=true;e.fire=Math.max(e.fire,2);
 if(e.type==='shield')e.guardDown=2.5;
 G.interrupts++;if(byDash)G.energy=Math.min(100,G.energy+6);
 text(e.x,e.y-e.r-22,'打断','#357b8e');skillEffect('slash',e.x,e.y,75);sound('chain');return true;
}
function tacticalImpact(e,damage){
 if(e.bossCast>0){e.castDamage=(e.castDamage||0)+damage;if(e.castDamage>=e.breakThreshold)interruptEnemy(e)}
 else if(damage>=80)interruptEnemy(e);
}
function beginSupportCast(e){
 if(isEnemyCasting(e)||e.stagger>0)return;
 if(e.type==='sniper'){
   const point=predictPlayer(e,465);e.snipeAngle=Math.atan2(point.y-e.y,point.x-e.x);e.snipeWarning=1.05;e.fire=3;e.moveLock=true;
 }else if(e.type==='healer'){
   e.healTargets=G.enemies.filter(a=>a.live&&a!==e&&a.type!=='boss'&&a.hp<a.max&&dist2(a,e)<290**2).sort((a,b)=>a.hp/a.max-b.hp/b.max).slice(0,4).map(a=>a.id);
   if(!e.healTargets.length){e.fire=.8;return}e.healCast=.95;e.fire=3.6;e.moveLock=true;
 }else if(e.type==='summoner'){
   e.summonCast=1.2;e.moveLock=true;e.fire=5;
   const point=predictPlayer(e,300,.4),base=Math.atan2(point.y-e.y,point.x-e.x);
   for(let i=0;i<2;i++){const a=base+(i?-.95:.95);let p={x:clamp(point.x+Math.cos(a)*280,-1400,1400),y:clamp(point.y+Math.sin(a)*280,-1000,1000)};if(dist2(p,{x:G.px,y:G.py})<250**2)p=safeSpawnPoint(350);addHazard({kind:'spawn',ownerId:e.id,...p,r:26,delay:1.2,life:.15,type:i?'runner':'shooter'})}
 }
}
function beginCommandCast(e){
 if(isEnemyCasting(e)||e.stagger>0)return;
 e.commandIds=G.enemies.filter(a=>a.live&&a!==e&&['shooter','printer','sniper'].includes(a.type)&&!isEnemyCasting(a)&&!(a.stagger>0)&&!a.commandedBy&&dist2(a,e)<440**2).sort((a,b)=>dist2(a,e)-dist2(b,e)).slice(0,3).map(a=>a.id);
 for(const id of e.commandIds){const ally=findTacticalEnemy(id);ally.commandedBy=e.id;ally.moveLock=true}
 e.commandTarget=predictPlayer(e,265,.5);e.commandCast=1.1;e.moveLock=true;e.fire=e.elite?3.8:4.8;
}
function tacticalEnemyTick(e,dt){
 e.interruptLock=Math.max(0,(e.interruptLock||0)-dt);e.coverFlash=Math.max(0,(e.coverFlash||0)-dt);
 if(e.stagger>0){e.stagger=Math.max(0,e.stagger-dt);e.moveLock=e.stagger>0;return}
 if(G.dashTime>0&&e.lastInterruptedDash!==G.dashCount&&dist2(e,{x:G.px,y:G.py})<(e.r+64)**2&&interruptEnemy(e,true)){e.lastInterruptedDash=G.dashCount;return}
 if(e.recovery>0){e.recovery=Math.max(0,e.recovery-dt);e.moveLock=e.recovery>0;return}
 if(e.type==='shield'){
   const target=Math.atan2(G.py-e.y,G.px-e.x);e.guardAngle??=target;e.guardAngle+=clamp(angleDelta(e.guardAngle,target),-dt*2.1,dt*2.1);
 }
 if(e.commandedBy){const commander=findTacticalEnemy(e.commandedBy);if(commander?.live&&commander.commandCast>0)e.moveLock=true;else{e.commandedBy=0;e.moveLock=false}}
 if(e.snipeWarning>0){
   if(e.snipeWarning>.4){const p=predictPlayer(e,465);e.snipeAngle=Math.atan2(p.y-e.y,p.x-e.x)}
   e.snipeWarning=Math.max(0,e.snipeWarning-dt);e.moveLock=true;
   if(e.snipeWarning<=0){hostileBullet(e.x,e.y,Math.cos(e.snipeAngle),Math.sin(e.snipeAngle),465,17);e.recovery=.6;skillEffect('burst',e.x,e.y,42,e.snipeAngle)}
 }
 if(e.healCast>0){
   e.healCast=Math.max(0,e.healCast-dt);e.moveLock=true;
   if(e.healCast<=0){for(const id of e.healTargets){const ally=findTacticalEnemy(id);if(ally?.live&&dist2(ally,e)<330**2){ally.hp=Math.min(ally.max,ally.hp+ally.max*.13);skillEffect('heal',ally.x,ally.y,65);G.beams.push({x:e.x,y:e.y,xx:ally.x,yy:ally.y,t:.22,color:'#bfa1ff'})}}e.recovery=.6}
 }
 if(e.summonCast>0){e.summonCast=Math.max(0,e.summonCast-dt);e.moveLock=true;if(e.summonCast<=0)e.recovery=.6}
 if(e.commandCast>0){
   if(e.commandCast>.35)e.commandTarget=predictPlayer(e,265,.5);
   e.commandCast=Math.max(0,e.commandCast-dt);e.moveLock=true;
   if(e.commandCast<=0){
     const sources=e.commandIds.length?e.commandIds.map(findTacticalEnemy).filter(a=>a?.live&&a.commandedBy===e.id&&!(a.stagger>0)):[e];
     for(const ally of sources){const angle=Math.atan2(e.commandTarget.y-ally.y,e.commandTarget.x-ally.x);for(let j=-1;j<=1;j++){const a=angle+j*.16;hostileBullet(ally.x,ally.y,Math.cos(a),Math.sin(a),265,14)}ally.fire=Math.max(ally.fire,1.7)}
     releaseCommand(e);e.commandIds=[];e.recovery=.8;
   }
 }
 if(e.bossCast>0){e.bossCast=Math.max(0,e.bossCast-dt);e.moveLock=true;if(e.bossCast<=0){machineBossSpecial(e);e.recovery=1.25}}
}
function tacticalLine(a,b,color,width=2,dashed=true){
 ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;if(dashed)ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
}
function drawTacticalLinks(){
 for(const e of G.enemies){
   if(!e.live)continue;
   if(e.type==='shield'&&!(e.guardDown>0)&&!(e.stagger>0)&&G.enemies.length<80){const ally=findTacticalEnemy(e.escortId);if(ally?.live&&dist2(e,ally)<170**2)tacticalLine(e,ally,e.coverFlash>0?'#a1f4ff':'#78e6ff88',e.coverFlash>0?5:2)}
   if(e.healCast>0)for(const id of e.healTargets){const ally=findTacticalEnemy(id);if(ally?.live)tacticalLine(e,ally,'#bfa1ff',3)}
   if(e.commandCast>0){const sources=e.commandIds.length?e.commandIds.map(findTacticalEnemy).filter(a=>a?.live&&a.commandedBy===e.id):[e];for(const ally of sources){if(ally!==e)tacticalLine(e,ally,'#ffc66e88');const a=Math.atan2(e.commandTarget.y-ally.y,e.commandTarget.x-ally.x);tacticalLine(ally,{x:ally.x+Math.cos(a)*650,y:ally.y+Math.sin(a)*650},e.commandCast>.35?'#ffc66ebb':'#ff8377',e.commandCast>.35?2:3,e.commandCast>.35)}}
 }
}
function drawTacticalDetails(e){
 if(e.type==='boss')return;
 let caption='',progress=0,color='#ffc66e';
 if(e.stagger>0){caption='破招';progress=e.stagger/(e.type==='boss'?1.8:1.15);color='#78e6ff'}
 else if(e.commandCast>0){caption='交叉火力 · 可打断';progress=1-e.commandCast/1.1}
 else if(e.healCast>0){caption='治疗 · 可打断';progress=1-e.healCast/.95}
 else if(e.summonCast>0){caption='夹击召唤 · 可打断';progress=1-e.summonCast/1.2}
 else if(e.snipeWarning>0){caption=e.snipeWarning>.4?'预判追踪':'已锁定';progress=1-e.snipeWarning/1.05;color=e.snipeWarning>.4?'#ffc66e':'#ff827b'}
 else if(e.recovery>0){caption='破绽 +25%';progress=Math.min(1,e.recovery);color='#6bf5bb'}
 if(!caption)return;
 const y=e.y-e.r-59;label(caption,e.x,y,W<900?18:13,color,'center');bar(e.x-30,y+7,60,4,progress,color);
}
function drawBossTacticalHud(e,width,small,pad){
 let caption='',progress=0,color='#ffc66e';
 if(e.bossCast>0){caption='蓄力 · 冲刺贴身 / 集火打断';progress=(e.castDamage||0)/e.breakThreshold}
 else if(e.stagger>0){caption='破招 · 承受伤害 +25%';progress=e.stagger/1.8;color='#78e6ff'}
 else if(e.recovery>0){caption='破绽 · 承受伤害 +25%';progress=e.recovery/1.25;color='#6bf5bb'}
 if(!caption)return;
 const bw=Math.min(width-pad*2,600),y=small?216:211;
 label(caption,width/2,y,small?14:16,color,'center');bar((width-bw)/2,y+8,bw,4,progress,color);
}
