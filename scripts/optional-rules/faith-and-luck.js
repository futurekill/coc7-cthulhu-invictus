/**
 * Faith & Luck Optional Rule
 *
 * Investigators who actively participate in religious observance gain a
 * Faith pool. Faith points can be spent like Luck — to reduce damage or
 * improve a roll result — but ONLY in circumstances directly related to
 * the investigator's patron deity or philosophical school.
 *
 * Recovery: Weekly on successful POW rolls, at a rate tied to depth of
 * observance (regular sacrifice, temple attendance, discipline practice).
 *
 * The Faith spend UI mirrors CoC7's existing Luck spend workflow.
 * The religion/philosophy field is a pre-populated dropdown matching
 * the religions and disciplines in Chapter 6 of the 7th Edition Guide.
 */

import { MODULE_ID } from '../main.js';
import { getSetting } from '../settings.js';
import { getInvictusData, setInvictusData } from '../data/StatusModel.js';

// ── Registration ────────────────────────────────────────────────────────────

export function registerFaithAndLuckHooks() {
  if (!getSetting('optionalFaithAndLuck')) {
    console.log(`${MODULE_ID} | Faith & Luck rule disabled`);
    return;
  }

  console.log(`${MODULE_ID} | Faith & Luck rule hooks registered`);

  // Register /faith chat command for spending and recovery
  Hooks.on('chatMessage', (chatLog, messageText, chatData) => {
    if (!getSetting('optionalFaithAndLuck')) return true;

    const spendMatch = messageText.match(/^\/faith\s+spend\s+(\d+)\s*(.*)/i);
    if (spendMatch) {
      _handleFaithSpend(parseInt(spendMatch[1]), spendMatch[2]?.trim());
      return false;
    }

    const recoverMatch = messageText.match(/^\/faith\s+recover\s*(.*)/i);
    if (recoverMatch) {
      _handleFaithRecovery(recoverMatch[1]?.trim());
      return false;
    }

    return true;
  });

  // Hook into CoC7's roll result to offer Faith spend option
  // This hooks into the roll card rendering to inject a "Spend Faith" button
  Hooks.on('renderChatMessage', (message, html, data) => {
    if (!getSetting('optionalFaithAndLuck')) return;
    _injectFaithSpendButton(message, html);
  });
}

// ── Faith Spend ─────────────────────────────────────────────────────────────

/**
 * Handle the /faith spend <amount> [actor] command.
 * @param {number} amount - Points to spend.
 * @param {string} actorName - Optional actor name.
 */
async function _handleFaithSpend(amount, actorName) {
  const actor = _resolveActor(actorName);
  if (!actor) {
    ui.notifications.warn(game.i18n.localize('INVICTUS.Faith.NoActor'));
    return;
  }

  await spendFaith(actor, amount);
}

/**
 * Spend Faith points from an actor's pool.
 * @param {Actor} actor
 * @param {number} amount
 * @returns {boolean} Whether the spend was successful.
 */
