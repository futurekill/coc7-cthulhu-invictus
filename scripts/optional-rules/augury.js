/**
 * Augury (Full Rules) Optional Rule
 *
 * Expands simple augury into the full five-type system from Chapter 6:
 *
 *  1. Ex Caelo      — sky/lightning omens (Regular difficulty)
 *  2. Ex Avibus     — bird flight omens (Regular difficulty)
 *  3. Ex Tripudiis  — sacred fowl feeding (Hard difficulty)
 *  4. Ex Quadrupedibus — quadruped movement (Hard difficulty)
 *  5. Ex Diris      — catch-all portents (Extreme difficulty)
 *  6. Ex Infernis   — cultist-only dark ritual (Extreme; Keeper-only button)
 *
 * Each type uses a Science (Augury) roll at varying difficulties.
 * Available to any investigator with Science (Augury) > 0.
 * The Keeper selects the augury type via a workflow dialog; the system
 * rolls at appropriate difficulty and posts a thematic result to chat.
 */

import { MODULE_ID } from '../main.js';
import { getSetting } from '../settings.js';

// ── Constants ───────────────────────────────────────────────────────────────

export const AUGURY_TYPES = {
  EX_CAELO: 'exCaelo',
  EX_AVIBUS: 'exAvibus',
  EX_TRIPUDIIS: 'exTripudiis',
  EX_QUADRUPEDIBUS: 'exQuadrupedibus',
  EX_DIRIS: 'exDiris',
  EX_INFERNIS: 'exInfernis'
};

const AUGURY_CONFIG = {
  [AUGURY_TYPES.EX_CAELO]: {
    label: 'INVICTUS.Augury.ExCaelo',
    description: 'INVICTUS.Augury.ExCaeloDesc',
    difficulty: 'regular',     // Roll vs full skill
    multiplier: 1,
    keeperOnly: false,
    flavours: {
      success: [
        'A clear bolt of lightning splits the eastern sky — Jupiter has spoken.',
        'The clouds part to reveal a brilliant sun. The heavens give their blessing.',
        'A rainbow arcs across the sky after a sudden shower — a divine sign.'
      ],
      failure: [
        'The sky remains overcast and featureless. No sign presents itself.',
        'Distant thunder rumbles without direction. The message is unclear.'
      ]
    }
  },
  [AUGURY_TYPES.EX_AVIBUS]: {
    label: 'INVICTUS.Augury.ExAvibus',
    description: 'INVICTUS.Augury.ExAvibusDesc',
    difficulty: 'regular',
    multiplier: 1,
    keeperOnly: false,
    flavours: {
      success: [
        'An eagle circles thrice to the left, then soars eastward. The omen is clear.',
        'A flock of starlings forms a perfect column, pointing the way forward.',
        'Two ravens land on the shrine, facing the questioner. The birds have answered.'
      ],
      failure: [
        'The birds scatter in all directions. No pattern emerges.',
        'A lone crow sits motionless on a branch, offering nothing.'
      ]
    }
  },
  [AUGURY_TYPES.EX_TRIPUDIIS]: {
    label: 'INVICTUS.Augury.ExTripudiis',
    description: 'INVICTUS.Augury.ExTripudiisDesc',
    difficulty: 'hard',        // Roll vs half skill
    multiplier: 0.5,
    keeperOnly: false,
    flavours: {
      success: [
        'The sacred chickens devour the grain eagerly, scattering crumbs — a tripudium solistimum! The finest omen.',
        'The chickens eat so quickly the grain falls from their beaks. The gods approve.',
      ],
      failure: [
        'The sacred chickens refuse to eat. A dire warning.',
        'The chickens peck half-heartedly, then wander away. The sign is ambiguous.'
      ]
    }
  },
  [AUGURY_TYPES.EX_QUADRUPEDIBUS]: {
    label: 'INVICTUS.Augury.ExQuadrupedibus',
    description: 'INVICTUS.Augury.ExQuadrupedibusDesc',
    difficulty: 'hard',
    multiplier: 0.5,
    keeperOnly: false,
    flavours: {
      success: [
        'A white mare approaches unbidden and stamps her hoof three times. The sign is unmistakable.',
        'A fox crosses the road from left to right — the four-legged messenger speaks clearly.',
      ],
      failure: [
        'The animals graze peacefully, showing no sign of supernatural awareness.',
        'A dog howls in the distance, but the meaning is lost.'
      ]
    }
  },
  [AUGURY_TYPES.EX_DIRIS]: {
    label: 'INVICTUS.Augury.ExDiris',
    description: 'INVICTUS.Augury.ExDirisDesc',
    difficulty: 'extreme',     // Roll vs fifth of skill
    multiplier: 0.2,
    keeperOnly: false,
    flavours: {
      success: [
        'A perfectly preserved butterfly lands on the ritual stone — its wings display a pattern that answers the question.',
        'The flame flickers in a windless room, bending toward the east. The meaning crystallises in the augur\'s mind.',
      ],
      failure: [
        'The signs are contradictory and confusing. Even the gods seem uncertain.',
        'Nothing unusual occurs. The catch-all has caught nothing.'
      ]
    }
  },
  [AUGURY_TYPES.EX_INFERNIS]: {
    label: 'INVICTUS.Augury.ExInfernis',
    description: 'INVICTUS.Augury.ExInfernisDesc',
    difficulty: 'extreme',
    multiplier: 0.2,
    keeperOnly: true,          // Only visible to Keeper
    flavours: {
      success: [
        'The black candles flare green as the blood offering is consumed. Visions of impossible geometry flood the augur\'s mind.',
        'The ritual circle smoulders. A voice that is not a voice whispers the answer from the spaces between the stars.',
      ],
      failure: [
        'The ritual components crumble to ash without effect. The dark powers are silent — for now.',
        'Something stirs at the edge of perception but retreats before manifesting. The price was insufficient.'
      ]
    }
  }
};

