# P2Fe Reroll Stats
A Module for FoundryVTT Pathfinder2e system that tracks stats for re-rolls. 

**Note:** The intent for this is to track Hero Point rerolls, but this will also track if a character also rerolls using the "Reroll and keep [new/lower/higher] result."

> [!IMPORTANT]
> The compatibility issue with [PF2e Workbench](https://github.com/xdy/xdy-pf2e-workbench) has now been resolved! Better/Worse/Same results are judged based on die face, but the outcome stats (Success/Fail/Crit) are based on outcome after variant rule. 

### How To Use
The module will automatically track re-rolls made by players and add them to a Journal entry in the base journal folder named "ReRoll Stats". 

![image](https://github.com/user-attachments/assets/6a8e408c-7173-4e46-8539-5424089b8060) 

If enabled (default) in settings, outputs color coded message to chat

<img width="205" height="438" alt="image" src="https://github.com/user-attachments/assets/44239794-5306-4de5-8d02-d22e42f7c91c" /> <img width="205" height="438" alt="image" src="https://github.com/user-attachments/assets/2a9617ce-0273-4d31-98be-57fe36efff4c" /> <img width="205" height="438" alt="image" src="https://github.com/user-attachments/assets/3e78d9c3-64e9-4b2d-bd67-93bed9a988c4" />

If a roll with no outcome is detected (for example rolled straight from character sheet), will prompt GM to specify result

<img width="296" height="432" alt="image" src="https://github.com/user-attachments/assets/26ff2d9c-606b-4ccd-b342-86fb7d83cdcd" />

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

### Reroll Editor
This macro will open up a window that allows you to select an actor and edit the reroll data. (GM Only)

![reroll editor](https://i.ibb.co/DCW0hnQ/Reroll-Data.png)

manual command:
`openRerollEditor();`

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