export async function spendFaith(actor, amount) {
  const invictusData = getInvictusData(actor);
  if (!invictusData) return false;

  const current = invictusData.faith?.current ?? 0;
  const religion = invictusData.religion ?? '';

  if (amount > current) {
    ui.notifications.warn(game.i18n.format('INVICTUS.Faith.InsufficientPoints', {
      name: actor.name,
      current,
      requested: amount
    }));
    return false;
  }

  if (!religion) {
    ui.notifications.warn(game.i18n.format('INVICTUS.Faith.NoReligion', {
      name: actor.name
    }));
    return false;
  }

  // Deduct points
  const newCurrent = current - amount;
  await setInvictusData(actor, {
    faith: { ...invictusData.faith, current: newCurrent }
  });

  // Post to chat
  const religionLabel = game.i18n.localize(religion);
  ChatMessage.create({
    content: `<div class="invictus-faith-spend">
      <h4>${game.i18n.localize('INVICTUS.Faith.SpendTitle')}</h4>
      <p>${game.i18n.format('INVICTUS.Faith.SpendMessage', {
        name: actor.name,
        amount,
        remaining: newCurrent
      })}</p>
      <p class="invictus-faith-religion"><em>${game.i18n.format('INVICTUS.Faith.PatronNote', {
        religion: religionLabel
      })}</em></p>
    </div>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });

  // Re-render sheet
  if (actor.sheet?.rendered) actor.sheet.render(false);
  return true;
}

// ── Faith Recovery ──────────────────────────────────────────────────────────

/**
 * Handle the /faith recover [actor] command.
 * Rolls POW to attempt weekly Faith recovery.
 * @param {string} actorName
 */
async function _handleFaithRecovery(actorName) {
  const actor = _resolveActor(actorName);
  if (!actor) {
    ui.notifications.warn(game.i18n.localize('INVICTUS.Faith.NoActor'));
    return;
  }

  await recoverFaith(actor);
}

/**
 * Attempt weekly Faith recovery via POW roll.
 * On success, recover 1D3 Faith points (up to max).
 * @param {Actor} actor
 */
export async function recoverFaith(actor) {
  const invictusData = getInvictusData(actor);
  if (!invictusData) return;

  const current = invictusData.faith?.current ?? 0;
  const max = invictusData.faith?.max ?? 0;

  if (current >= max) {
    ChatMessage.create({
      content: `<div class="invictus-faith-recovery">
        <p>${game.i18n.format('INVICTUS.Faith.AlreadyFull', { name: actor.name })}</p>
      </div>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
    return;
  }

  // POW roll
  const pow = actor.system?.characteristics?.pow?.value ?? 50;
  const powRoll = await new Roll('1d100').evaluate();
  const success = powRoll.total <= pow;

  if (success) {
    const recoveryRoll = await new Roll('1d3').evaluate();
    const recovered = recoveryRoll.total;
    const newCurrent = Math.min(max, current + recovered);
    const actualRecovered = newCurrent - current;

    await setInvictusData(actor, {
      faith: { ...invictusData.faith, current: newCurrent }
    });

    ChatMessage.create({
      content: `<div class="invictus-faith-recovery invictus-faith-success">
        <h4>${game.i18n.localize('INVICTUS.Faith.RecoveryTitle')}</h4>
        <p>${game.i18n.format('INVICTUS.Faith.RecoverySuccess', {
          name: actor.name,
          recovered: actualRecovered,
          current: newCurrent,
          max
        })}</p>
        <p>POW roll: ${powRoll.total} vs. ${pow} — Success!
          Recovery: ${recoveryRoll.total} point${recoveryRoll.total !== 1 ? 's' : ''}</p>
      </div>`,
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [powRoll, recoveryRoll]
    });
  } else {
    ChatMessage.create({
      content: `<div class="invictus-faith-recovery invictus-faith-failure">
        <h4>${game.i18n.localize('INVICTUS.Faith.RecoveryTitle')}</h4>
        <p>${game.i18n.format('INVICTUS.Faith.RecoveryFailed', { name: actor.name })}</p>
        <p>POW roll: ${powRoll.total} vs. ${pow} — Failed</p>
      </div>`,
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [powRoll]
    });
  }

  if (actor.sheet?.rendered) actor.sheet.render(false);
}

// ── Roll Card Integration ───────────────────────────────────────────────────

/**
 * Inject a "Spend Faith" button into CoC7 roll result chat cards.
 * This mirrors how CoC7 handles Luck spending on roll results.
 * @param {ChatMessage} message
 * @param {jQuery|HTMLElement} html
 */
function _injectFaithSpendButton(message, html) {
  // Only inject on roll result messages that belong to a character
  const speaker = message.speaker;
  if (!speaker?.actor) return;

  const actor = game.actors.get(speaker.actor);
  if (!actor || actor.type !== 'character') return;

  const invictusData = getInvictusData(actor);
  if (!invictusData?.faith?.current || invictusData.faith.current <= 0) return;
  if (!invictusData.religion) return;

  // Look for CoC7 roll result cards (they typically have a specific class)
  const element = html instanceof jQuery ? html[0] : html;
  const rollCard = element?.querySelector('.chat-card, .coc7-roll-card, .roll-result');
  if (!rollCard) return;

  // Check if we already injected
  if (rollCard.querySelector('.invictus-faith-spend-btn')) return;

  // Add the Faith spend button
  const btn = document.createElement('button');
  btn.className = 'invictus-faith-spend-btn';
  btn.type = 'button';
  btn.innerHTML = `<i class="fas fa-sun"></i> ${game.i18n.format('INVICTUS.Faith.SpendButton', {
    current: invictusData.faith.current
  })}`;
  btn.addEventListener('click', async () => {
    // Prompt for amount
    const content = `<form>
      <div class="form-group">
        <label>${game.i18n.localize('INVICTUS.Faith.SpendAmount')}</label>
        <input type="number" name="amount" value="1" min="1"
               max="${invictusData.faith.current}" step="1" />
      </div>
    </form>`;

    const dialog = await Dialog.prompt({
      title: game.i18n.localize('INVICTUS.Faith.SpendTitle'),
      content,
      label: game.i18n.localize('INVICTUS.Faith.SpendConfirm'),
      callback: (html) => {
        const form = html instanceof jQuery ? html[0] : html;
        return parseInt(form.querySelector('[name="amount"]').value) || 1;
      }
    });

    if (dialog) await spendFaith(actor, dialog);
  });

  rollCard.appendChild(btn);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function _resolveActor(actorName) {
  if (actorName) return game.actors.getName(actorName);
  const speaker = ChatMessage.getSpeaker();
  return game.actors.get(speaker.actor);
}
