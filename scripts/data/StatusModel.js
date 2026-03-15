/**
 * StatusModel — TypeDataModel extension for the Cthulhu Invictus Status system.
 *
 * This model is NOT a standalone TypeDataModel registered as a document subtype.
 * Instead it is applied as additional data on CoC7 actor documents via
 * actor.flags or (preferably) by extending the CoC7 actor data model at init.
 *
 * Because CoC7 owns the Actor data schema, we store Invictus-specific fields
 * under a namespaced flag path:  actor.flags['coc7-cthulhu-invictus'].invictus
 *
 * The StatusModel class provides:
 *  - Schema definition (status, faith, religion, roman name fields)
 *  - Derived data computation (social class label, wealth values)
 *  - Validation (status clamped 0–100)
 *  - Migration support for future schema changes
 *
 * NOTE: The spec recommends TypeDataModel over flags for persistent mechanical
 * data. However, since we are a *module* extending a *system* (not defining our
 * own Actor subtypes), we use a DataModel attached via flags as the cleanest
 * non-invasive approach. If CoC7 exposes a formal extension API in the future,
 * this can be migrated.
 */

const MODULE_ID = 'coc7-cthulhu-invictus';

// ── Status Tier Definitions ─────────────────────────────────────────────────
export const STATUS_TIERS = [
  { min: 0,   max: 0,   label: 'INVICTUS.Status.Tier.Infamy',         socialClass: 'Slave / Criminal',               startingCoinMult: 10,    dailyExpense: 0,         assetsMult: 10 },
  { min: 1,   max: 19,  label: 'INVICTUS.Status.Tier.WorkingPoor',    socialClass: 'Working Poor / Slave',           startingCoinMult: 10,    dailyExpense: 50,        assetsMult: 100 },
  { min: 20,  max: 39,  label: 'INVICTUS.Status.Tier.WorkingClass',   socialClass: 'Working Class / Plebeian',       startingCoinMult: 20,    dailyExpense: 100,       assetsMult: 200 },
  { min: 40,  max: 59,  label: 'INVICTUS.Status.Tier.MiddleClass',    socialClass: 'Middle Class',                   startingCoinMult: 50,    dailyExpense: 500,       assetsMult: 500 },
  { min: 60,  max: 79,  label: 'INVICTUS.Status.Tier.UpperMiddle',    socialClass: 'Upper Middle / Equestrian',      startingCoinMult: 100,   dailyExpense: 1500,      assetsMult: 500 },
  { min: 80,  max: 99,  label: 'INVICTUS.Status.Tier.Senatorial',     socialClass: 'Rich / Senatorial',              startingCoinMult: 100,   dailyExpense: 3500,      assetsMult: 50000 },
  { min: 100, max: 100, label: 'INVICTUS.Status.Tier.Imperial',       socialClass: 'Imperial Domus (NPC only)',      startingCoinMult: 10000, dailyExpense: 1000000,   assetsMult: 50000000 }
];

/**
 * Look up the tier object for a given Status score.
 * @param {number} status - Integer 0–100.
 * @returns {object} The matching tier definition.
 */
export function getTierForStatus(status) {
  const clamped = Math.clamped(Math.round(status), 0, 100);
  return STATUS_TIERS.find(t => clamped >= t.min && clamped <= t.max) ?? STATUS_TIERS[0];
}

// ── Religion / Philosophy Options ───────────────────────────────────────────
export const RELIGIONS = [
  'INVICTUS.Religion.TraditionalRoman',
  'INVICTUS.Religion.ImperialCult',
  'INVICTUS.Religion.Isis',
  'INVICTUS.Religion.Mithras',
  'INVICTUS.Religion.Cybele',
  'INVICTUS.Religion.Bacchus',
  'INVICTUS.Religion.CelticDruidism',
  'INVICTUS.Religion.GermanicPaganism',
  'INVICTUS.Religion.Judaism',
  'INVICTUS.Religion.EarlyChristianity',
  'INVICTUS.Religion.Zoroastrianism',
  'INVICTUS.Religion.EgyptianPantheon',
  'INVICTUS.Religion.Epicureanism',
  'INVICTUS.Religion.Stoicism',
  'INVICTUS.Religion.Cynicism',
  'INVICTUS.Religion.Neoplatonism',
  'INVICTUS.Religion.Pythagoreanism',
  'INVICTUS.Religion.Other'
];

