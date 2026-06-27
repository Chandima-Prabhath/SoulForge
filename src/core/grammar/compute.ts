/**
 * Skill computation helpers — pure functions over SkillDefinition.
 *
 * computeSkillStats: derives runtime stats from a skill's atom composition.
 * describeSkill: pretty-prints a skill for the grimoire / sharing codes.
 */

import type { SkillDefinition, SkillStats, ModifierId } from "./types";
import { ELEMENTS, FORMS, VECTORS, MODIFIERS } from "../../data/grammar";

export function computeSkillStats(skill: SkillDefinition): SkillStats {
  const element = ELEMENTS[skill.element];
  const form = FORMS[skill.form];
  const vector = VECTORS[skill.vector];

  let damageMult = element.damageMultiplier * vector.damageMultiplier;
  let cooldownMult = vector.cooldownMultiplier;
  let pierceCount = 0;
  let splitOnKill = false;
  let lingerDuration = 0;
  let chainCount = 0;
  let growWithDistance = false;

  for (const modId of skill.modifiers) {
    if (modId === null) continue;
    const mod = MODIFIERS[modId];
    damageMult *= mod.damageMultiplier;
    cooldownMult *= mod.cooldownMultiplier;
    switch (modId) {
      case 0: pierceCount = Math.floor(mod.magnitude); break;
      case 1: splitOnKill = true; break;
      case 2: lingerDuration = mod.magnitude; break;
      case 3: chainCount = Math.floor(mod.magnitude); break;
      case 4: growWithDistance = true; break;
    }
  }

  return {
    damage: form.baseDamage * damageMult,
    speed: form.baseSpeed,
    radius: form.baseRadius,
    cooldown: form.baseCooldown * cooldownMult,
    lifetime: form.baseLifetime,
    pierceCount,
    splitOnKill,
    lingerDuration,
    chainCount,
    growWithDistance,
    statusEffect: element.statusEffect,
    color: element.color,
    accentColor: element.accentColor,
  };
}

export function describeSkill(skill: SkillDefinition): string {
  const element = ELEMENTS[skill.element];
  const form = FORMS[skill.form];
  const vector = VECTORS[skill.vector];
  const mods = skill.modifiers
    .filter((m): m is ModifierId => m !== null)
    .map((m) => MODIFIERS[m].name);
  const modStr = mods.length > 0 ? ` + ${mods.join(" + ")}` : "";
  return `${element.name} ${form.name} (${vector.name})${modStr}`;
}
