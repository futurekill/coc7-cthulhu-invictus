/**
 * Register all world-scope settings for the Cthulhu Invictus module.
 * Called during the 'init' hook from main.js.
 *
 * All optional rules default to false (disabled). The Keeper enables them
 * via the Module Settings panel. When a rule is disabled its UI elements
 * are hidden and its mechanical effects are suspended.
 */

const MODULE_ID = 'coc7-cthulhu-invictus';

export function registerSettings() {

  // ── Optional Rule: Infection ──────────────────────────────────────────
  game.settings.register(MODULE_ID, 'optionalInfection', {
    name: game.i18n.localize('INVICTUS.Settings.OptionalInfection.Name'),
    hint: game.i18n.localize('INVICTUS.Settings.OptionalInfection.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false,
    onChange: value => {
      Hooks.callAll(`${MODULE_ID}.settingChanged`, 'optionalInfection', value);
    }
  });

  // ── Optional Rule: Ill Omens ──────────────────────────────────────────
  game.settings.register(MODULE_ID, 'optionalIllOmens', {
    name: game.i18n.localize('INVICTUS.Settings.OptionalIllOmens.Name'),
    hint: game.i18n.localize('INVICTUS.Settings.OptionalIllOmens.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false,
    onChange: value => {
      Hooks.callAll(`${MODULE_ID}.settingChanged`, 'optionalIllOmens', value);
    }
  });

  // ── Optional Rule: Faith & Luck ───────────────────────────────────────
  game.settings.register(MODULE_ID, 'optionalFaithAndLuck', {
    name: game.i18n.localize('INVICTUS.Settings.OptionalFaithAndLuck.Name'),
    hint: game.i18n.localize('INVICTUS.Settings.OptionalFaithAndLuck.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false,
    onChange: value => {
      Hooks.callAll(`${MODULE_ID}.settingChanged`, 'optionalFaithAndLuck', value);
    }
  });

  // ── Optional Rule: Augury (Full Rules) ────────────────────────────────
  game.settings.register(MODULE_ID, 'optionalAugury', {
    name: game.i18n.localize('INVICTUS.Settings.OptionalAugury.Name'),
    hint: game.i18n.localize('INVICTUS.Settings.OptionalAugury.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false,
    onChange: value => {
      Hooks.callAll(`${MODULE_ID}.settingChanged`, 'optionalAugury', value);
    }
  });

  // ── Optional Rule: Experienced Investigators ──────────────────────────
  game.settings.register(MODULE_ID, 'optionalExperiencedInvestigators', {
    name: game.i18n.localize('INVICTUS.Settings.OptionalExperienced.Name'),
    hint: game.i18n.localize('INVICTUS.Settings.OptionalExperienced.Hint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false,
    onChange: value => {
      Hooks.callAll(`${MODULE_ID}.settingChanged`, 'optionalExperiencedInvestigators', value);
    }
  });

  // ── Display: Currency Unit Label ──────────────────────────────────────
  game.settings.register(MODULE_ID, 'currencyUnit', {
    name: game.i18n.localize('INVICTUS.Settings.CurrencyUnit.Name'),
    hint: game.i18n.localize('INVICTUS.Settings.CurrencyUnit.Hint'),
    scope: 'world',
    config: true,
    type: String,
    default: 'sestertii',
    choices: {
      sestertii: 'Sestertii',
      ses: 'ses.'
    },
    requiresReload: false
  });
}

/**
 * Helper to read a setting value by its short key.
 * @param {string} key - Setting key without the module prefix.
 * @returns {*} The current value of the setting.
 */
export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}
