import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputDirectory = mkdtempSync(
  path.join(projectDirectory, ".score-test-"),
);
const buildOutputDirectory = mkdtempSync(
  path.join(projectDirectory, ".extension-build-test-"),
);

try {
  compileScoreModules(outputDirectory);

  const require = createRequire(import.meta.url);
  const settingsModule = require(
    path.join(outputDirectory, "domain/score/customScoreSettings.js"),
  );
  const evaluator = require(
    path.join(outputDirectory, "domain/score/evaluatePriorityRoute.js"),
  );
  const idealEvaluator = require(
    path.join(outputDirectory, "domain/score/evaluateIdealRoute.js"),
  );
  const csvModule = require(path.join(outputDirectory, "csv/artifactCsv.js"));
  const qualityModule = require(
    path.join(outputDirectory, "domain/skill/inferTableRank.js"),
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
  assert.deepEqual(settings.tableRankPenalties, {
    a: 0,
    b: 1,
    c: 2,
    d: 3,
    e: 4,
  });
  assert.equal(
    settingsModule.validateTableRankPenalties(undefined),
    "Skill quality penalties are required.",
  );
  assert.equal(
    settingsModule.validateTableRankPenalties(settings.tableRankPenalties),
    null,
  );
  assert.notEqual(
    settingsModule.validateTableRankPenalties({
      a: 0,
      b: 2,
      c: 2,
      d: 1,
      e: 4,
    }),
    null,
  );
  assert.notEqual(
    settingsModule.validateTableRankPenalties({
      a: 26,
      b: 1,
      c: 2,
      d: 3,
      e: 4,
    }),
    null,
  );
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((quality) =>
      qualityModule.inferSkillQuality(quality),
    ),
    ["e", "d", "c", "b", "a"],
  );
  assert.equal(qualityModule.inferTableRank({ slot: 4, quality: 5 }), undefined);
  assert.deepEqual(
    settingsModule.withCustomScoreSettingsDefaults({
      tableRankPenalties: { a: 4, b: 3, c: 2, d: 1, e: 0 },
    }).tableRankPenalties,
    { a: 0, b: 1, c: 2, d: 3, e: 4 },
  );
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
      "a",
    ),
  ];
  const result = evaluator.evaluatePriorityRoute({ skills, settings });

  assert.equal(result.score, 54);
  assert.equal(
    evaluator.evaluatePriorityRoute({
      skills,
      settings,
      unwantedSkillConfig: { skillKeys: ["attack_power"] },
    }).score,
    54,
  );

  const wrongSlotSkills = structuredClone(skills);
  wrongSlotSkills[2] = createSkill(3, "攻撃力", "attack_power", "e");
  assert.equal(
    evaluator.evaluatePriorityRoute({ skills: wrongSlotSkills, settings }).score,
    39,
  );

  const lowScoreSettings = structuredClone(settings);
  setScore(lowScoreSettings.skillScores.firstSecondSlot, "attack_power", 2);
  assert.equal(
    evaluator.evaluatePriorityRoute({
      skills: [createSkill(1, "攻撃力", "attack_power", "e")],
      settings: lowScoreSettings,
    }).score,
    0,
  );

  const idealSettings = structuredClone(settings);
  idealSettings.idealSkillConfigurations[0].firstSecondSlotSkillKeys = [
    "attack_power",
    null,
  ];
  const artifact = {
    attribute: { raw: "1" },
    kind: { raw: "1" },
  };
  assert.equal(
    idealEvaluator.evaluateIdealRoute({
      artifact,
      skills: [createSkill(1, "攻撃力", "attack_power", "a")],
      settings: idealSettings,
    }).score,
    100,
  );

  idealSettings.idealSkillConfigurations[0].firstSecondSlotSkillKeys = [
    null,
    null,
  ];
  assert.equal(
    idealEvaluator.evaluateIdealRoute({
      artifact,
      skills: [createSkill(1, "攻撃力", "attack_power", "a")],
      settings: idealSettings,
    }).score,
    100,
  );

  const portableArtifact = {
    ownedId: 42,
    artifactTypeId: 7,
    name: 'Artifact, "Alpha"',
    rarity: 4,
    level: 1,
    maxLevel: 5,
    kind: { raw: "1", label: "kind-1" },
    attribute: { raw: "1", label: "火" },
    isLocked: true,
    isMarkedUnnecessaryInGame: false,
    userMark: "none",
    gameScore: { attack: 1, defense: 2, special: 3, total: 6 },
    customScore: null,
    skills: [],
    equippedCharacter: null,
    raw: { id: 42 },
    scannedAt: "2026-08-16T01:02:03.000Z",
  };
  const portableReview = {
    ownedId: 42,
    rating: 4,
    memo: "line 1\nline 2",
    updatedAt: "2026-08-16T01:03:00.000Z",
  };
  const portablePresence = {
    ownedId: 42,
    firstSeenAt: "2026-08-16T01:00:00.000Z",
    lastSeenAt: "2026-08-16T01:02:03.000Z",
    lastSeenSessionId: "session-1",
    isPossiblyDeleted: false,
  };
  const portableCsv = csvModule.convertArtifactRowsToCsv([
    {
      artifact: portableArtifact,
      review: portableReview,
      presence: portablePresence,
    },
  ]);
  assert.deepEqual(csvModule.parseArtifactRowsFromCsv(portableCsv), {
    artifacts: [portableArtifact],
    reviews: [portableReview],
    presence: [portablePresence],
  });
  assert.equal(
    csvModule.isImportedArtifactData({
      artifacts: [{ ...portableArtifact, attribute: undefined }],
      reviews: [],
      presence: [],
    }),
    false,
  );
  const portableSkill = {
    slot: 1,
    skillId: 10,
    quality: 1,
    level: 1,
    name: "攻撃力",
    isMaxQuality: false,
    effectValueText: "1%",
    parsedValue: { value: 1, unit: "percent" },
    iconImage: "",
    scoreCategory: "attack",
  };
  for (const invalidSkills of [
    [{ ...portableSkill, slot: "1" }],
    [portableSkill, { ...portableSkill, skillId: 11 }],
    [{ ...portableSkill, parsedValue: { value: "1", unit: "percent" } }],
  ]) {
    assert.equal(
      csvModule.isImportedArtifactData({
        artifacts: [{ ...portableArtifact, skills: invalidSkills }],
        reviews: [],
        presence: [],
      }),
      false,
    );
  }
  assert.equal(
    csvModule.isImportedArtifactData({
      artifacts: [{ ...portableArtifact, customScore: { total: 1 } }],
      reviews: [],
      presence: [],
    }),
    false,
  );
  assert.equal(
    csvModule.isImportedArtifactData({
      artifacts: [portableArtifact],
      reviews: [{ ...portableReview, rating: 999 }],
      presence: [portablePresence],
    }),
    false,
  );
  assert.throws(
    () => csvModule.parseArtifactRowsFromCsv("ownedId,name\r\n42,test"),
    /migration data/,
  );

  buildExtension(buildOutputDirectory);
  for (const htmlFile of ["sidepanel.html", "dashboard.html"]) {
    const html = readFileSync(path.join(buildOutputDirectory, htmlFile), "utf8");
    assert.equal(
      html.includes('rel="modulepreload"'),
      false,
      `${htmlFile} must not preload extension module chunks`,
    );
  }

  console.log("Score settings tests passed.");
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
  rmSync(buildOutputDirectory, { recursive: true, force: true });
}

function compileScoreModules(outputDirectory) {
  execFileSync(
    process.execPath,
    [
      path.join(projectDirectory, "node_modules/typescript/bin/tsc"),
      "--ignoreConfig",
      "src/domain/score/customScoreSettings.ts",
      "src/domain/score/evaluatePriorityRoute.ts",
      "src/domain/score/evaluateIdealRoute.ts",
      "src/csv/artifactCsv.ts",
      "src/domain/skill/inferTableRank.ts",
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

function buildExtension(outputDirectory) {
  execFileSync(
    process.execPath,
    [
      path.join(projectDirectory, "node_modules/vite/bin/vite.js"),
      "build",
      "--outDir",
      outputDirectory,
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
