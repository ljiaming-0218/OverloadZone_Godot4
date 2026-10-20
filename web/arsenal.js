'use strict';
const MACHINE_ENEMIES={runner:'追猎蜂',shooter:'双联炮隼',brute:'重装甲虫',charger:'突刺游隼',conductor:'中继指挥机',shield:'屏障守卫',sniper:'磁轨狙击机',healer:'纳米修复机',summoner:'折跃母巢',clock:'干扰环卫',printer:'三联轨道炮',box:'幽影伏击机'};
function chooseMachineEnemy(time,roll=Math.random()){
 const pool=[['runner',4],['shooter',3]];
 for(const [type,at,weight] of [['shield',55,1],['clock',70,1.2],['charger',90,1.8],['sniper',110,1],['brute',160,1.6],['printer',210,1.1],['healer',230,.9],['conductor',300,1],['box',320,1.3],['summoner',350,.8]])if(time>=at)pool.push([type,weight]);
 let value=roll*pool.reduce((sum,item)=>sum+item[1],0);for(const [type,weight] of pool){value-=weight;if(value<0)return type}return pool.at(-1)[0];
}
function updateMachineAbilities(e,dt){
 if(e.type==='clock'){
   e.clockWarning=Math.max(0,(e.clockWarning||0)-dt);
   if(e.ringBursts>0&&e.clockWarning<=0){e.ringTimer-=dt;if(e.ringTimer<=0){e.ringTimer=.3;e.ringBursts--;for(let i=0;i<8;i++){const a=i*TAU/8+e.ringBursts*.18;const bullet=hostileBullet(e.x,e.y,Math.cos(a),Math.sin(a),175+(3-e.ringBursts)*15,12);if(bullet)bullet.slow=1.3}}}
 }
 if(e.type==='printer'){
   e.printWarning=Math.max(0,(e.printWarning||0)-dt);
   if(e.printRemaining>0&&e.printWarning<=0){e.printTimer-=dt;if(e.printTimer<=0){e.printTimer=.24;e.printRemaining--;for(let j=-1;j<=1;j++){const a=e.printAngle+j*.14;const bullet=hostileBullet(e.x,e.y,Math.cos(a),Math.sin(a),300,14);if(bullet)bullet.invoice=true}skillEffect('burst',e.x,e.y,46,e.printAngle)}}
   e.moveLock=e.printWarning>0||e.printRemaining>0;
 }
 if(e.type==='box'){
   e.boxCD=(e.boxCD??2.5)-dt;
   if(!e.boxState&&e.boxCD<=0&&dist2(e,{x:G.px,y:G.py})<340**2){e.boxState='retreat';e.boxTime=.85;e.boxAngle=Math.atan2(e.y-G.py,e.x-G.px);e.moveLock=true;addHazard({kind:'blast',x:e.x,y:e.y,r:56,delay:1.55,life:.45,damage:17})}
   if(e.boxState){e.boxTime-=dt;
     if(e.boxState==='retreat'){e.x=clamp(e.x+Math.cos(e.boxAngle)*170*dt,-1450,1450);e.y=clamp(e.y+Math.sin(e.boxAngle)*170*dt,-1050,1050);if(e.boxTime<=0){e.boxState='tell';e.boxTime=.7;e.boxAngle=Math.atan2(G.py-e.y,G.px-e.x)}}
     else if(e.boxState==='tell'&&e.boxTime<=0){e.boxState='rush';e.boxTime=.55}
     else if(e.boxState==='rush'){e.x=clamp(e.x+Math.cos(e.boxAngle)*550*dt,-1450,1450);e.y=clamp(e.y+Math.sin(e.boxAngle)*550*dt,-1050,1050);if(e.boxTime<=0){e.boxState='';e.boxCD=4.5;e.moveLock=false}}
   }
 }
}
function machineAttack(e){
 if(e.type==='clock'){e.clockWarning=.8;e.ringBursts=3;e.ringTimer=0;e.fire=4.4}
 if(e.type==='printer'){e.printWarning=.8;e.printRemaining=3;e.printTimer=0;e.printAngle=Math.atan2(G.py-e.y,G.px-e.x);e.moveLock=true;e.fire=4.6}
}
function arsenalState(){return{slowTimer:0,cleanKills:0,breakTime:0,breakCooldown:0};}
function tickArsenal(dt){G.slowTimer=Math.max(0,G.slowTimer-dt);G.breakTime=Math.max(0,G.breakTime-dt);G.breakCooldown=Math.max(0,G.breakCooldown-dt)}
function cleanKillReward(){
 G.cleanKills=Math.min(20,G.cleanKills+1);
 if(G.cleanKills>=20&&G.breakCooldown<=0){G.cleanKills=0;G.breakCooldown=14;G.breakTime=3;G.shield=Math.min(75,G.shield+10);G.energy=Math.min(100,G.energy+12);notice('无伤歼灭 20 台 · 自律超频 3 秒',2.5);skillEffect('heal',G.px,G.py,100);sound('level')}
}
function drawMachineWarning(e){
 if(e.clockWarning>0)arc(e.x,e.y,e.r+13,'#ffc66e',3,0,TAU*(1-e.clockWarning/.8));
 if(e.printWarning>0){ctx.save();ctx.strokeStyle='#ff827b';ctx.lineWidth=2;ctx.setLineDash([10,8]);for(let j=-1;j<=1;j++){const a=e.printAngle+j*.14;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(a)*480,e.y+Math.sin(a)*480);ctx.stroke()}ctx.restore()}
 if(e.boxState==='retreat')label('佯退',e.x,e.y-e.r-16,14,'#ffc66e','center');
 if(e.boxState==='tell'){ctx.save();ctx.strokeStyle='#ffad70';ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(e.boxAngle)*320,e.y+Math.sin(e.boxAngle)*320);ctx.stroke();ctx.restore();label('反冲预警',e.x,e.y-e.r-16,14,'#ff827b','center')}
}
function drawMachineProjectile(b){
 if(b.invoice){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));ctx.shadowColor='#ff506f';ctx.shadowBlur=9;polygon([[-13,-4],[8,-4],[16,0],[8,4],[-13,4]],'#ff758d');ctx.restore();return true}
 if(b.slow){circle(b.x,b.y,b.r+4,'#a58aff22');arc(b.x,b.y,b.r+2,'#be9cff',2.5);circle(b.x,b.y,3,'#ebe0ff');return true}
 return false;
}
function drawMachineBoss(x,y,size,angle,hit,chapter=0){
 if(!bossAtlas.complete||!bossAtlas.naturalWidth)return;
 const sw=bossAtlas.naturalWidth/3,sh=bossAtlas.naturalHeight;ctx.save();ctx.translate(x,y);if(hit)ctx.globalAlpha=.65;ctx.drawImage(bossAtlas,chapter*sw,0,sw,sh,-size/2,-size/2,size,size);
 const image=portraitImages.ding;if(image?.complete&&image.naturalWidth){const r=size*.15,cy=-size*.03,side=Math.min(image.naturalWidth,image.naturalHeight);circle(0,cy,r+3,'#b092ff');ctx.save();ctx.beginPath();ctx.arc(0,cy,r,0,TAU);ctx.clip();ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,-r,cy-r,2*r,2*r);ctx.restore()}
 ctx.restore();
}
function machineBossSpecial(e){
 if(e.attack%4!==0)return false;
 if(e.chapter===0){
   for(let i=0;i<3;i++){const a=i*TAU/3;addHazard({kind:'spawn',x:clamp(G.px+Math.cos(a)*310,-1420,1420),y:clamp(G.py+Math.sin(a)*310,-1020,1020),r:28,delay:1.3,life:.1,type:i===2?'charger':'clock'})}
   notice('交叉增援 · 优先击破干扰环卫',2);
 }else if(e.chapter===1){
   for(let j=-1;j<=1;j++)addHazard({kind:'blast',x:clamp(G.px+j*115,-1400,1400),y:clamp(G.py+j*35,-1000,1000),r:70,delay:1.3+Math.abs(j)*.2,life:.55,damage:20});
   const a=Math.atan2(G.py-e.y,G.px-e.x);for(let j=-2;j<=2;j++){const b=a+j*.2,bullet=hostileBullet(e.x,e.y,Math.cos(b),Math.sin(b),245,15);if(bullet)bullet.invoice=true}
   notice('错时轰炸 · 留意轨道弹扇射',2);
 }else{
   addHazard({kind:'ring',x:G.px,y:G.py,r:240,inner:140,delay:1.5,life:.75,damage:27});
   notice('环形封锁 · 内圈 / 外圈安全',2.5);
 }
 e.fire=2.8;return true;
}
