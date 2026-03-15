# Changelog

All notable changes to the Cthulhu Invictus Foundry VTT module will be documented in this file.

## [0.1.0] - 2026-03-15

### Added
- Initial module scaffold (Phase 1 — Foundation)
- `module.json` with CoC7 dependency, V13 compatibility, and compendium pack declarations
- World settings for all optional rules (Infection, Ill Omens, Faith & Luck, Augury, Experienced Investigators) and currency display
- `StatusModel` data model with Status tiers, wealth derivation, and flag-based storage
- Invictus character sheet tab injection via `renderActorSheet` hook
  - Roman Name fields (praenomen, nomen, cognomen)
  - Status score with derived social class label
  - Wealth summary table (starting coin, daily expense, assets)
  - Infamy checkbox
  - Religion/philosophy dropdown (populated from Chapter 6)
  - Faith & Luck fields (conditional on optional rule)
  - Collapsible Status reference table
- Roman-themed CSS with parchment palette and serif typography
- Full English localisation (`lang/en.json`)
- Stub files for Phase 4 optional rules (infection, ill omens, faith & luck, augury)
- Compendium pack folder structure for occupations, skills, equipment, bestiary, tomes & spells, rollable tables, and lore journals
