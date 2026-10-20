'use strict';
const OFFICE_EPISODES={
 opening:{title:'17:59 · 你刚拿起书包',lines:[['我','还有一分钟，我今天一定准点下班。'],['组长','就耽误大家五分钟。'],['摸鱼搭子','别信，他的五分钟是一个独立时区。'],['我','等一下，那个打印机为什么伸舌头了？']],choices:[['先灌咖啡','初始怒气 +20','mic'],['先装忙','初始护盾 +15','warm']]},
 'boss-0':{title:'第一关 · 五分钟小会',lines:[['组长','大家简单同步一下，不用紧张。'],['我','那你为什么站在带轮子的椅子上？'],['组长','为了推动项目。'],['摸鱼搭子','红圈就是他的重点，别站重点上。']]},
 'break-0':{title:'茶水间 · 战术性接水',lines:[['我','会议结束了？'],['摸鱼搭子','结束了，但是拉了三个新群。'],['我','行，那我这杯水接到退休。']]},
 'boss-1':{title:'第二关 · 最后改一版',lines:[['总监','这个版本已经很好了。'],['我','你后面是不是还有一句“但是”？'],['总监','但是能不能把昨天删掉的加回来？'],['摸鱼搭子','看地上的预警线，急件要来了！']]},
 'break-1':{title:'工位 · 需求突然活了',lines:[['我','需求文档刚才是不是眨眼了？'],['摸鱼搭子','它不仅眨眼，还把你的截止日期吃了。'],['我','纸箱都往门口跑了，我怎么还没下班？']]},
 'boss-2':{title:'终局 · 老板画的大饼',lines:[['老板','年轻人，眼光要放长远一点。'],['我','长远到几点？'],['老板','先把这张饼吃了。'],['我','好的，我选择把桌子掀了。']]},
 ending:{title:'18:00 · 终于刷上门禁',lines:[['我','原来下班不是时间，是一种战斗结果。'],['摸鱼搭子','你先走，我给你发战报。'],['组长','明天我们——'],['我','已读。勿扰。']]},
};
const OFFICE_ENEMIES={runner:'尖叫鼠标',shooter:'复读喇叭',brute:'肥宅订书机',charger:'滑铲办公椅',conductor:'会议乌鸦',shield:'甩锅锅盖',sniper:'已读摄像头',healer:'鸡汤饮水机',summoner:'加戏复印机',clock:'追命闹钟',printer:'连环催稿机',box:'假装下班箱'};
function chooseOfficeEnemy(time,roll=Math.random()){
 const pool=[['runner',4],['shooter',3]];
 for(const [type,at,weight] of [['shield',55,1],['clock',70,1.2],['charger',90,1.8],['sniper',110,1],['brute',160,1.6],['printer',210,1.1],['healer',230,.9],['conductor',300,1],['box',320,1.3],['summoner',350,.8]])if(time>=at)pool.push([type,weight]);
 let value=roll*pool.reduce((sum,item)=>sum+item[1],0);for(const [type,weight] of pool){value-=weight;if(value<0)return type}return pool.at(-1)[0];
}
function officeEnemyTick(e,dt){
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
function officeEnemyAttack(e){
 if(e.type==='clock'){e.clockWarning=.8;e.ringBursts=3;e.ringTimer=0;e.fire=4.4}
 if(e.type==='printer'){e.printWarning=.8;e.printRemaining=3;e.printTimer=0;e.printAngle=Math.atan2(G.py-e.y,G.px-e.x);e.moveLock=true;e.fire=4.6}
}
function officeState(){return{slowTimer:0,cleanKills:0,breakTime:0,breakCooldown:0};}
function officeTick(dt){G.slowTimer=Math.max(0,G.slowTimer-dt);G.breakTime=Math.max(0,G.breakTime-dt);G.breakCooldown=Math.max(0,G.breakCooldown-dt)}
function cleanKillReward(){
 G.cleanKills=Math.min(20,G.cleanKills+1);
 if(G.cleanKills>=20&&G.breakCooldown<=0){G.cleanKills=0;G.breakCooldown=14;G.breakTime=3;G.shield=Math.min(75,G.shield+10);G.energy=Math.min(100,G.energy+12);notice('无伤处理 20 单 · 带薪摸鱼 3 秒',2.5);skillEffect('heal',G.px,G.py,100);sound('level')}
}
function drawOfficeWarning(e){
 if(e.clockWarning>0)arc(e.x,e.y,e.r+13,'#d67a37',3,0,TAU*(1-e.clockWarning/.8));
 if(e.printWarning>0){ctx.save();ctx.strokeStyle='#bb5547';ctx.lineWidth=2;ctx.setLineDash([10,8]);for(let j=-1;j<=1;j++){const a=e.printAngle+j*.14;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(a)*480,e.y+Math.sin(a)*480);ctx.stroke()}ctx.restore()}
 if(e.boxState==='retreat')label('我先走了',e.x,e.y-e.r-16,14,'#815728','center');
 if(e.boxState==='tell'){ctx.save();ctx.strokeStyle='#ce7544';ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(e.boxAngle)*320,e.y+Math.sin(e.boxAngle)*320);ctx.stroke();ctx.restore();label('骗你的',e.x,e.y-e.r-16,14,'#b24b42','center')}
}
function drawOfficeProjectile(b){
 if(b.invoice){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));rect(-11,-7,22,14,'#fff4dc','#b35846');label('急',0,4,11,'#ad4e3f','center',900);ctx.restore();return true}
 if(b.slow){circle(b.x,b.y,b.r+2,'#fff4d6');arc(b.x,b.y,b.r+2,'#d28232',2);ctx.strokeStyle='#9e582a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x,b.y-5);ctx.lineTo(b.x,b.y);ctx.lineTo(b.x+4,b.y+2);ctx.stroke();return true}
 return false;
}
function drawOfficeBoss(x,y,size,angle,hit,chapter=0){
 if(!bossAtlas.complete||!bossAtlas.naturalWidth)return;
 const [sx,sw]=[[0,695],[695,625],[1320,852]][chapter]||[0,695],sh=bossAtlas.naturalHeight,scale=size/Math.max(sw,sh);ctx.save();ctx.translate(x,y);if(hit)ctx.globalAlpha=.65;ctx.drawImage(bossAtlas,sx,0,sw,sh,-sw*scale/2,-sh*scale/2,sw*scale,sh*scale);
 const image=portraitImages.ding;if(image?.complete&&image.naturalWidth){const r=size*.19,cy=-size*.16,side=Math.min(image.naturalWidth,image.naturalHeight);circle(0,cy,r+3,'#fff9e9');ctx.save();ctx.beginPath();ctx.arc(0,cy,r,0,TAU);ctx.clip();ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,-r,cy-r,2*r,2*r);ctx.restore()}
 ctx.restore();
}
function officeBossSpecial(e){
 if(e.attack%4!==0)return false;
 if(e.chapter===0){
   for(let i=0;i<3;i++){const a=i*TAU/3;addHazard({kind:'spawn',x:clamp(G.px+Math.cos(a)*310,-1420,1420),y:clamp(G.py+Math.sin(a)*310,-1020,1020),r:28,delay:1.3,life:.1,type:i===2?'charger':'clock'})}
   notice('组长：全员开会，一个都别走！',2);
 }else if(e.chapter===1){
   for(let j=-1;j<=1;j++)addHazard({kind:'blast',x:clamp(G.px+j*115,-1400,1400),y:clamp(G.py+j*35,-1000,1000),r:70,delay:1.3+Math.abs(j)*.2,life:.55,damage:20});
   const a=Math.atan2(G.py-e.y,G.px-e.x);for(let j=-2;j<=2;j++){const b=a+j*.2,bullet=hostileBullet(e.x,e.y,Math.cos(b),Math.sin(b),245,15);if(bullet)bullet.invoice=true}
   notice('总监：需求回滚，急件三连！',2);
 }else{
   addHazard({kind:'ring',x:G.px,y:G.py,r:240,inner:140,delay:1.5,life:.75,damage:27});
   notice('老板画饼：躲进内圈，或者跑出外圈',2.5);
 }
 e.fire=2.8;return true;
}
