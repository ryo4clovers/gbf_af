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
  const customEvaluator = require(
    path.join(outputDirectory, "domain/score/evaluateCustomScore.js"),
  );
  const scoreExplanation = require(
    path.join(outputDirectory, "domain/score/scoreExplanation.js"),
  );
  const artifactDataValidation = require(
    path.join(outputDirectory, "json/artifactDataValidation.js"),
  );
  const jsonModule = require(path.join(outputDirectory, "json/artifactJson.js"));
  const qualityModule = require(
    path.join(outputDirectory, "domain/skill/inferTableRank.js"),
  );
  const highlightSettingsModule = require(
    path.join(outputDirectory, "domain/skill/skillHighlightSettings.js"),
  );
  const artifactFiltersModule = require(
    path.join(outputDirectory, "dashboard/artifactFilters.js"),
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
  assert.equal(
    qualityModule.inferTableRank({ quality: 1, isMaxQuality: true }),
    "a",
  );
  assert.equal(
    qualityModule.inferTableRank({ quality: 1, isMaxQuality: false }),
    "e",
  );
  assert.equal(
    scoreExplanation.getTableRankPenalty(
      { slot: 4, tableRank: "a" },
      { a: 10, b: 10, c: 10, d: 10, e: 10 },
    ),
    0,
  );
  assert.equal(
    scoreExplanation.getTableRankPenalty(
      { slot: 1, tableRank: "a" },
      { a: 10, b: 10, c: 10, d: 10, e: 10 },
    ),
    0,
  );
  assert.deepEqual(
    settingsModule.withCustomScoreSettingsDefaults({
      tableRankPenalties: { a: 4, b: 3, c: 2, d: 1, e: 0 },
    }).tableRankPenalties,
    { a: 0, b: 1, c: 2, d: 3, e: 4 },
  );
  assert.deepEqual(
    highlightSettingsModule.normalizeSkillHighlightSettings({
      attack_power: "#FFF1A8",
      hp: "not-a-color",
      defense: 42,
    }),
    { attack_power: "#fff1a8" },
  );
  assert.deepEqual(
    highlightSettingsModule.normalizeSkillHighlightSettings(null),
    {},
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

  const quirkResult = customEvaluator.evaluateCustomScore({
    artifact: {
      ...artifact,
      skills: [],
      raw: { is_quirk: true },
    },
    settings,
  });
  assert.equal(quirkResult.total, 100);
  assert.equal(quirkResult.selectedRoute, "quirk");
  assert.deepEqual(quirkResult.reasons, [
    {
      type: "quirk",
      label: "クァーキーアーティファクト",
      delta: 100,
    },
  ]);

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
  const artifactJson = jsonModule.createArtifactJson(
    {
      artifacts: [portableArtifact],
      reviews: [portableReview],
      presence: [portablePresence],
    },
    "2026-08-16T01:04:00.000Z",
  );
  assert.deepEqual(jsonModule.parseArtifactJson(artifactJson), {
    format: "gbf-af-manager",
    version: 1,
    exportedAt: "2026-08-16T01:04:00.000Z",
    artifacts: [portableArtifact],
    reviews: [portableReview],
    presence: [portablePresence],
  });
  assert.throws(
    () =>
      jsonModule.parseArtifactJson(
        JSON.stringify({
          ...JSON.parse(artifactJson),
          version: 999,
        }),
      ),
    /未対応のJSONバージョン/,
  );
  assert.throws(() => jsonModule.parseArtifactJson("not-json"), /JSONの形式/);
  assert.equal(
    artifactDataValidation.isImportedArtifactData({
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
  const filterArtifact = {
    ...portableArtifact,
    skills: [
      { ...portableSkill, skillId: 10011 },
      {
        ...portableSkill,
        slot: 3,
        skillId: 30131,
        name: "通常攻撃ダメージ上限",
      },
    ],
  };
  const artifactFilters = artifactFiltersModule.createDefaultArtifactFilters();
  artifactFilters.scoreRange = [40, 90];
  artifactFilters.ratingRange = [2, 4];
  artifactFilters.skillConditions[0].firstSecondSlotKeys = [
    "attack_power",
    "hp",
  ];
  artifactFilters.skillConditions[1].thirdSlotKeys = [
    "normal_attack_damage_cap",
  ];
  assert.equal(
    artifactFiltersModule.matchesArtifactFilters(
      {
        artifact: filterArtifact,
        customScore: 70,
        rating: 3,
        isPossiblyDeleted: false,
      },
      artifactFilters,
    ),
    true,
  );
  assert.equal(
    artifactFiltersModule.matchesArtifactFilters(
      {
        artifact: filterArtifact,
        customScore: 91,
        rating: 3,
        isPossiblyDeleted: false,
      },
      artifactFilters,
    ),
    false,
  );
  artifactFilters.skillConditions[1].thirdSlotKeys = ["ability_damage_cap"];
  assert.equal(
    artifactFiltersModule.matchesArtifactFilters(
      {
        artifact: filterArtifact,
        customScore: 70,
        rating: 3,
        isPossiblyDeleted: false,
      },
      artifactFilters,
    ),
    false,
  );
  for (const invalidSkills of [
    [{ ...portableSkill, slot: "1" }],
    [portableSkill, { ...portableSkill, skillId: 11 }],
    [{ ...portableSkill, parsedValue: { value: "1", unit: "percent" } }],
  ]) {
    assert.equal(
      artifactDataValidation.isImportedArtifactData({
        artifacts: [{ ...portableArtifact, skills: invalidSkills }],
        reviews: [],
        presence: [],
      }),
      false,
    );
  }
  assert.equal(
    artifactDataValidation.isImportedArtifactData({
      artifacts: [{ ...portableArtifact, customScore: { total: 1 } }],
      reviews: [],
      presence: [],
    }),
    false,
  );
  assert.equal(
    artifactDataValidation.isImportedArtifactData({
      artifacts: [portableArtifact],
      reviews: [{ ...portableReview, rating: 999 }],
      presence: [portablePresence],
    }),
    false,
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
      "src/domain/score/evaluateCustomScore.ts",
      "src/json/artifactDataValidation.ts",
      "src/json/artifactJson.ts",
      "src/domain/skill/inferTableRank.ts",
      "src/domain/skill/skillHighlightSettings.ts",
      "src/dashboard/artifactFilters.ts",
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