// ── Registration ────────────────────────────────────────────────────────────

export function registerAuguryHooks() {
  if (!getSetting('optionalAugury')) {
    console.log(`${MODULE_ID} | Augury (full rules) disabled`);
    return;
  }

  console.log(`${MODULE_ID} | Augury (full rules) hooks registered`);

  // Register /augury chat command
  Hooks.on('chatMessage', (chatLog, messageText, chatData) => {
    if (!getSetting('optionalAugury')) return true;
    const match = messageText.match(/^\/augury\s*(.*)/i);
    if (!match) return true;
    _showAuguryDialog();
    return false;
  });
}

// ── Workflow Dialog ─────────────────────────────────────────────────────────

/**
 * Display the Augury type selection dialog for the Keeper.
 */
async function _showAuguryDialog() {
  const isGM = game.user.isGM;

  // Build augury type options
  const typeOptions = Object.entries(AUGURY_CONFIG)
    .filter(([key, config]) => !config.keeperOnly || isGM)
    .map(([key, config]) => {
      const label = game.i18n.localize(config.label);
      const diff = config.difficulty.charAt(0).toUpperCase() + config.difficulty.slice(1);
      return `<option value="${key}">${label} (${diff})</option>`;
    })
    .join('');

  // Build actor options (characters with Science: Augury)
  const actorOptions = game.actors
    .filter(a => a.type === 'character')
    .map(a => `<option value="${a.id}">${a.name}</option>`)
    .join('');

  const content = `
    <form class="invictus-augury-dialog">
      <div class="form-group">
        <label>${game.i18n.localize('INVICTUS.Augury.SelectAugur')}</label>
        <select name="actorId">${actorOptions}</select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize('INVICTUS.Augury.SelectType')}</label>
        <select name="auguryType">${typeOptions}</select>
      </div>
    </form>`;

  const result = await Dialog.prompt({
    title: game.i18n.localize('INVICTUS.Augury.DialogTitle'),
    content,
    label: game.i18n.localize('INVICTUS.Augury.PerformAugury'),
    callback: (html) => {
      const form = html instanceof jQuery ? html[0] : html;
      return {
        actorId: form.querySelector('[name="actorId"]').value,
        auguryType: form.querySelector('[name="auguryType"]').value
      };
    }
  });

  if (result) {
    const actor = game.actors.get(result.actorId);
    if (actor) {
      await performAugury(actor, result.auguryType);
    }
  }
}

