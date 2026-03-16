/**
 * InvictusCharacterSheet — Extends the CoC7 character sheet with an
 * additional "Invictus" tab displaying Status, wealth, Faith, and
 * other Cthulhu Invictus-specific fields.
 *
 * Architecture approach:
 * This module provides two mechanisms for extending the CoC7 sheet:
 *
 * 1. SHEET SUBCLASS (primary): A dynamic class factory that creates an
 *    ActorSheet subclass extending CoC7's character sheet at runtime.
 *    This provides the most robust integration and inherits all CoC7
 *    functionality automatically.
 *
 * 2. TAB INJECTION (fallback): If sheet registration fails, we fall back
 *    to hooking renderActorSheet and injecting the Invictus tab. This
 *    ensures compatibility even if CoC7's sheet class structure changes.
 *
 * The renderActorSheet hook is used by both mechanisms: the subclass
 * uses it to inject the tab (via inherited hooks), and the fallback uses
 * it directly if sheet registration wasn't possible.
 */

import { MODULE_ID } from '../main.js';
import { getInvictusData, setInvictusData, deriveWealth, getTierForStatus, RELIGIONS } from '../data/StatusModel.js';
import { getSetting } from '../settings.js';

// ─────────────────────────────────────────────────────────────────────────────
//  SHEET SUBCLASS FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a dynamic InvictusCharacterSheet class that extends the given
 * CoC7 character sheet base class.
 *
 * This factory pattern is necessary because we don't know the CoC7 sheet
 * class name at module load time. Called at ready time when we can look
 * up the actual class from CONFIG.Actor.sheetClasses.
 *
 * @param {class} BaseSheetClass - The CoC7 character sheet class to extend.
 * @returns {class} A new ActorSheet subclass with Invictus functionality.
 */
export function InvictusCharacterSheet(BaseSheetClass) {
  return class extends BaseSheetClass {
    /**
     * Return the sheet title, optionally prefixed with "Invictus".
     */
    get title() {
      const baseTitle = super.title || 'Character Sheet';
      return `[Invictus] ${baseTitle}`;
    }

    /**
     * Override getData() to inject Invictus-specific context on top of
     * CoC7's data. All CoC7 data is preserved; we simply add extra fields.
     */
    async getData(options = {}) {
      // Get all data from the parent CoC7 sheet
      const data = await super.getData(options);

      // Fetch Invictus-specific data for this actor
      const invictusData = getInvictusData(this.actor) ?? {
        status: 0,
        infamy: false,
        faith: { current: 0, max: 0 },
        religion: '',
        romanName: { praenomen: '', nomen: '', cognomen: '' }
      };

      // Compute derived values
      const wealth = deriveWealth(invictusData.status);
      const currencyUnit = getSetting('currencyUnit') ?? 'sestertii';
      const faithEnabled = getSetting('optionalFaithAndLuck');
      const infectionEnabled = getSetting('optionalInfection');
      const omensEnabled = getSetting('optionalIllOmens');

      // Inject Invictus context into the data object
      data.invictus = {
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
        isEditable: this.isEditable
      };

      return data;
    }

    /**
     * Override activateListeners() to add Invictus-specific event handlers
     * on top of CoC7's existing listeners.
     */
    activateListeners(html) {
      // Call parent activateListeners to preserve CoC7 functionality
      super.activateListeners(html);

      // Only add listeners if the sheet is editable
      if (!this.isEditable) return;

      // ── Invictus-specific listeners ─────────────────────────────────
      this._activateInvictusListeners(html);
    }

    /**
     * Bind Invictus-specific event listeners.
     * @param {HTMLElement} html - The sheet HTML element.
     */
    _activateInvictusListeners(html) {
      // Status numeric input
      const statusInput = html.querySelector('[name="invictus.status"]');
      if (statusInput) {
        statusInput.addEventListener('change', async (event) => {
          const value = Math.clamped(parseInt(event.target.value) || 0, 0, 100);
          event.target.value = value;
          await setInvictusData(this.actor, { status: value });
          this.render(false);
        });
      }

      // Infamy checkbox
      const infamyCheck = html.querySelector('[name="invictus.infamy"]');
      if (infamyCheck) {
        infamyCheck.addEventListener('change', async (event) => {
          await setInvictusData(this.actor, { infamy: event.target.checked });
        });
      }

      // Religion dropdown
      const religionSelect = html.querySelector('[name="invictus.religion"]');
      if (religionSelect) {
        religionSelect.addEventListener('change', async (event) => {
          await setInvictusData(this.actor, { religion: event.target.value });
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
            const existing = getInvictusData(this.actor)?.faith ?? { current: 0, max: 0 };
            existing[key] = val;
            await setInvictusData(this.actor, { faith: existing });
          });
        }
      }

      // Roman Name fields
      for (const part of ['praenomen', 'nomen', 'cognomen']) {
        const input = html.querySelector(`[name="invictus.romanName.${part}"]`);
        if (input) {
          input.addEventListener('change', async (event) => {
            const existing = getInvictusData(this.actor)?.romanName ?? {
              praenomen: '',
              nomen: '',
              cognomen: ''
            };
            existing[part] = event.target.value.trim();
            await setInvictusData(this.actor, { romanName: existing });
          });
        }
      }
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB INJECTION (FALLBACK)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inject the Invictus tab into a rendered CoC7 character sheet.
 * Used as a fallback when sheet subclass registration isn't possible,
 * or as an additional layer via the renderActorSheet hook.
 *
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
    status: 0,
    infamy: false,
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
  _activateTabListeners(tabContent, actor, app);
}

/**
 * Bind change/click listeners on the injected Invictus tab (fallback mode).
 * @param {HTMLElement} html - The tab content element.
 * @param {Actor} actor - The actor document.
 * @param {Application} app - The sheet application.
 */
function _activateTabListeners(html, actor, app) {
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
        const existing = getInvictusData(actor)?.romanName ?? {
          praenomen: '',
          nomen: '',
          cognomen: ''
        };
        existing[part] = event.target.value.trim();
        await setInvictusData(actor, { romanName: existing });
      });
    }
  }
}
