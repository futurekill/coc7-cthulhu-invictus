/**
 * InvictusCharacterSheet — Extends the CoC7 character sheet with an
 * additional "Invictus" tab displaying Status, wealth, Faith, and
 * other Cthulhu Invictus-specific fields.
 *
 * Architecture approach:
 * Rather than replacing the CoC7 sheet entirely, this module injects
 * the Invictus tab into the existing CoC7 sheet via the
 * renderActorSheet / renderDocumentSheetV2 hook. This keeps the core
 * CoC7 tabs intact and avoids conflicts with CoC7 updates.
 *
 * If CoC7 migrates to ApplicationV2 / DocumentSheetV2, we can register
 * a proper sheet subclass. For now the hook-injection approach is the
 * safest and most compatible strategy.
 */

import { MODULE_ID } from '../main.js';
import { getInvictusData, setInvictusData, deriveWealth, getTierForStatus, RELIGIONS } from '../data/StatusModel.js';
import { getSetting } from '../settings.js';

// ── Tab Injection ───────────────────────────────────────────────────────────

/**
 * Inject the Invictus tab into a rendered CoC7 character sheet.
 * Called from the 'renderActorSheet' hook.
 *
 * @param {Application|ApplicationV2} app - The sheet application instance.
 * @param {HTMLElement|jQuery} html - The rendered HTML element.
 * @param {object} data - The data context used for rendering.
 */
export async function injectInvictusTab(app, html, data) {
  // Only inject on character-type actors
  const actor = app.actor ?? app.document;
  if (!actor || actor.type !== 'character') return;

  // Normalise html to a plain HTMLElement (handle both jQuery and native)
  const element = html instanceof jQuery ? html[0] : (html instanceof HTMLElement ? html : html?.element);
  if (!element) return;

  // Locate the tab navigation bar
  const nav = element.querySelector('.sheet-tabs, nav.sheet-tabs, [data-group="primary"]');
  if (!nav) return;

  // Avoid duplicate injection
  if (nav.querySelector('[data-tab="invictus"]')) return;

  // ── Add the tab button ──────────────────────────────────────────────
  const tabButton = document.createElement('a');
  tabButton.classList.add('item');
  tabButton.dataset.tab = 'invictus';
  tabButton.textContent = game.i18n.localize('INVICTUS.Tab.Label');
  nav.appendChild(tabButton);

  // ── Build the tab content ───────────────────────────────────────────
  const invictusData = getInvictusData(actor) ?? {
    status: 0, infamy: false,
    faith: { current: 0, max: 0 },
    religion: '',
    romanName: { praenomen: '', nomen: '', cognomen: '' }
  };
  const wealth = deriveWealth(invictusData.status);
  const currencyUnit = getSetting('currencyUnit') ?? 'sestertii';
  const faithEnabled = getSetting('optionalFaithAndLuck');
  const infectionEnabled = getSetting('optionalInfection');
  const omensEnabled = getSetting('optionalIllOmens');

  // Render the template
  const templatePath = `modules/${MODULE_ID}/templates/sheets/invictus-character.hbs`;
  const templateData = {
    invictus: invictusData,
    wealth,
    currencyUnit,
    faithEnabled,
    infectionEnabled,
    omensEnabled,
    religions: RELIGIONS.map(key => ({
      key,
      label: game.i18n.localize(key),
      selected: invictusData.religion === key
    })),
    tierLabel: game.i18n.localize(wealth.socialClassLabel),
    isEditable: app.isEditable
  };

  const rendered = await renderTemplate(templatePath, templateData);

  // ── Inject the tab body ─────────────────────────────────────────────
  const body = element.querySelector('.sheet-body');
  if (!body) return;

  const tabContent = document.createElement('div');
  tabContent.classList.add('tab');
  tabContent.dataset.tab = 'invictus';
  tabContent.dataset.group = 'primary';
  tabContent.innerHTML = rendered;
  body.appendChild(tabContent);

  // ── Activate event listeners ────────────────────────────────────────
  _activateListeners(tabContent, actor, app);
}

// ── Event Listeners ─────────────────────────────────────────────────────────

/**
 * Bind change/click listeners on the injected Invictus tab.
 * @param {HTMLElement} html - The tab content element.
 * @param {Actor} actor - The actor document.
 * @param {Application} app - The sheet application.
 */
function _activateListeners(html, actor, app) {
  if (!app.isEditable) return;

  // Status numeric input
  const statusInput = html.querySelector('[name="invictus.status"]');
  if (statusInput) {
    statusInput.addEventListener('change', async (event) => {
      const value = Math.clamped(parseInt(event.target.value) || 0, 0, 100);
      event.target.value = value;
      await setInvictusData(actor, { status: value });
      app.render(false);
    });
  }

  // Infamy checkbox
  const infamyCheck = html.querySelector('[name="invictus.infamy"]');
  if (infamyCheck) {
    infamyCheck.addEventListener('change', async (event) => {
      await setInvictusData(actor, { infamy: event.target.checked });
    });
  }

  // Religion dropdown
  const religionSelect = html.querySelector('[name="invictus.religion"]');
  if (religionSelect) {
    religionSelect.addEventListener('change', async (event) => {
      await setInvictusData(actor, { religion: event.target.value });
    });
  }

  // Faith current / max
  for (const field of ['faith.current', 'faith.max']) {
    const input = html.querySelector(`[name="invictus.${field}"]`);
    if (input) {
      input.addEventListener('change', async (event) => {
        const val = Math.max(0, parseInt(event.target.value) || 0);
        event.target.value = val;
        const key = field.split('.')[1]; // 'current' or 'max'
        const existing = getInvictusData(actor)?.faith ?? { current: 0, max: 0 };
        existing[key] = val;
        await setInvictusData(actor, { faith: existing });
      });
    }
  }

  // Roman Name fields
  for (const part of ['praenomen', 'nomen', 'cognomen']) {
    const input = html.querySelector(`[name="invictus.romanName.${part}"]`);
    if (input) {
      input.addEventListener('change', async (event) => {
        const existing = getInvictusData(actor)?.romanName ?? { praenomen: '', nomen: '', cognomen: '' };
        existing[part] = event.target.value.trim();
        await setInvictusData(actor, { romanName: existing });
      });
    }
  }
}
