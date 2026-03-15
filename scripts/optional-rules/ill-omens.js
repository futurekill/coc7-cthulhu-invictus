/**
 * Ill Omens Optional Rule
 *
 * Before any significant action, investigators may consult omens
 * (voluntarily or as required by the Keeper). A successful Augury or
 * Science (Augury) roll reveals whether the omens are:
 *   Favorable  → Bonus Die to all rolls for the encounter
 *   Neutral    → No effect
 *   Unfavorable → Penalty Die to all rolls for the encounter
 *
 * Investigators who act against an augur's proclamation make a 0/1
 * Sanity check.
 *
 * Implementation: A world setting toggle. When active, a /omen chat command
 * triggers the Omen roll workflow. The result creates a temporary Active
 * Effect on the party with the appropriate die modifier.
 */

import { MODULE_ID } from '../main.js';
import { getSetting } from '../settings.js';

// ── Constants ───────────────────────────────────────────────────────────────

export const OMEN_RESULTS = {
  FAVORABLE: 'favorable',
  NEUTRAL: 'neutral',
  UNFAVORABLE: 'unfavorable'
};

const OMEN_CONFIG = {
  [OMEN_RESULTS.FAVORABLE]: {
    label: 'INVICTUS.Omens.Favorable',
    icon: 'modules/coc7-cthulhu-invictus/assets/icons/effects/omen-favorable.webp',
    description: 'INVICTUS.Omens.FavorableDesc',
    modifier: 'bonus'
  },
  [OMEN_RESULTS.NEUTRAL]: {
    label: 'INVICTUS.Omens.Neutral',
    icon: 'modules/coc7-cthulhu-invictus/assets/icons/effects/omen-neutral.webp',
    description: 'INVICTUS.Omens.NeutralDesc',
    modifier: null
  },
  [OMEN_RESULTS.UNFAVORABLE]: {
    label: 'INVICTUS.Omens.Unfavorable',
    icon: 'modules/coc7-cthulhu-invictus/assets/icons/effects/omen-unfavorable.webp',
    description: 'INVICTUS.Omens.UnfavorableDesc',
    modifier: 'penalty'
  }
};

// Thematic flavour text pools
const OMEN_FLAVOURS = {
  [OMEN_RESULTS.FAVORABLE]: [
    'An eagle soars from east to west — the gods smile upon this endeavour.',
    'The sacred chickens eat with vigour. The omens are auspicious.',
    'Lightning strikes the far hill on the left — Jupiter signals his favour.',
    'The entrails show a perfect liver. Fortune beckons.'
  ],
  [OMEN_RESULTS.NEUTRAL]: [
    'The birds fly without pattern. The gods are silent on this matter.',
    'The entrails reveal nothing of note. The outcome rests with mortals.',
    'Clouds obscure the sky. The signs are unclear.',
    'The sacred chickens peck indifferently. No omen presents itself.'
  ],
  [OMEN_RESULTS.UNFAVORABLE]: [
    'A crow cries thrice from the north — an ill portent.',
    'The liver is spotted and malformed. Disaster looms.',
    'Thunder rolls from the right. Jupiter warns against this course.',
    'The sacred chickens refuse to eat. The gods forbid this action.'
  ]
};

// ── Registration ────────────────────────────────────────────────────────────

export function registerIllOmensHooks() {
  if (!getSetting('optionalIllOmens')) {
    console.log(`${MODULE_ID} | Ill Omens rule disabled`);
    return;
  }

  console.log(`${MODULE_ID} | Ill Omens rule hooks registered`);

  // Register /omen chat command
  Hooks.on('chatMessage', (chatLog, messageText, chatData) => {
    if (!getSetting('optionalIllOmens')) return true;
    const match = messageText.match(/^\/omen\s*(.*)/i);
    if (!match) return true;
    _handleOmenCommand(match[1]?.trim());
    return false;
  });
}

// ── Command Handler ─────────────────────────────────────────────────────────

async function _handleOmenCommand(actorName) {
  let augur;
  if (actorName) {
    augur = game.actors.getName(actorName);
  } else {
    const speaker = ChatMessage.getSpeaker();
    augur = game.actors.get(speaker.actor);
  }

  if (!augur) {
    ui.notifications.warn(game.i18n.localize('INVICTUS.Omens.NoAugur'));
    return;
  }

  await consultOmens(augur);
}