// ── Core Augury Roll ────────────────────────────────────────────────────────

/**
 * Perform a full augury of the specified type.
 * @param {Actor} augur - The character performing the augury.
 * @param {string} type - One of AUGURY_TYPES values.
 * @returns {object} The augury result.
 */
export async function performAugury(augur, type) {
  const config = AUGURY_CONFIG[type];
  if (!config) {
    ui.notifications.error('Unknown augury type');
    return null;
  }

  // Find Science (Augury) skill
  const augurSkill = augur.items?.find(i =>
    i.type === 'skill' && (
      i.name.toLowerCase().includes('augury') ||
      i.name.toLowerCase().includes('science (augury)')
    )
  );
  const baseSkill = augurSkill?.system?.value ?? augurSkill?.system?.base ?? 1;
  const targetNumber = Math.floor(baseSkill * config.multiplier);

  // Roll
  const roll = await new Roll('1d100').evaluate();
  const success = roll.total <= targetNumber;
  const critical = roll.total === 1;
  const fumble = roll.total >= 96;

  // Select flavour text
  const flavourPool = success ? config.flavours.success : config.flavours.failure;
  const flavour = flavourPool[Math.floor(Math.random() * flavourPool.length)];

  // Build the result
  const resultData = {
    type,
    success,
    critical,
    fumble,
    roll: roll.total,
    target: targetNumber,
    skillBase: baseSkill,
    difficulty: config.difficulty
  };

  // Additional effects for Ex Infernis
  let exInfernisNote = '';
  if (type === AUGURY_TYPES.EX_INFERNIS) {
    if (fumble) {
      exInfernisNote = `<p class="invictus-augury-warning"><strong>${
        game.i18n.localize('INVICTUS.Augury.ExInfernisFumble')
      }</strong></p>`;
    }
    // SAN cost for dark ritual
    exInfernisNote += `<p><em>${game.i18n.localize('INVICTUS.Augury.ExInfernisSanCost')}</em></p>`;
  }

  // Post to chat
  const label = game.i18n.localize(config.label);
  const resultLabel = success
    ? (critical ? game.i18n.localize('INVICTUS.Augury.Critical') : game.i18n.localize('INVICTUS.Augury.Success'))
    : (fumble ? game.i18n.localize('INVICTUS.Augury.Fumble') : game.i18n.localize('INVICTUS.Augury.Failure'));

  ChatMessage.create({
    content: `<div class="invictus-augury-result invictus-augury-${success ? 'success' : 'failure'}">
      <h3>${game.i18n.localize('INVICTUS.Augury.Title')}: ${label}</h3>
      <p class="invictus-augury-flavour"><em>${flavour}</em></p>
      <p><strong>${resultLabel}</strong></p>
      <p>${game.i18n.localize(config.description)}</p>
      ${exInfernisNote}
      <p class="invictus-augury-roll">${augur.name}: rolled ${roll.total} vs. ${targetNumber}
        (Science: Augury ${baseSkill}%, ${config.difficulty} difficulty)</p>
    </div>`,
    speaker: ChatMessage.getSpeaker({ actor: augur }),
    rolls: [roll],
    whisper: config.keeperOnly ? ChatMessage.getWhisperRecipients('GM') : []
  });

  return resultData;
}
