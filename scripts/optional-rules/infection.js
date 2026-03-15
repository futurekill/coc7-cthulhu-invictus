/**
 * Infection Optional Rule
 *
 * When enabled, wounds from battle carry a risk of infection.
 * Any Major Wound triggers a CON check after 24 in-game hours.
 * On failure, the wound is infected. Infection has three severity stages:
 *   Mild    → –1 HP/day, –5% to physical skills
 *   Severe  → –2 HP/day, –10% to all skills, fever (–20% CON for recovery)
 *   Fatal   → –3 HP/day, unconscious if untreated within 48 hours, death
 *
 * Treatment requires a Medicine roll with period-appropriate tools.
 * Each stage has an increasing difficulty threshold.
 *
 * Implementation hooks into CoC7's wound creation events and creates
 * Active Effects that track infection stage and remaining duration.
 */

import { MODULE_ID } from '../main.js';
import { getSetting } from '../settings.js';

// ── Constants ───────────────────────────────────────────────────────────────

export const INFECTION_STAGES = {
  NONE: 'none',
  MILD: 'mild',
  SEVERE: 'severe',
  FATAL: 'fatal'
};

const INFECTION_EFFECTS = {
  [INFECTION_STAGES.MILD]: {
    label: 'INVICTUS.Infection.Mild',
    icon: 'modules/coc7-cthulhu-invictus/assets/icons/effects/infection-mild.webp',
    hpLossPerDay: 1,
    skillPenalty: 5,
    physicalOnly: true,
    medicineDifficulty: 'regular',    // Regular difficulty
    daysUntilProgression: 3
  },
  [INFECTION_STAGES.SEVERE]: {
    label: 'INVICTUS.Infection.Severe',
    icon: 'modules/coc7-cthulhu-invictus/assets/icons/effects/infection-severe.webp',
    hpLossPerDay: 2,
    skillPenalty: 10,
    physicalOnly: false,
    medicineDifficulty: 'hard',       // Hard difficulty
    daysUntilProgression: 2
  },
  [INFECTION_STAGES.FATAL]: {
    label: 'INVICTUS.Infection.Fatal',
    icon: 'modules/coc7-cthulhu-invictus/assets/icons/effects/infection-fatal.webp',
    hpLossPerDay: 3,
    skillPenalty: 20,
    physicalOnly: false,
    medicineDifficulty: 'extreme',    // Extreme difficulty
    daysUntilProgression: null        // Does not progress — death
  }
};

// ── Registration ────────────────────────────────────────────────────────────

/**
 * Register hooks for the Infection rule.
 * Called from main.js during module initialisation.
 */
export function registerInfectionHooks() {
  if (!getSetting('optionalInfection')) {
    console.log(`${MODULE_ID} | Infection rule disabled`);
    return;
  }

  console.log(`${MODULE_ID} | Infection rule hooks registered`);

  // Hook into CoC7's wound creation — trigger infection check for Major Wounds
  Hooks.on('createActiveEffect', async (effect, options, userId) => {
    if (game.userId !== userId) return;
    if (!getSetting('optionalInfection')) return;

    // Detect Major Wound effects from the CoC7 system
    const isMajorWound = _isMajorWound(effect);
    if (!isMajorWound) return;

    const actor = effect.parent;
    if (!actor || actor.type !== 'character') return;

    // Schedule infection check — post notification to chat
    await _scheduleInfectionCheck(actor, effect);
  });

  // Hook into world time updates to process infection progression
  Hooks.on('updateWorldTime', async (worldTime, dt) => {
    if (!game.user.isGM) return;
    if (!getSetting('optionalInfection')) return;
    await _processInfectionTimers(worldTime, dt);
  });
}

// ── Detection ───────────────────────────────────────────────────────────────

/**
 * Detect if an Active Effect represents a CoC7 Major Wound.
 * @param {ActiveEffect} effect
 * @returns {boolean}
 */
function _isMajorWound(effect) {
  const label = (effect.name ?? effect.label ?? '').toLowerCase();
  const flags = effect.flags ?? {};

  // Check CoC7-specific flags for major wound
  if (flags.CoC7?.majorWound) return true;
  if (flags.CoC7?.type === 'majorWound') return true;

  // Fallback: check label patterns
  if (label.includes('major wound') || label.includes('major_wound')) return true;

  return false;
}

// ── Scheduling ──────────────────────────────────────────────────────────────

/**
 * Schedule an infection check for 24 in-game hours after a Major Wound.
 * @param {Actor} actor - The wounded character.
 * @param {ActiveEffect} woundEffect - The Major Wound effect.
 */
