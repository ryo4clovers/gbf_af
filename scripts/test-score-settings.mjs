import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputDirectory = mkdtempSync(path.join(tmpdir(), "gbf-af-score-test-"));

try {
  compileScoreModules(outputDirectory);

  const require = createRequire(import.meta.url);
  const settingsModule = require(
    path.join(outputDirectory, "score/customScoreSettings.js"),
  );
  const evaluator = require(
    path.join(outputDirectory, "score/evaluatePriorityRoute.js"),
  );
  const settings = settingsModule.withCustomScoreSettingsDefaults({
    idealSkillKeys: [],
    idealMatchScores: { 1: 0, 2: 0, 3: 75, 4: 100 },
    skillPriority: [
      { skillKey: "attack_power", rank: 1 },
      { skillKey: "normal_attack_damage_cap", rank: 4 },
    ],
    updatedAt: "legacy",
  });

  assert.deepEqual(
    Object.fromEntries(
      Object.entries(settings.skillScores).map(([key, entries]) => [
        key,
        entries.length,
      ]),
    ),
    { firstSecondSlot: 14, thirdSlot: 20, fourthSlot: 29 },
  );
  assert.equal(settingsModule.validateSkillScores(settings.skillScores), null);
  assert.equal(findScore(settings.skillScores.firstSecondSlot, "attack_power"), 25);
  assert.equal(
    findScore(settings.skillScores.thirdSlot, "normal_attack_damage_cap"),
    19,
  );

  const incompleteScores = structuredClone(settings.skillScores);
  incompleteScores.firstSecondSlot.pop();
  assert.notEqual(settingsModule.validateSkillScores(incompleteScores), null);

  const outOfRangeScores = structuredClone(settings.skillScores);
  outOfRangeScores.firstSecondSlot[0].score = 26;
  assert.notEqual(settingsModule.validateSkillScores(outOfRangeScores), null);

  setScore(settings.skillScores.firstSecondSlot, "hp", 10);
  setScore(
    settings.skillScores.fourthSlot,
    "debuff_ability_enemy_damage_taken_up",
    5,
  );
  const skills = [
    createSkill(1, "攻撃力", "attack_power", "a"),
    createSkill(2, "HP", "unknown_skill_id:20011", "b"),
    createSkill(
      3,
      "通常攻撃ダメージ上限",
      "normal_attack_damage_cap",
      "e",
    ),
    createSkill(
      4,
      "弱体アビリティ使用時、敵に被ダメージUP(2回)",
      "unknown_skill_id:50001",
    ),
  ];
  const result = evaluator.evaluatePriorityRoute({ skills, settings });

  assert.equal(result.score, 64.25);
  assert.equal(
    evaluator.evaluatePriorityRoute({
      skills,
      settings,
      unwantedSkillConfig: { skillKeys: ["attack_power"] },
    }).score,
    64.25,
  );

  const wrongSlotSkills = structuredClone(skills);
  wrongSlotSkills[2] = createSkill(3, "攻撃力", "attack_power", "e");
  assert.equal(
    evaluator.evaluatePriorityRoute({ skills: wrongSlotSkills, settings }).score,
    40.5,
  );

  console.log("Score settings tests passed.");
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}

function compileScoreModules(outputDirectory) {
  execFileSync(
    process.execPath,
    [
      path.join(projectDirectory, "node_modules/typescript/bin/tsc"),
      "--ignoreConfig",
      "src/domain/score/customScoreSettings.ts",
      "src/domain/score/evaluatePriorityRoute.ts",
      "--outDir",
      outputDirectory,
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--target",
      "ES2022",
      "--skipLibCheck",
      "--ignoreDeprecations",
      "6.0",
    ],
    { cwd: projectDirectory, stdio: "pipe" },
  );
}

function findScore(entries, skillKey) {
  return entries.find((entry) => entry.skillKey === skillKey)?.score;
}

function setScore(entries, skillKey, score) {
  const entry = entries.find((candidate) => candidate.skillKey === skillKey);
  assert.notEqual(entry, undefined);
  entry.score = score;
}

function createSkill(slot, rawName, normalizedKey, tableRank = undefined) {
  return {
    rawName,
    normalizedKey,
    slot,
    skillId: slot,
    level: 1,
    tableRank,
    category: "unknown",
  };
}
