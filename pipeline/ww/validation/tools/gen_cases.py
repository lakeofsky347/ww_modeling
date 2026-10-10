#!/usr/bin/env python3
"""生成 validation/cases.json 的用例骨架（不含 expect）；expect 由 tools/ref_compute.js 填入。"""
import json, os
V = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def echoes(c1='Atk%', c3='elemDmg', crit='Crit'):
    return [{"cost": 4, "main": crit, "subs": [{"stat": "critDmg", "value": 0.162}, {"stat": "atkPct", "value": 0.086}, {"stat": "critRate", "value": 0.081}]},
            {"cost": 3, "main": c3}, {"cost": 3, "main": c3}, {"cost": 1, "main": c1}, {"cost": 1, "main": c1}]
W = {1: 21010023, 2: 21020023, 3: 21030023, 4: 21040023, 5: 21050023}  # 源能·测系列：被动只有回血，不带伤害增益
def mem(cid, wt, lv=90, **kw):
    m = {"id": cid, "level": lv, "chain": 0, "skillLevels": {"basic": 10, "skill": 10, "liberation": 10, "intro": 10, "forte": 10, "outro": 1},
         "weapon": {"id": W[wt], "level": 90, "rank": 1}, "echoes": kw.pop('echoes', echoes())}
    m.update(kw); return m
cases = [
 {"name": "C1 基线：今汐 R 两段，Lv90 对 Lv90，抗 10%", "isolates": ["base", "multiplier", "bonus", "crit", "defense", "resistance"],
  "team": [mem(1304, 1)], "probe": {"member": 0, "action": "R"}},
 {"name": "C2 无视防御+减防：长离 R，无视 15%、减防 10%", "isolates": ["defense(ignore/reduce)"],
  "team": [mem(1205, 2)], "enemy": {"level": 90, "resTier": 0.1, "defIgnore": 0.15, "defReduce": 0.10},
  "probe": {"member": 0, "action": "R"}},
 {"name": "C3 负抗：卡卡罗 R，敌 Lv100，减抗 30% → 有效 −20%", "isolates": ["resistance(<0)", "defense(enemy lv100)"],
  "team": [mem(1301, 1)], "enemy": {"level": 100, "resTier": 0.1, "resShred": 0.30},
  "probe": {"member": 0, "action": "R"}},
 {"name": "C4 高抗：散华 E，免疫档 100% 减抗 10% → 有效 90%", "isolates": ["resistance(>=0.8)"],
  "team": [mem(1102, 2)], "enemy": {"level": 90, "resTier": 1.0, "resShred": 0.10},
  "probe": {"member": 0, "action": "E"}},
 {"name": "C5 加深（攻击方同区）：折枝 E，全伤加深 15% + 技能加深 25%", "isolates": ["deepen(attacker, additive)"],
  "team": [mem(1105, 5)], "probe": {"member": 0, "action": "E", "extraStats": [{"key": "deep:all", "value": 0.15}, {"key": "deep:skill", "value": 0.25}]}},
 {"name": "C6 加深（攻击方+目标易伤）：今汐 R，加深 15% + 目标受伤加深 10%", "isolates": ["deepen(attacker+target)"],
  "note": "引擎没有单独的受击方键，按 MECHANICS §1『同区相加』写成 deep:all 0.25；参考 B 把 DMG Taken 拆成独立乘区",
  "team": [mem(1304, 1)], "probe": {"member": 0, "action": "R", "extraStats": [{"key": "deep:all", "value": 0.15}, {"key": "deep:all", "value": 0.10}]},
  "refSplit": {"amplify": 0.15, "taken": 0.10}},
 {"name": "C7 类型加成同区相加：相里要 R，解放伤害加成 +30%（叠在元素加成上）", "isolates": ["bonus(additive)"],
  "team": [mem(1305, 4)], "probe": {"member": 0, "action": "R", "extraStats": [{"key": "dmg:liberation", "value": 0.30}]}},
 {"name": "C8 生命缩放：守岸人 洞悉伤害（X3，HP×19.64%×3）", "isolates": ["base(HP scaling)"],
  "team": [mem(1505, 5, echoes=echoes(c1='LifeMax%', c3='LifeMax%'))], "probe": {"member": 0, "action": "X3"}},
 {"name": "C9 防御缩放：桃祈 R（DEF×449.71%）", "isolates": ["base(DEF scaling)"],
  "team": [mem(1601, 1, echoes=echoes(c1='Def%', c3='Def%'))], "probe": {"member": 0, "action": "R"}},
 {"name": "C10 攻击方等级：散华 R，角色 Lv80 对敌 Lv90", "isolates": ["defense(800+8·Lv攻)"],
  "team": [mem(1102, 2, lv=80)], "probe": {"member": 0, "action": "R"}},
]
doc = {"_说明": "交叉验证用例（validation/tools/gen_cases.py 生成，expect 由 tools/ref_compute.js 按参考计算器公式填入）。expect.expected 取 wuwa-tools 公式值；_ref 里同时列出两份参考的值。",
       "defaults": {"enemy": {"level": 90, "resTier": 0.1, "resShred": 0}, "mode": "expected", "conditionals": "off"},
       "cases": cases}
json.dump(doc, open(os.path.join(V, 'cases.draft.json'), 'w'), ensure_ascii=False, indent=1)
print('ok', len(cases))
