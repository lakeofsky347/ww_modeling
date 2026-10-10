// 只读：打印候选角色的动作与命中（不修改引擎）
const E=require('../../engine/ww_engine.js');const fs=require('fs');
const data=JSON.parse(fs.readFileSync(__dirname+'/../../../out/ww.json','utf8'));const idx=E.indexData(data);
for(const id of process.argv.slice(2).map(Number)){
  const ctx=E.buildContext({team:[{id,level:90}],rotation:{mode:'manual',sequence:''}},idx);
  const m=ctx.members[0];const k=m.kit;
  console.log(`== ${id} ${m.name||''} base`,JSON.stringify(m.base));
  const show=(n,a)=>{if(!a)return;console.log(` ${n} ${a.name||''} lv${a.level}`);for(const h of a.hits)console.log(`    ${h.label} type=${h.type} sc=${h.scaling} el=${h.element} x${h.count||1} mv=${(h.multiplier[a.level-1]*100).toFixed(2)} ids=${(h.damageIds||[h.damageId]).join(',')} conf=${h.confidence}`)};
  k.stages.forEach((s,i)=>show('A'+(i+1),s));['H','E','R','I','O','Q'].forEach(x=>show(x,k[x]));
  k.extras.slice(0,40).forEach((x,i)=>show('X'+i,x));
}
