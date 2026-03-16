# Cthulhu Invictus — Foundry VTT Module

A comprehensive Foundry VTT module bringing the **Cthulhu Invictus** setting to the **Call of Cthulhu 7th Edition** system. Set in the Roman Empire during the reign of Antoninus Pius (145 A.D.), this module adds Roman-era occupations, equipment, creatures, optional rules, Mythos tomes, and setting lore to your CoC7 game.

Based on the *7th Edition Guide to Cthulhu Invictus* by Golden Goblin Press.

## Requirements

- **Foundry VTT** v13+
- **Call of Cthulhu 7th Edition** system (`CoC7`) v0.10.0+ by the Miskatonic Investigative Society

## Features

### Character Sheet Extension

An **Invictus** tab is injected into CoC7's character sheet (without replacing it), providing:

- **Roman Name** fields (praenomen, nomen, cognomen)
- **Status** score (0–100) with automatic social class derivation across 7 tiers (Infamy through Imperial)
- **Wealth** calculations — starting coinage, daily expenses, and assets derived from Status
- **Religion/Philosophy** selection from 17 Roman-era belief systems
- **Faith Points** tracking (when the optional Faith & Luck rule is enabled)

### Compendium Packs (280 entries)

| Pack | Count | Contents |
|------|-------|----------|
| Occupations | 57 | All Invictus occupations with credit rating, skills, and backstory guidance |
| Skills | 11 | New and modified skills (Empire, Oratory, Science: Augury, Status, etc.) |
| Equipment | 122 | 21 weapons, 13 armor types, 88 general items with period-accurate pricing |
| Bestiary | 30 | Mythological creatures (Centaurs, Gorgons, Hydrae, Minotaurs, etc.) and Mythos entities |
| Rollable Tables | 5 | Backstory generators (Traits, Ideology, Significant People, Locations, Possessions) |
| Tomes & Spells | 46 | 21 Mythos tomes, 14 spells, 11 artifacts with full stats and lore |
| Journal (Lore) | 9 | Setting overview, Roman society, religion, cults, legions, patrons, and more |

### Optional Rules

Four toggleable optional rule systems, each controlled by world-scope settings:

- **Infection** — Wounds risk infection. CON checks, progressive severity stages (Mild → Severe → Fatal), Active Effect tracking, and healer treatment workflow.
- **Ill Omens** — Augurs consult the gods before undertakings. Science (Augury) rolls determine Favorable/Neutral/Unfavorable results applied as Active Effects. `/omen` chat command.
- **Faith & Luck** — Pious investigators can spend Faith points to modify rolls. Weekly POW-based recovery. `/faith spend` and `/faith recover` chat commands.
- **Augury** — Full 6-type Roman divination system (Ex Caelo, Ex Avibus, Ex Tripudiis, Ex Quadrupedibus, Ex Diris, Ex Infernis). `/augury` chat command with dialog workflow.

### Technical Architecture

- **ESModules** with dynamic lazy imports for all subsystems
- **Flag-based data storage** — Invictus data stored via `actor.setFlag()`, never modifying CoC7 system data
- **Hook-driven** — Uses `renderActorSheet` for sheet injection, with `renderDocumentSheetV2` future-proofing
- **Public API** at `game.modules.get('coc7-cthulhu-invictus').api` for macro and external access
- **LevelDB compendium packs** with `_source/` JSON files for version control

## Installation

1. Download or clone this repository into your Foundry VTT `Data/modules/` directory
2. Ensure the folder is named `coc7-cthulhu-invictus`
3. Activate the module in your CoC7 world's Module Management settings
4. Configure optional rules in Module Settings

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `optionalInfection` | `false` | Enable wound infection mechanics |
| `optionalIllOmens` | `false` | Enable omen consultation system |
| `optionalFaithAndLuck` | `false` | Enable Faith points for pious investigators |
| `optionalAugury` | `false` | Enable full augury divination workflow |
| `optionalExperiencedInvestigators` | `false` | Additional skill points at character creation |
| `currencyUnit` | `sestertii` | Display label for currency |

## Project Structure

```
coc7-cthulhu-invictus/
├── module.json                          # Foundry manifest
├── scripts/
│   ├── main.js                          # Entry point, hooks, public API
│   ├── settings.js                      # World-scope setting registration
│   ├── data/
│   │   └── StatusModel.js               # Status tiers, wealth derivation, flag helpers
│   ├── sheets/
│   │   └── InvictusCharacterSheet.js    # Tab injection into CoC7 sheets
│   └── optional-rules/
│       ├── infection.js                 # Wound infection system
│       ├── ill-omens.js                 # Omen consultation system
│       ├── faith-and-luck.js            # Faith points system
│       └── augury.js                    # 6-type augury divination
├── templates/sheets/
│   └── invictus-character.hbs           # Handlebars template for Invictus tab
├── styles/
│   └── invictus.css                     # Roman-themed styling
├── lang/
│   └── en.json                          # English localization (~180 keys)
├── packs/
│   ├── occupations/_source/             # 57 occupation Items
│   ├── skills/_source/                  # 11 skill Items
│   ├── equipment/_source/               # 122 weapon/armor/item entries
│   ├── bestiary/_source/                # 30 creature Actors
│   ├── rollable-tables/_source/         # 5 backstory RollTables
│   ├── tomes-and-spells/_source/        # 46 tomes, spells, artifacts
│   └── journal/_source/                 # 9 lore JournalEntries
└── assets/icons/                        # Placeholder icon directories
```

## Related Modules

- **[coc7-britannia-beyond](../coc7-britannia-beyond/)** — British Isles expansion (requires this module)

## Credits

- **Setting**: *Cthulhu Invictus* by Oscar Rios, published by Golden Goblin Press
- **System**: Call of Cthulhu 7th Edition system for Foundry VTT by the Miskatonic Investigative Society
- **Module Development**: Built with assistance from Claude (Anthropic)

## License

This module is a fan-made digital implementation for personal use. The Cthulhu Invictus setting, Call of Cthulhu, and related intellectual property belong to their respective rights holders. Confirm licensing with Golden Goblin Press and Chaosium Inc. before any public distribution.