// ── DataModel Schema ────────────────────────────────────────────────────────

const { SchemaField, NumberField, StringField, BooleanField } = foundry.data.fields;

export class InvictusActorData extends foundry.abstract.DataModel {

  /** @override */
  static defineSchema() {
    return {
      // Core Status field (0–100 integer)
      status: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        max: 100,
        initial: 0,
        label: 'INVICTUS.Status.Label'
      }),

      // Infamy flag — some occupations carry social stigma even at non-zero Status
      infamy: new BooleanField({
        required: true,
        initial: false,
        label: 'INVICTUS.Status.Infamy'
      }),

      // Faith & Luck optional rule fields
      faith: new SchemaField({
        current: new NumberField({
          required: true,
          nullable: false,
          integer: true,
          min: 0,
          initial: 0,
          label: 'INVICTUS.Faith.Current'
        }),
        max: new NumberField({
          required: true,
          nullable: false,
          integer: true,
          min: 0,
          initial: 0,
          label: 'INVICTUS.Faith.Max'
        })
      }),

      // Religion or philosophical school
      religion: new StringField({
        required: true,
        blank: true,
        initial: '',
        label: 'INVICTUS.Religion.Label'
      }),

      // Roman Name (three-part: praenomen, nomen, cognomen)
      romanName: new SchemaField({
        praenomen: new StringField({ required: true, blank: true, initial: '' }),
        nomen:     new StringField({ required: true, blank: true, initial: '' }),
        cognomen:  new StringField({ required: true, blank: true, initial: '' })
      })
    };
  }
}

// ── Helper: Derive Wealth Values ────────────────────────────────────────────

/**
 * Compute all derived wealth values for a given Status score.
 * @param {number} status - The raw Status score (0–100).
 * @returns {object} Derived wealth data.
 */
export function deriveWealth(status) {
  const tier = getTierForStatus(status);
  const clamped = Math.clamped(Math.round(status), 0, 100);
  return {
    tier,
    socialClassLabel: tier.label,
    socialClass: tier.socialClass,
    startingCoin: clamped * tier.startingCoinMult,
    dailyExpense: tier.dailyExpense,
    assets: clamped * tier.assetsMult
  };
}

// ── Flag Accessors ──────────────────────────────────────────────────────────

/**
 * Retrieve the Invictus data object from an actor's flags.
 * Returns a plain object (not a DataModel instance).
 * @param {Actor} actor
 * @returns {object|null}
 */
export function getInvictusData(actor) {
  return actor.getFlag(MODULE_ID, 'invictus') ?? null;
}

/**
 * Write updated Invictus data to an actor's flags.
 * Merges with existing data (Foundry flag merge behaviour).
 * @param {Actor} actor
 * @param {object} data - Partial or full Invictus data object.
 * @returns {Promise<Actor>}
 */
export async function setInvictusData(actor, data) {
  return actor.setFlag(MODULE_ID, 'invictus', data);
}

/**
 * Initialise default Invictus data on a newly created actor if it doesn't
 * already have the flag. Called from a preCreateActor or createActor hook.
 * @param {Actor} actor
 * @returns {Promise<Actor>}
 */
export async function initInvictusData(actor) {
  const existing = getInvictusData(actor);
  if (existing) return actor;

  const schema = InvictusActorData.defineSchema();
  const defaults = {};
  for (const [key, field] of Object.entries(schema)) {
    defaults[key] = field.initial ?? field.getInitialValue?.() ?? null;
  }
  // Build nested defaults manually for SchemaFields
  defaults.faith = { current: 0, max: 0 };
  defaults.romanName = { praenomen: '', nomen: '', cognomen: '' };

  return setInvictusData(actor, defaults);
}