// ── Core Workflow ───────────────────────────────────────────────────────────

/**
 * Perform an omen consultation. Rolls Science (Augury) and determines result.
 * @param {Actor} augur - The character reading the omens.
 * @param {Actor[]} [targets] - Actors to receive the Active Effect.
 * @returns {string} The omen result key.
 */
export async function consultOmens(augur, targets) {
  const augurSkill = augur.items?.find(i =>
    i.type === 'skill' && (
      i.name.toLowerCase().includes('augury') ||
      i.name.toLowerCase().includes('science (augury)')
    )
  );
  const skillValue = augurSkill?.system?.value ?? augurSkill?.system?.base ?? 1;

  // Skill roll
  const roll = await new Roll('1d100').evaluate();
  const success = roll.total <= skillValue;

  let result;
  if (!success) {
    result = OMEN_RESULTS.NEUTRAL;
  } else {
    const omenRoll = await new Roll('1d6').evaluate();
    const extreme = Math.floor(skillValue / 5);
    const hard = Math.floor(skillValue / 2);

    if (roll.total <= extreme) {
      result = OMEN_RESULTS.FAVORABLE;
    } else if (roll.total <= hard) {
      result = omenRoll.total <= 3 ? OMEN_RESULTS.FAVORABLE : OMEN_RESULTS.NEUTRAL;
    } else {
      if (omenRoll.total <= 2) result = OMEN_RESULTS.FAVORABLE;
      else if (omenRoll.total <= 4) result = OMEN_RESULTS.NEUTRAL;
      else result = OMEN_RESULTS.UNFAVORABLE;
    }
  }

  const config = OMEN_CONFIG[result];
  const flavour = _randomFlavour(result);

  // Post result to chat
  ChatMessage.create({
    content: `<div class="invictus-omen-result invictus-omen-${result}">
      <h3>${game.i18n.localize('INVICTUS.Omens.Title')}</h3>
      <p class="invictus-omen-flavour"><em>${flavour}</em></p>
      <p><strong>${game.i18n.localize(config.label)}</strong>
        — ${game.i18n.localize(config.description)}</p>
      <p class="invictus-omen-roll">${augur.name}: rolled ${roll.total}
        vs. ${skillValue} (Science: Augury)</p>
    </div>`,
    speaker: ChatMessage.getSpeaker({ actor: augur }),
    rolls: [roll]
  });

  // Apply Active Effect
  if (config.modifier) {
    const effectTargets = targets ?? _getPartyActors();
    for (const actor of effectTargets) {
      await _applyOmenEffect(actor, result);
    }
  }

  return result;
}

// ── Effect Management ───────────────────────────────────────────────────────

async function _applyOmenEffect(actor, result) {
  const config = OMEN_CONFIG[result];
  if (!config?.modifier) return;

  // Remove existing omen
  const existing = actor.effects.find(e => e.getFlag(MODULE_ID, 'isOmen'));
  if (existing) await existing.delete();

  await actor.createEmbeddedDocuments('ActiveEffect', [{
    name: game.i18n.localize(config.label),
    icon: config.icon,
    flags: {
      [MODULE_ID]: {
        isOmen: true,
        omenResult: result,
        appliedTime: game.time.worldTime
      }
    },
    changes: [{
      key: `flags.${MODULE_ID}.omenModifier`,
      mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
      value: config.modifier,
      priority: 20
    }],
    disabled: false,
    transfer: false
  }]);
}

/**
 * Remove omen effects from an actor.
 * @param {Actor} actor
 */
export async function clearOmenEffect(actor) {
  const omenEffect = actor.effects.find(e => e.getFlag(MODULE_ID, 'isOmen'));
  if (omenEffect) await omenEffect.delete();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function _randomFlavour(result) {
  const pool = OMEN_FLAVOURS[result] ?? OMEN_FLAVOURS[OMEN_RESULTS.NEUTRAL];
  return pool[Math.floor(Math.random() * pool.length)];
}

function _getPartyActors() {
  return game.actors.filter(a => a.type === 'character' && a.hasPlayerOwner);
}
