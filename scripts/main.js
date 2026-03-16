/**
 * Cthulhu Invictus — Foundry VTT Module (coc7-cthulhu-invictus)
 *
 * Main entry point. Registers hooks, settings, data models, and sheet
 * extensions that bring the Cthulhu Invictus setting to the CoC7 system.
 *
 * Architecture: CoC7 (base) → coc7-cthulhu-invictus (Module 1)
 * Target: Foundry VTT V13
 */

export const MODULE_ID = 'coc7-cthulhu-invictus';

// ── Lazy Imports (resolved after init) ──────────────────────────────────────
let registerSettings;
let injectInvictusTab;
let initInvictusData;
let getInvictusData;
let InvictusCharacterSheet;

// Optional rule modules (loaded conditionally)
let registerInfectionHooks;
let registerIllOmensHooks;
let registerFaithAndLuckHooks;
let registerAuguryHooks;

// ═══════════════════════════════════════════════════════════════════════════
//  INIT — fires during Game#initialize, before the world is ready
// ═══════════════════════════════════════════════════════════════════════════
Hooks.once('init', async () => {
  console.log(`${MODULE_ID} | Initialising Cthulhu Invictus module`);

  // ── Add body class for CSS theming ──────────────────────────────────────
  document.body.classList.add('coc7-cthulhu-invictus-active');

  // Dynamic imports so the module tree is loaded only when Foundry is ready
  const settingsModule = await import('./settings.js');
  registerSettings = settingsModule.registerSettings;

  const sheetModule = await import('./sheets/InvictusCharacterSheet.js');
  injectInvictusTab = sheetModule.injectInvictusTab;
  InvictusCharacterSheet = sheetModule.InvictusCharacterSheet;

  const dataModule = await import('./data/StatusModel.js');
  initInvictusData = dataModule.initInvictusData;
  getInvictusData = dataModule.getInvictusData;

  // Load optional rule modules
  const infectionModule = await import('./optional-rules/infection.js');
  registerInfectionHooks = infectionModule.registerInfectionHooks;

  const illOmensModule = await import('./optional-rules/ill-omens.js');
  registerIllOmensHooks = illOmensModule.registerIllOmensHooks;

  const faithModule = await import('./optional-rules/faith-and-luck.js');
  registerFaithAndLuckHooks = faithModule.registerFaithAndLuckHooks;

  const auguryModule = await import('./optional-rules/augury.js');
  registerAuguryHooks = auguryModule.registerAuguryHooks;

  // Register world-scope settings (optional rules, currency display, etc.)
  registerSettings();

  // Register Handlebars template partials used by the Invictus tab
  const templatePaths = [
    `modules/${MODULE_ID}/templates/sheets/invictus-character.hbs`
  ];
  loadTemplates(templatePaths);

  // ── Custom Handlebars Helpers ───────────────────────────────────────
  Handlebars.registerHelper('invictusLocalize', (key) => {
    return game.i18n.localize(key);
  });

  Handlebars.registerHelper('invictusFormatCoin', (amount, unit) => {
    if (typeof amount !== 'number') return '—';
    const formatted = amount.toLocaleString();
    return `${formatted} ${unit}`;
  });

  Handlebars.registerHelper('invictusEq', (a, b) => a === b);

  console.log(`${MODULE_ID} | Settings registered, templates loaded`);
});

