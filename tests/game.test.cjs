const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function game(){
 const elements=new Map();const element=()=>({style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},setAttribute(){},setPointerCapture(){},querySelector(){return element()},querySelectorAll(){return[]},getBoundingClientRect(){return{left:0,top:0,width:1280,height:720}},getContext(){return{}},innerHTML:''});
 const document={querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s)},addEventListener(){}};
 const sandbox={document,window:{addEventListener(){}},navigator:{},Image:class{},requestAnimationFrame(){},console,Math};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('web/game.js','utf8')+'\nsound=()=>{};',sandbox);return code=>vm.runInContext(code,sandbox);
}
test('dash absorbs a hostile bullet, rewards aggressive movement, and prevents damage',()=>{const run=game();assert.ok(run(`reset();state='playing';G.moveX=1;dash();let initialCooldown=G.dash;let b={x:0,y:0,live:true};absorb(b);!b.live&&G.energy===62&&G.shield===3&&G.boost===2&&G.dash<initialCooldown&&G.inv>0`))});
test('overload clears a dense group, spends charge, and counts all kills',()=>{const run=game();assert.ok(run(`reset();state='playing';for(let i=0;i<30;i++)spawn('runner',100+i*3,0);G.energy=100;overload();G.lastBurst===30&&G.bestBurst===30&&G.energy===0&&G.hitStop>0&&G.beams.length===30`));assert.equal(run('overload();G.overloads'),1)});
test('missile upgrade creates homing projectiles rather than a damage multiplier',()=>{const run=game();assert.ok(run(`reset();state='playing';spawn('brute',200,0);G.up.damage=1;update(.016);G.shots.some(b=>b.missile)&&G.shots.some(b=>!b.missile&&b.damage===24)`))});
test('frost pierce slows a surviving enemy',()=>{const run=game();assert.ok(run(`reset();state='playing';spawn('brute',30,0);G.up.pierce=1;G.shots=[{x:20,y:0,vx:0,vy:0,t:1,pierce:1,hit:new Set(),damage:1}];update(.016);G.enemies[0].slow>0`))});
test('first upgrade offers three distinct builds and resumes when chosen',()=>{const run=game();assert.equal(run(`reset();state='playing';G.lvl=2;chooseUp();choiceSet.map(u=>u.id).join(',')`),'chain,damage,orbit');assert.ok(run(`pick(2);G.up.orbit===1&&state==='playing'`))});
test('death explosions and lightning propagate to adjacent enemies',()=>{const run=game();assert.ok(run(`reset();state='playing';G.up.bomb=1;G.up.chain=1;for(let i=0;i<8;i++)spawn('runner',i*12,0);hurtEnemy(G.enemies[0],100);G.kills===8&&G.beams.length>0`))});
test('paused state freezes simulation',()=>{const run=game();assert.equal(run(`reset();state='playing';pause();update(1);G.t`),0)});
test('a complete timed simulation spawns the boss, then boss death reaches victory',()=>{const run=game();assert.ok(run(`reset();state='playing';G.inv=999;G.shoot=999;for(let i=0;i<2800;i++)update(.045);G.boss&&G.enemies.some(e=>e.type==='boss'&&e.live)`));assert.ok(run(`hurtEnemy(G.enemies.find(e=>e.type==='boss'),100000);state==='paused'&&panel.innerHTML.includes('核心已击破')`))});
