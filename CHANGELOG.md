# Changelog

## [1.4.3] - 2025-10-04
### Added
- Added French (fr) localization. Credit: [Rectulo](https://github.com/rectulo)

## [1.4.2] - 2025-10-03
### Changed
- Updated en.json

## [1.4.1] - 2025-10-03
### Fixed
- fixed error in module.json preventing module to function. 

## [1.4.0] - 2025-10-03
### Added
- When re-roll without outcome is detected, will prompt GM to choose outcome. 
- Results in chat are color coded based on results.

## [1.3.1] - 2025-08-04
### Fixed
- corrected module.json to not give manifest error.

## [1.3.0] - 2025-07-16
### Added
- Checks if [PF2e Workbench](https://foundryvtt.com/packages/xdy-pf2e-workbench) setting for variant hero point rules are enabled before tracking stats. 

### Changed
- Verified compatibility with Foundry v13.

## [1.2.54] - 2025-01-10
### Added
- Enabled Github Workflow
- reformatted changelog to adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). 

## [1.2.53]
### Added
- Confirmation prompt before deleting data.

### Fixed
- Cleaned up duplicate macros.

## [1.2.52]
### Fixed
- Typos in settings.

## [1.2.51]
### Fixed
- Calculation error when outputting to chat after reroll.

## [1.2.5]
### Changed
- Updated success count and percentage to include regular successes and critical successes combined, as crits are also considered "successes."

## [1.2.4]
### Changed
- Cleaned up stat presentation so all stats except the total now show a percentage in parentheses.

## [1.2.2]
### Fixed
- Bug with debugging.

## [1.2.1]
### Updated
- Improved debugging.

## [1.2.0]
### Added
- Compatibility with [PF2e Toolbelt](https://foundryvtt.com/packages/pf2e-toolbelt) target helper feature.
- New option to display reroll stats for an actor in chat after a reroll.
- New macro: "Reroll Editor" (GM only) to manually edit reroll stats for an actor.

### Fixed
- Compatibility issues.

## [1.0.3]
### Added
- Macro to delete all reroll data.
- Option to ignore characters with the "minion" trait by default (can be disabled in settings).

### Fixed
- Error calculating success and critical success percentages.

## [1.0.2]
### Added
- Reroll totals to stats journal.
- Reroll totals macro.

## [1.0.1]
### Fixed
- Missing function in `reroll.js`.

## [1.0.0]
### Added
- Initial release.