// ═══════════════════════════════════════════════════════════════════════════
//  READY — fires after all systems and modules have finished initialising
// ═══════════════════════════════════════════════════════════════════════════
Hooks.once('ready', () => {
  console.log(`${MODULE_ID} | Module ready`);

  // Verify CoC7 system is active
  if (game.system.id !== 'CoC7') {
    ui.notifications.error(
      game.i18n.localize('INVICTUS.Error.RequiresCoC7')
    );
    return;
  }

  console.log(`${MODULE_ID} | CoC7 system detected — Cthulhu Invictus is active`);

  // ── Register Sheet Extension ────────────────────────────────────────────
  // Find the CoC7 character sheet class and register our subclass
  try {
    const characterSheets = CONFIG.Actor.sheetClasses?.character ?? {};
    let coc7SheetClass = null;

    // CONFIG.Actor.sheetClasses.character is an object keyed by "scope.ClassName"
    for (const [key, entry] of Object.entries(characterSheets)) {
      if (key.startsWith('CoC7') && entry.cls) {
        coc7SheetClass = entry.cls;
        console.log(`${MODULE_ID} | Found CoC7 sheet class: ${key}`);
        break;
      }
    }

    if (coc7SheetClass) {
      const DynamicInvictusSheet = InvictusCharacterSheet(coc7SheetClass);
      Actors.registerSheet(MODULE_ID, DynamicInvictusSheet, {
        types: ['character'],
        makeDefault: true,
        label: 'Cthulhu Invictus Character Sheet'
      });
      console.log(`${MODULE_ID} | Registered InvictusCharacterSheet as default character sheet`);
    } else {
      console.warn(`${MODULE_ID} | Could not find CoC7 character sheet class, using tab injection fallback`);
    }
  } catch (e) {
    console.error(`${MODULE_ID} | Failed to register sheet extension, using tab injection fallback:`, e);
  }

  // ── Register Optional Rule Hooks ────────────────────────────────────
  // Each registration function checks its own setting before activating
  try { registerInfectionHooks(); } catch (e) {
    console.error(`${MODULE_ID} | Failed to register Infection hooks:`, e);
  }
  try { registerIllOmensHooks(); } catch (e) {
    console.error(`${MODULE_ID} | Failed to register Ill Omens hooks:`, e);
  }
  try { registerFaithAndLuckHooks(); } catch (e) {
    console.error(`${MODULE_ID} | Failed to register Faith & Luck hooks:`, e);
  }
  try { registerAuguryHooks(); } catch (e) {
    console.error(`${MODULE_ID} | Failed to register Augury hooks:`, e);
  }

  // ── Expose public API for macros and external modules ───────────────
  game.modules.get(MODULE_ID).api = {
    // Infection
    treatInfection: async (...args) => {
      const mod = await import('./optional-rules/infection.js');
      return mod.treatInfection(...args);
    },
    resolveInfectionTreatment: async (...args) => {
      const mod = await import('./optional-rules/infection.js');
      return mod.resolveInfectionTreatment(...args);
    },
    // Omens
    consultOmens: async (...args) => {
      const mod = await import('./optional-rules/ill-omens.js');
      return mod.consultOmens(...args);
    },
    clearOmenEffect: async (...args) => {
      const mod = await import('./optional-rules/ill-omens.js');
      return mod.clearOmenEffect(...args);
    },
    // Faith
    spendFaith: async (...args) => {
      const mod = await import('./optional-rules/faith-and-luck.js');
      return mod.spendFaith(...args);
    },
    recoverFaith: async (...args) => {
      const mod = await import('./optional-rules/faith-and-luck.js');
      return mod.recoverFaith(...args);
    },
    // Augury
    performAugury: async (...args) => {
      const mod = await import('./optional-rules/augury.js');
      return mod.performAugury(...args);
    },
    // Data
    getInvictusData: (actor) => getInvictusData(actor)
  };

  // Populate enum constants on the API
  import('./optional-rules/augury.js').then(m => {
    game.modules.get(MODULE_ID).api.AUGURY_TYPES = m.AUGURY_TYPES;
  });
  import('./optional-rules/ill-omens.js').then(m => {
    game.modules.get(MODULE_ID).api.OMEN_RESULTS = m.OMEN_RESULTS;
  });
  import('./optional-rules/infection.js').then(m => {
    game.modules.get(MODULE_ID).api.INFECTION_STAGES = m.INFECTION_STAGES;
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  SHEET INJECTION — add the Invictus tab to CoC7 character sheets (fallback)
// ═══════════════════════════════════════════════════════════════════════════

// Hook into legacy Application-based sheet rendering (fallback for tab injection)
Hooks.on('renderActorSheet', (app, html, data) => {
  if (!injectInvictusTab) return;
  const actor = app.actor ?? app.document;
  if (actor?.type !== 'character') return;
  injectInvictusTab(app, html, data);
});

// Also hook into ApplicationV2-based rendering (fallback for tab injection)
Hooks.on('renderDocumentSheetV2', (app, html, data) => {
  if (!injectInvictusTab) return;
  const actor = app.document;
  if (!actor || !(actor instanceof Actor) || actor.type !== 'character') return;
  injectInvictusTab(app, html, data);
});

// ═══════════════════════════════════════════════════════════════════════════
//  ACTOR CREATION — initialise Invictus data on new characters
// ═══════════════════════════════════════════════════════════════════════════
Hooks.on('createActor', async (actor, options, userId) => {
  if (!initInvictusData) return;
  if (actor.type !== 'character') return;
  if (game.userId !== userId) return;
  await initInvictusData(actor);
});

// ═══════════════════════════════════════════════════════════════════════════
//  SETTING CHANGE HOOK — react to optional rule toggles
// ═══════════════════════════════════════════════════════════════════════════
Hooks.on(`${MODULE_ID}.settingChanged`, (key, value) => {
  console.log(`${MODULE_ID} | Setting changed: ${key} = ${value}`);

  // Re-register hooks when optional rules are toggled on
  if (value === true) {
    const hookMap = {
      optionalInfection: registerInfectionHooks,
      optionalIllOmens: registerIllOmensHooks,
      optionalFaithAndLuck: registerFaithAndLuckHooks,
      optionalAugury: registerAuguryHooks
    };
    const fn = hookMap[key];
    if (fn) try { fn(); } catch (e) { /* may already be registered */ }
  }

  // Re-render any open character sheets so the Invictus tab reflects the change
  for (const actor of game.actors) {
    const sheet = actor.sheet;
    if (sheet?.rendered) sheet.render(false);
  }
});