async function _scheduleInfectionCheck(actor, woundEffect) {
  const checkTime = game.time.worldTime + (24 * 60 * 60); // 24 hours in seconds

  // Store the pending infection check as a flag on the actor
  const pendingChecks = actor.getFlag(MODULE_ID, 'pendingInfectionChecks') ?? [];
  pendingChecks.push({
    id: foundry.utils.randomID(),
    woundEffectId: woundEffect.id,
    scheduledTime: checkTime,
    resolved: false
  });
  await actor.setFlag(MODULE_ID, 'pendingInfectionChecks', pendingChecks);

  // Notify the Keeper
  const msg = game.i18n.format('INVICTUS.Infection.Scheduled', {
    name: actor.name,
    hours: 24
  });
  ChatMessage.create({
    content: `<div class="invictus-infection-notice">
      <h4>${game.i18n.localize('INVICTUS.Infection.Title')}</h4>
      <p>${msg}</p>
      <p><em>${game.i18n.localize('INVICTUS.Infection.ScheduledHint')}</em></p>
    </div>`,
    whisper: ChatMessage.getWhisperRecipients('GM'),
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

// ── Timer Processing ────────────────────────────────────────────────────────

/**
 * Process all pending infection timers when world time advances.
 * @param {number} worldTime - Current world time in seconds.
 * @param {number} dt - Time delta in seconds.
 */
async function _processInfectionTimers(worldTime, dt) {
  for (const actor of game.actors) {
    if (actor.type !== 'character') continue;

    const pendingChecks = actor.getFlag(MODULE_ID, 'pendingInfectionChecks') ?? [];
    let changed = false;

    for (const check of pendingChecks) {
      if (check.resolved) continue;
      if (worldTime < check.scheduledTime) continue;

      // Time's up — trigger the CON check
      check.resolved = true;
      changed = true;
      await _triggerInfectionCheck(actor, check);
    }

    // Also process active infections for progression
    await _processActiveInfections(actor, worldTime, dt);

    if (changed) {
      await actor.setFlag(MODULE_ID, 'pendingInfectionChecks', pendingChecks);
    }
  }
}

// ── CON Check ───────────────────────────────────────────────────────────────

/**
 * Trigger a CON check to determine if a wound becomes infected.
 * @param {Actor} actor - The character.
 * @param {object} check - The pending check data.
 */
async function _triggerInfectionCheck(actor, check) {
  const con = actor.system?.characteristics?.con?.value ?? 50;
  const roll = await new Roll('1d100').evaluate();
  const success = roll.total <= con;

  if (success) {
    // Wound heals cleanly
    ChatMessage.create({
      content: `<div class="invictus-infection-notice invictus-infection-clear">
        <h4>${game.i18n.localize('INVICTUS.Infection.Title')}</h4>
        <p>${game.i18n.format('INVICTUS.Infection.Clear', { name: actor.name })}</p>
        <p>${game.i18n.format('INVICTUS.Infection.RollResult', { roll: roll.total, target: con })}</p>
      </div>`,
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [roll]
    });
  } else {
    // Infection begins at Mild stage
    await _applyInfection(actor, INFECTION_STAGES.MILD);

    ChatMessage.create({
      content: `<div class="invictus-infection-notice invictus-infection-infected">
        <h4>${game.i18n.localize('INVICTUS.Infection.Title')}</h4>
        <p>${game.i18n.format('INVICTUS.Infection.Infected', { name: actor.name })}</p>
        <p>${game.i18n.format('INVICTUS.Infection.RollResult', { roll: roll.total, target: con })}</p>
        <p><strong>${game.i18n.localize('INVICTUS.Infection.MildDesc')}</strong></p>
      </div>`,
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [roll]
    });
  }
}

// ── Active Effect Management ────────────────────────────────────────────────

/**
 * Apply an infection Active Effect to an actor.
 * @param {Actor} actor
 * @param {string} stage - One of INFECTION_STAGES values.
 */
async function _applyInfection(actor, stage) {
  const config = INFECTION_EFFECTS[stage];
  if (!config) return;

  // Remove any existing infection effect first
  const existing = actor.effects.find(e => e.getFlag(MODULE_ID, 'isInfection'));
  if (existing) await existing.delete();

  // Create the new infection effect
  const effectData = {
    name: game.i18n.localize(config.label),
    icon: config.icon,
    flags: {
      [MODULE_ID]: {
        isInfection: true,
        infectionStage: stage,
        appliedTime: game.time.worldTime,
        lastHpLossTime: game.time.worldTime
      }
    },
    changes: [],
    disabled: false,
    transfer: false
  };

  // Add skill penalty as a change (if the CoC7 system supports it)
  // This is a placeholder — actual implementation depends on CoC7's Active Effect handling
  if (config.skillPenalty > 0) {
    effectData.changes.push({
      key: `flags.${MODULE_ID}.skillPenalty`,
      mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
      value: config.skillPenalty,
      priority: 20
    });
  }

  await actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
}

/**
 * Process active infections for HP loss and stage progression.
 * @param {Actor} actor
 * @param {number} worldTime
 * @param {number} dt
 */
async function _processActiveInfections(actor, worldTime, dt) {
  const infectionEffect = actor.effects.find(e => e.getFlag(MODULE_ID, 'isInfection'));
  if (!infectionEffect) return;

  const stage = infectionEffect.getFlag(MODULE_ID, 'infectionStage');
  const config = INFECTION_EFFECTS[stage];
  if (!config) return;

  const lastLossTime = infectionEffect.getFlag(MODULE_ID, 'lastHpLossTime') ?? worldTime;
  const appliedTime = infectionEffect.getFlag(MODULE_ID, 'appliedTime') ?? worldTime;
  const dayInSeconds = 24 * 60 * 60;

  // Check if a full day has passed since last HP loss
  if (worldTime - lastLossTime >= dayInSeconds) {
    const daysPassed = Math.floor((worldTime - lastLossTime) / dayInSeconds);
    const hpLoss = config.hpLossPerDay * daysPassed;

    // Apply HP loss
    const currentHp = actor.system?.attribs?.hp?.value ?? actor.system?.characteristics?.hp?.value ?? 0;
    const newHp = Math.max(0, currentHp - hpLoss);

    // Update actor HP (exact path depends on CoC7's data structure)
    await actor.update({ 'system.attribs.hp.value': newHp });
    await infectionEffect.setFlag(MODULE_ID, 'lastHpLossTime', worldTime);

    ChatMessage.create({
      content: `<div class="invictus-infection-notice">
        <p>${game.i18n.format('INVICTUS.Infection.HpLoss', {
          name: actor.name,
          loss: hpLoss,
          stage: game.i18n.localize(config.label)
        })}</p>
      </div>`,
      whisper: ChatMessage.getWhisperRecipients('GM'),
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }

  // Check for stage progression
  if (config.daysUntilProgression) {
    const totalDaysSinceApplied = (worldTime - appliedTime) / dayInSeconds;
    if (totalDaysSinceApplied >= config.daysUntilProgression) {
      const nextStage = _getNextStage(stage);
      if (nextStage) {
        await _applyInfection(actor, nextStage);
        ChatMessage.create({
          content: `<div class="invictus-infection-notice invictus-infection-progressed">
            <h4>${game.i18n.localize('INVICTUS.Infection.Title')}</h4>
            <p>${game.i18n.format('INVICTUS.Infection.Progressed', {
              name: actor.name,
              stage: game.i18n.localize(INFECTION_EFFECTS[nextStage].label)
            })}</p>
          </div>`,
          speaker: ChatMessage.getSpeaker({ actor })
        });
      }
    }
  }
}

/**
 * Get the next infection stage.
 * @param {string} current
 * @returns {string|null}
 */
function _getNextStage(current) {
  const order = [INFECTION_STAGES.MILD, INFECTION_STAGES.SEVERE, INFECTION_STAGES.FATAL];
  const idx = order.indexOf(current);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
}

// ── Treatment (Keeper-initiated) ────────────────────────────────────────────

/**
 * Attempt to treat an infection. Called via macro or chat command.
 * Requires a Medicine roll at the difficulty set by the infection stage.
 * @param {Actor} actor - The infected character.
 * @param {Actor} [healer] - The character administering treatment (optional).
 */
export async function treatInfection(actor, healer) {
  const infectionEffect = actor.effects.find(e => e.getFlag(MODULE_ID, 'isInfection'));
  if (!infectionEffect) {
    ui.notifications.info(game.i18n.format('INVICTUS.Infection.NotInfected', { name: actor.name }));
    return;
  }

  const stage = infectionEffect.getFlag(MODULE_ID, 'infectionStage');
  const config = INFECTION_EFFECTS[stage];

  // Post the treatment attempt to chat
  ChatMessage.create({
    content: `<div class="invictus-infection-notice">
      <h4>${game.i18n.localize('INVICTUS.Infection.TreatmentTitle')}</h4>
      <p>${game.i18n.format('INVICTUS.Infection.TreatmentAttempt', {
        name: actor.name,
        stage: game.i18n.localize(config.label),
        difficulty: config.medicineDifficulty
      })}</p>
      <p><em>${game.i18n.localize('INVICTUS.Infection.TreatmentRollHint')}</em></p>
    </div>`,
    speaker: ChatMessage.getSpeaker({ actor: healer ?? actor })
  });

  // Note: The actual Medicine roll should be handled through CoC7's
  // skill roll system. The Keeper evaluates the result and then calls
  // resolveInfectionTreatment() with the outcome.
}

/**
 * Resolve the outcome of an infection treatment.
 * @param {Actor} actor
 * @param {boolean} success - Whether the Medicine roll succeeded.
 */
export async function resolveInfectionTreatment(actor, success) {
  if (success) {
    // Remove infection on successful treatment
    const infectionEffect = actor.effects.find(e => e.getFlag(MODULE_ID, 'isInfection'));
    if (infectionEffect) {
      await infectionEffect.delete();
    }

    ChatMessage.create({
      content: `<div class="invictus-infection-notice invictus-infection-clear">
        <h4>${game.i18n.localize('INVICTUS.Infection.Title')}</h4>
        <p>${game.i18n.format('INVICTUS.Infection.Treated', { name: actor.name })}</p>
      </div>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  } else {
    ChatMessage.create({
      content: `<div class="invictus-infection-notice">
        <p>${game.i18n.format('INVICTUS.Infection.TreatmentFailed', { name: actor.name })}</p>
      </div>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }
}
