# pf2e-reroll-stats
A Module for FoundryVTT Pathfinder2e system that tracks stats for re-rolls. 

**Note:** The intent for this is to track Hero Point rerolls, but this will also track if a character also rerolls using the "Reroll and keep [new/lower/higher] result."

### How To Use
The module will automatically track re-rolls made by players and add them to a Journal entry in the base journal folder named "ReRoll Stats". 

![Example](https://i.ibb.co/Nt0Kfg2/reroll-stats.png)

## Macros
The following Macros are in the "ReRoll Stats Macros" Compendium:

### Compile Reroll Stats
This Macro will compile all reroll stats for actors and create a journal entry named "Reroll tracker Stats" in the base Journal directory.

Manual command:
`compileActorStatsToJournal();`

### ReRoll Stats
This Macro will display the selected token actor stats to the chat.

Manual command:
`displayActorStatsInChat();`

### ReRoll Totals
This Macro will display the re-roll total stats for all actors. 

Manual command:
`displayCombinedRerollStats();`

### Reset ReRoll Stats
This Macro will CLEAR out all reroll data for the Selected Actor, setting all counts to 0.

***!!! CAN NOT BE UNDONE !!!***

Manual Command:
`resetRerollStats();`

### Delete Selected ReRoll Data
This macro will DELETE all re-roll data for selected token actor! If you want to just reset all stats to 0, then usee the Reset macro instead. 

***!!! CAN NOT BE UNDONE !!!***

Manual command:
`deleteActorRollData();`

### Delete ALL Reroll Stats

This macro will DELETE ALL REROLL DATA FOR ALL ACTORS 

If you want to just reset all stats to 0, then usee the Reset macro instead. 

!!! CAN NOT BE UNDONE !!!

Manual command: 
`deleteAllRerollStats();`