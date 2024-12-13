// Log to Console
console.log("%cPF2e ReRoll Stats || reroll.js loaded", "color: orange; font-weight: bold;");


// Namespace for the module
const MODULE_NAME = "pf2e-reroll-stats";

// Label to append to the beginning of logs
const LOG_LABEL = "PF2e ReRoll Stats ||";

// Global variable for tracking roll data by actor
let rollDataByActor = {};

Hooks.once("init", () => {
    // Register settings for persistent data
    game.settings.register(MODULE_NAME, "rollData", {
        name: "Reroll Tracker Data",
        hint: "Stores reroll tracking data for each actor.",
        scope: "world", // Saved at the world level
        config: false,  // Not exposed in the settings menu
        type: Object,
        default: {},
    });
    
	// Register settings to output to chat after a reroll
    game.settings.register(MODULE_NAME, "outputToChat", {
        name: "Output sctor stats to chat after reroll?",
        hint: "Will output an actor's reroll stats in chat after each reroll/",
        scope: "world", 
        config: true,  
        type: Boolean,
        default: false,
		onChange: (value) => {
            debugLog(`PF2E Reroll Stats | outputToChat: ${value}`);
        },
		requiresReload: true
	 });
	
	// Register settings to ignore minions
    game.settings.register(MODULE_NAME, "ignoreMinion", {
        name: "Ignore Minions",
        hint: "Ignore rolls from minions (companions, summons, etc).",
        scope: "world", 
        config: true,  
        type: Boolean,
        default: true,
	 });
	 
    // Register settings for persistent data
    game.settings.register(MODULE_NAME, "debugEnabled", {
        name: "Enable Debugging",
        hint: "enables debugging in the console for troubleshooting purposes.",
        scope: "world", // Saved at the world level
        config: true,  // Exposed in the settings menu
        type: Boolean,  // Corrected from `boolean` to `Boolean`
        default: false,
		onChange: (value) => {
            debugLog(`PF2E Reroll Stats | debugEnabled: ${value}`);
        }
    });
	const debugEnabled = game.settings.get(MODULE_NAME, "debugEnabled");
	console.log(`%cPF2e ReRoll Stats || Debugging: ${debugEnabled}`, "color: orange; font-weight: bold;");

});

Hooks.once("ready", async () => {
    // Initialize rollDataByActor from game settings or as an empty object
    rollDataByActor = game.settings.get(MODULE_NAME, "rollData") || {};

    console.log(`%c${LOG_LABEL} Reroll Tracker ready!`, "color: Orange; font-weight: bold;");
});

// Function for debugging
function debugLog(logMsg, logType = "c", logLevel = "1") {
    const debugEnabled = game.settings.get(MODULE_NAME, "debugEnabled");
    if (!debugEnabled && logLevel != 3) return;
    switch (logType) {
        case "c": // console
            switch (logLevel) {
                case "1": // info/log
                    console.log(`%c${LOG_LABEL}  ${logMsg}`, "color: orange; font-weight: bold;");
                    break;
                case "2": // warn
                    console.warn(`${LOG_LABEL}  ${logMsg}`);
                    break;
                case "3": // error
                    console.error(`${LOG_LABEL}  ${logMsg}`);
                    break;
                default:
                    console.log(`%c${LOG_LABEL}  ${logMsg}`, "color: orange; font-weight: bold;");
            }
            break;
        case "u": // ui
            switch (logLevel) {
                case "1": // info/log
                    ui.notifications.info(`${LOG_LABEL}  ${logMsg}`);
                    break;
                case "2": // warn
                    ui.notifications.warn(`${LOG_LABEL}  ${logMsg}`);
                    break;
                case "3": // error
                    ui.notifications.error(`${LOG_LABEL}  ${logMsg}`);
                    break;
                default:
                    ui.notifications.info(logMsg);
            }
            break;
        default:
            console.warn(`${LOG_LABEL}  Invalid log event.`);
    }
}

/**
  Checks if an actor is valid for reroll tracking.
 
  An actor is considered valid if it meets the following conditions:
  1. The actor is of type 'character'.
  2. Unless "Ignore Minions" is disabled in settings, ensure actor does not have the 'minion' trait in its list of traits.
 
  @param {Object} actor - The actor object to check.
  @returns {boolean} - Returns true if the actor is valid for reroll tracking, false otherwise.
 */
function isValidActorForRerollTracking(actor) {
    // Check if the actor is a character
    const isCharacter = actor.type === "character";

	// Check if we are ignoring minions in settings
	const ignoreMinion = game.settings.get(MODULE_NAME, "ignoreMinion");
	if (!ignoreMinion) {
		return isCharacter;
	} else {
	
		// Ensure the actor has traits and check if the 'minion' trait exists
		const traits = actor.system.traits?.value || [];
		debugLog(`Actor Traits: ${traits}`);

		const hasMinionTrait = traits.includes("minion");
		debugLog(`Has Minion Trait: ${hasMinionTrait}`);
		
		// Return true if it's a character and not a minion
		return isCharacter && !hasMinionTrait;
	}
}

// Save rollDataByActor to settings
async function saveRollData() {
    // Only save data if the user is the GM
    if (game.user.isGM) {
        await game.settings.set(MODULE_NAME, "rollData", rollDataByActor);
        debugLog("Reroll data saved.");
		
    } else {
        debugLog("Player cannot save reroll data.");
    }
}

// Function to reset reroll data for ALL actors
function resetAllRerollStats() {
    // Loop through all actors in the world and reset their data
    for (const actorId in rollDataByActor) {
        if (rollDataByActor.hasOwnProperty(actorId)) {
            rollDataByActor[actorId] = {
                originalRoll: null,
                rerollCount: 0,
                betterCount: 0,
                worseCount: 0,
                sameCount: 0,
                successCount: 0,
                critSuccessCount: 0,
            };
        }
    }

    // Save the reset data persistently
    saveRollData();

    // Provide feedback to the GM
    ui.notifications.info("All reroll data has been reset for all actors.");
}

// Function to reset reroll data for the selected tokens
function resetRerollStats() {
    // Get the selected tokens
    const tokens = canvas.tokens.controlled;
    
    // Check if any tokens are selected
    if (tokens.length === 0) {
        ui.notifications.warn("No tokens selected. Please select one or more tokens.");
        return;
    }

    let resetCount = 0;

    // Loop through each selected token
    tokens.forEach(token => {
        const actor = token.actor;
        if (!actor) {
            return; // Skip if the token has no associated actor
            debugLog("Token has no associated actor!");
        }

        const actorId = actor.id;

        // Check if actor data exists in rollDataByActor
        if (!rollDataByActor[actorId]) {
            debugLog(`No reroll data found for actor: ${actor.name}`, "u", 2);
            return;
        }

        // Reset the actor's reroll data
        rollDataByActor[actorId] = {
            originalRoll: null,
            rerollCount: 0,
            betterCount: 0,
            worseCount: 0,
            sameCount: 0,
            successCount: 0,
            critSuccessCount: 0,
        };

        resetCount++;
    });

    // Save the reset data persistently
    saveRollData();

    // Provide feedback to the GM
    ui.notifications.info(`${resetCount} actor(s) had their reroll data reset.`);
}

// Function to display actor stats in chat
function displayActorStatsInChat() {
    
	// Get the selected token's actor
    const token = canvas.tokens.controlled[0];
    if (!token) {
        ui.notifications.error("No token selected. Please select a token.");
        return;
    }
    const actor = token.actor;
    if (!actor) { // make sure an actor exists for token
        ui.notifications.error("Selected token has no associated actor.");
        return;
    }

    const actorId = actor.id;
    const actorName = actor.name;
    const actorData = rollDataByActor[actorId];

    if (!actorData) {
        ui.notifications.info(`No reroll data found for actor: ${actorName}`);
        return;
    }

    // Calculate success percentage based on reroll outcomes
    const { rerollCount, betterCount, worseCount, sameCount, successCount, critSuccessCount } = actorData;
    
	// Calculate the success percentage based on the successCount and rerollCount
	const successPercentage = (
		(actorData.successCount / actorData.rerollCount) * 100
	).toFixed(2);
	const critsuccessPercentage = (
		(actorData.critSuccessCount / actorData.rerollCount) * 100
	).toFixed(2);
	
	// Prepare the chat message content
    const messageContent = `
        <h2>Reroll Stats for ${actorName}</h2>
        <ul>
            <li><strong>Reroll Count:</strong> ${rerollCount}</li>
            <li><strong>Better Results:</strong> ${betterCount}</li>
            <li><strong>Worse Results:</strong> ${worseCount}</li>
            <li><strong>Same Results:</strong> ${sameCount}</li>
			<li><strong>Reroll Sucess:</strong> ${successCount}</li>
			<li><strong>Reroll Crit:</strong> ${critSuccessCount}</li>
            <li><strong>Success Percentage:</strong> ${successPercentage}%</li>
            <li><strong>Crit Success Percentage:</strong> ${critsuccessPercentage}%</li>
        </ul>
    `;

    // Send the message to chat
    ChatMessage.create({
        user: game.user.id,
        content: messageContent,
        speaker: { 
			alias: "Reroll Tracker"
		},		
    });
}

// Function to compile actor stats into a journal entry with totals and pages
async function compileActorStatsToJournal() {
    let journalContent = "<h1>Reroll Stats</h1>";

    // Initialize totals
    let totalRerollCount = 0;
    let totalBetterCount = 0;
    let totalWorseCount = 0;
    let totalSameCount = 0;
    let totalSuccessCount = 0;
    let totalCritSuccessCount = 0;
	let actorsuccessPercentage = 0;
	let actorcritsuccessPercentage = 0;

    // Compile individual actor stats
    for (const [actorId, stats] of Object.entries(rollDataByActor)) {
        const actor = game.actors.get(actorId);
        if (!actor) continue;

		// Calculate the success percentage based on the successCount and rerollCount
		actorsuccessPercentage = (
			(stats.successCount / stats.rerollCount) * 100
		).toFixed(2);
		actorcritsuccessPercentage = (
			(stats.critSuccessCount / stats.rerollCount) * 100
		).toFixed(2);

        journalContent += `
            <h2>${actor.name}</h2>
            <ul>
                <li><strong>Total Reroll Count:</strong> ${stats.rerollCount || 0}</li>
                <li><strong>Total Better Results:</strong> ${stats.betterCount || 0}</li>
                <li><strong>Total Worse Results:</strong> ${stats.worseCount || 0}</li>
                <li><strong>Total Same Results:</strong> ${stats.sameCount || 0}</li>
                <li><strong>Total Success Count:</strong> ${stats.successCount || 0}</li>
                <li><strong>Total Critical Success Count:</strong> ${stats.critSuccessCount || 0}</li>
				<li><strong>Success Percentage:</strong> ${actorsuccessPercentage}%</li>
				<li><strong>Crit Success Percentage:</strong> ${actorcritsuccessPercentage}%</li>
            </ul>
        `;

        // Aggregate totals
        totalRerollCount += stats.rerollCount || 0;
        totalBetterCount += stats.betterCount || 0;
        totalWorseCount += stats.worseCount || 0;
        totalSameCount += stats.sameCount || 0;
        totalSuccessCount += stats.successCount || 0;
        totalCritSuccessCount += stats.critSuccessCount || 0;
    }

    // Calculate percentages
    const successPercentage = totalRerollCount > 0
        ? ((totalSuccessCount / totalRerollCount) * 100).toFixed(2)
        : "N/A";
    const critSuccessPercentage = totalRerollCount > 0
        ? ((totalCritSuccessCount / totalRerollCount) * 100).toFixed(2)
        : "N/A";

    // Append totals section
    journalContent += `
        <h2>Total Stats</h2>
        <ul>
            <li><strong>Total Reroll Count:</strong> ${totalRerollCount}</li>
            <li><strong>Total Better Results:</strong> ${totalBetterCount}</li>
            <li><strong>Total Worse Results:</strong> ${totalWorseCount}</li>
            <li><strong>Total Same Results:</strong> ${totalSameCount}</li>
            <li><strong>Total Success Percentage:</strong> ${successPercentage}%</li>
            <li><strong>Total Critical Success Percentage:</strong> ${critSuccessPercentage}%</li>
        </ul>
    `;

    // Define the journal entry name
    const journalName = "Reroll Stats";
    let journalEntry = game.journal.getName(journalName);

	// Set Permissions
	const defaultPermissions = Object.fromEntries(
        game.users.map(user => [user.id, user.isGM ? 3 : 2]) // 3: Owner, 2: Observer
    );

    if (!journalEntry) {
        // Create a new journal entry with a page
        journalEntry = await JournalEntry.create({
            name: journalName,
            pages: [{
                name: "Stats",
                type: "text",
                text: {
                    content: journalContent,
                    format: 1 // HTML format
                }
            }],
			ownership: defaultPermissions
        });
    } else {
        // Update the existing journal entry's first page
        const page = journalEntry.pages.contents[0];
        if (page) {
            await page.update({
                text: {
                    content: journalContent
                }
            });
        } else {
            // Add a new page if none exist
            await journalEntry.createEmbeddedDocuments("JournalEntryPage", [{
                name: "Stats",
                type: "text",
                text: {
                    content: journalContent,
                    format: 1 // HTML format
                }
            }]);
        }
    }

    // Notify the user
    debugLog("Hero Point Reroll Stats have been compiled into a journal entry.");
}

// Function to display combined reroll stats for all actors
function displayCombinedRerollStats() {
    // Aggregate stats
    let totalRerollCount = 0;
    let totalBetterCount = 0;
    let totalWorseCount = 0;
    let totalSameCount = 0;
    let totalSuccessCount = 0;
    let totalCritSuccessCount = 0;

    for (const stats of Object.values(rollDataByActor)) {
        totalRerollCount += stats.rerollCount;
        totalBetterCount += stats.betterCount;
        totalWorseCount += stats.worseCount;
        totalSameCount += stats.sameCount;
        totalSuccessCount += stats.successCount;
        totalCritSuccessCount += stats.critSuccessCount;
    }

    // Calculate success percentages
    const successPercentage = totalRerollCount > 0 
        ? ((totalSuccessCount / totalRerollCount) * 100).toFixed(2)
        : "N/A";

    const critSuccessPercentage = totalRerollCount > 0 
        ? ((totalCritSuccessCount / totalRerollCount) * 100).toFixed(2)
        : "N/A";

    // Prepare message content
    const messageContent = `
        <h2>Reroll Stats totals</h2>
        <ul>
            <li><strong>Total Reroll Count:</strong> ${totalRerollCount}</li>
            <li><strong>Better Results:</strong> ${totalBetterCount}</li>
            <li><strong>Worse Results:</strong> ${totalWorseCount}</li>
            <li><strong>Same Results:</strong> ${totalSameCount}</li>
            <li><strong>Success Percentage:</strong> ${successPercentage}%</li>
            <li><strong>Critical Success Percentage:</strong> ${critSuccessPercentage}%</li>
        </ul>
    `;

    // Send the message to chat
    ChatMessage.create({
        user: game.user.id,
        content: messageContent,
        speaker: { alias: "Combined Reroll Tracker" },
    });

    // Optional: Log combined stats to the console
    debugLog("Combined reroll stats calculated and displayed.");
}

// Function to delete all roll data for a selected token's actor
function deleteActorRollData() {
    // Get the selected tokens
    const tokens = canvas.tokens.controlled;

    // Check if any tokens are selected
    if (tokens.length === 0) {
        ui.notifications.warn("No tokens selected. Please select one or more tokens.");
        return;
    }

    let deletedCount = 0;

    // Loop through each selected token
    tokens.forEach(token => {
        const actor = token.actor;
        if (!actor) {
            debugLog("Token has no associated actor!", "u", 2);
            return;
        }

        const actorId = actor.id;

        // Check if roll data exists for this actor
        if (rollDataByActor[actorId]) {
            // Delete the roll data for the actor
            delete rollDataByActor[actorId];
            debugLog(`Deleted roll data for actor: ${actor.name}`);
            deletedCount++;
        } else {
            debugLog(`No roll data found for actor: ${actor.name}`, "u", 2);
        }
    });

    // Save the updated roll data persistently
    saveRollData(); // Save Roll Data
	compileActorStatsToJournal(); // Update Journal

    // Provide feedback to the GM
    if (deletedCount > 0) {
        ui.notifications.info(`${deletedCount} actor(s) had their roll data deleted.`);
    } else {
        ui.notifications.info("No roll data found to delete for the selected actors.");
    }
}

// Function to delete all reroll data - optional to delete journal also
function deleteAllRerollStats(deleteJournal = false) {
    // Confirm before proceeding
    new Dialog({
        title: "Delete All Reroll Stats",
        content: `
            <p>Are you sure you want to delete all Hero Point reroll stats?</p>
            ${deleteJournal ? "<p>The associated journal entry will also be deleted.</p>" : ""}
        `,
        buttons: {
            yes: {
                icon: '<i class="fas fa-trash"></i>',
                label: "Yes",
                callback: async () => {
                    // Clear the roll data
                    rollDataByActor = {};
                    debugLog("All Hero Point reroll stats have been cleared.", "c", 2);

                    // Optionally delete the journal entry
                    if (deleteJournal) {
                        const journalName = "Reroll Stats";
                        const journalEntry = game.journal.getName(journalName);
                        if (journalEntry) {
                            await journalEntry.delete();
                            debugLog(`Journal entry "${journalName}" has been deleted.`, "c", 2);
                        } else {
                            debugLog(`Journal entry "${journalName}" not found.`, "c", 2);
                        }
                    }
					saveRollData();
                    // Notify the user
                    debugLog("All Hero Point reroll stats have been deleted.");
                }
            },
            no: {
                icon: '<i class="fas fa-times"></i>',
                label: "No",
                callback: () => debugLog("Delete action cancelled.")
            }
        },
        default: "no"
    }).render(true);
}

// Function to open screen to edit actor reroll data
async function openRerollEditor() {
    
	// Retrieve stored reroll data
    if (!rollDataByActor || Object.keys(rollDataByActor).length === 0) {
        ui.notifications.info("No actors with reroll data found.");
        return;
    }

    // Create an HTML form with enhanced styling
    const content = `
    <form style="width: 100%; height: 100%; max-height: 600px; overflow-y: auto; padding: 5px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
        <div style="width: 300px; margin-bottom: 20px;">
            <select id="actor-select" style="width: 100%; padding: 8px; font-size: 1em; border: 1px solid #ccc; border-radius: 4px;">
			<option>- Select Actor -</option>
                ${Object.keys(rollDataByActor).map(actorId => {
                    const actor = game.actors.get(actorId);
                    return actor ? `<option value="${actorId}">${actor.name}</option>` : "";
                }).join("")}
            </select>
        </div>
        <div id="reroll-data" style="display:none; margin-top: 10px;">
            ${["rerollCount", "betterCount", "worseCount", "sameCount", "successCount", "critSuccessCount"].map(field => `
                <div style="margin-bottom: 15px;">
                    
					
					<label style="width: 225px; font-size: 1em;  text-transform: capitalize;">${field.replace(/([A-Z])/g, " $1")}: <span id="${field}" style="font-weight: bold;">0</span></label>
                    <div style="width: 75px;">
                        <button type="button" class="increase" data-field="${field}" style="width: 30px; height: 30px; font-size: 1em; border: 1px solid #007bff; border-radius: 4px; background-color: #e7f1ff; color: #007bff;">+</button>
                        <button type="button" class="decrease" data-field="${field}" style="width: 30px; height: 30px; font-size: 1em; border: 1px solid #dc3545; border-radius: 4px; background-color: #ffe7e7; color: #dc3545;">-</button>
                    </div>
                </div>
            `).join("")}
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button type="button" id="save-reroll-data" style="width: 100%; padding: 5px; font-size: 1.2em; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Save</button>
        </div>
    </form>
    `;

    // Create a dialog window
    const dialog = new Dialog({
        title: "Edit Reroll Data",
        content: content,
        buttons: {},
        render: html => {
            const actorSelect = html.find("#actor-select")[0];
            const rerollDataContainer = html.find("#reroll-data")[0];

            // Update the fields when an actor is selected
            actorSelect.addEventListener("change", () => {
                const selectedActorId = actorSelect.value;
                if (rollDataByActor[selectedActorId]) {
                    const actorData = rollDataByActor[selectedActorId];

                    // Update each field
                    ["rerollCount", "betterCount", "worseCount", "sameCount", "successCount", "critSuccessCount"].forEach(field => {
                        html.find(`#${field}`).text(actorData[field] || 0);
                    });

                    rerollDataContainer.style.display = "block";
                }
            });

            // Handle button clicks to adjust values
            html.on("click", ".increase, .decrease", event => {
                const button = event.currentTarget;
                const field = button.dataset.field;
                const change = button.classList.contains("increase") ? 1 : -1;
                const selectedActorId = actorSelect.value;

                if (rollDataByActor[selectedActorId]) {
                    const actorData = rollDataByActor[selectedActorId];
                    actorData[field] = (actorData[field] || 0) + change;
                    html.find(`#${field}`).text(actorData[field]);
                }
            });

            // Save button functionality
            html.find("#save-reroll-data").click(async () => {
				                				
                const selectedActorId = actorSelect.value;
                if (rollDataByActor[selectedActorId]) {
					const actorData = rollDataByActor[selectedActorId];
					
					// First, make sure the values add up mathematically
					if (
						(actorData.betterCount || 0) + 
						(actorData.worseCount || 0) + 
						(actorData.sameCount || 0) !== 
						(actorData.rerollCount || 0)
					) {
						ui.notifications.error("Error: Reroll count data does not add up correctly!");
						return;
					}
					
					// Check if successCount or critSuccessCount is greater than betterRolls
					if (
						(actorData.success || 0) > (actorData.betterRolls || 0) || 
						(actorData.critSuccess || 0) > (actorData.betterRolls || 0)
					) {
						ui.notifications.error("Error: Success or Crit Success count cannot exceed Better Rolls count!");
						return;
					}
					
					// prompt for confirmation
                    const confirmed = await Dialog.confirm({
                        title: "Save Changes",
                        content: "Are you sure you want to save edited data?",
                    });

					// If yes
                    if (confirmed) {
                        // await game.settings.set(MODULE_NAME, "rollData", rollDataByActor);
						saveRollData();
						compileActorStatsToJournal();
                        ui.notifications.info("Reroll data saved successfully.");
						dialog.close();
                    } else {
                        dialog.close();
                    }
                }		
			
            });
			
			// Enable resizable functionality
            const dialogElement = html.closest(".app");
            dialogElement.css({
                "resize": "both",
                "overflow": "auto",
                "max-height": "100vh",
                "max-width": "100vw"
            });
        },
		resizable: true, // Allow resizing of the dialog
		width: 300,
        height: 400
    });

    dialog.render(true);
}

/**
 * Hook: createChatMessage
 * 
 * This hook triggers whenever a new chat message is created in Foundry VTT.
 * It listens for chat messages that contain d20 rolls and tracks reroll statistics
 * for valid player characters. This hook also updates the reroll data for the actor 
 * associated with the roll, allowing for tracking of better, worse, or identical roll outcomes.
 * 
 * **Hook Behavior**
 * 1. **Check User Permissions**: Ensures only GMs process the logic.
 * 2. **D20 Roll Detection**: Verifies if the chat message contains a roll with a d20.
 * 3. **Actor Validation**: Checks if the roll is linked to a valid actor and ignores non-characters or minions.
 * 4. **Reroll Detection**: Differentiates between initial rolls and rerolls.
 * 5. **Roll Comparison**: Compares the reroll result to the original roll to track if it is better, worse, or the same.
 * 6. **Data Persistence**: Saves actor-specific roll statistics to persistent storage.
 * 
 * **Tracked Data**
 * - `originalRoll`: The total of the actor's original roll before a reroll.
 * - `rerollCount`: The total number of rerolls made by the actor.
 * - `betterCount`: The number of rerolls that were better than the original roll.
 * - `worseCount`: The number of rerolls that were worse than the original roll.
 * - `sameCount`: The number of rerolls that were equal to the original roll.
 * - `successCount`: The total number of successful rerolls.
 * - `critSuccessCount`: The total number of critical success rerolls.
 * 
 * **Parameters**
 * @param {Object} message - The chat message being created.
 */
Hooks.on("createChatMessage", async (message) => {

    // Only process for GM
    if (!game.user.isGM) return;

    // Check if the message has rolls and if one of them is a d20 roll
    const isD20Roll = Array.isArray(message.rolls) && message.rolls.some(roll => 
        Array.isArray(roll.dice) && roll.dice.some(die => die.faces === 20)
    );

    if (!isD20Roll) {
        debugLog("Not a d20 roll.");
        return;
    }

    debugLog(`D20 roll detected...`);

    // Access the flags or context for the PF2e system
    const context = message.getFlag("pf2e", "context") || {};
    const actorId = context.actor || "Unknown Actor";
	
    // Retrieve the actor object
    const actor = game.actors.get(actorId);
    if (!actor) {
        debugLog(`No actor found for actorId: ${actorId}`, "c", 2);
        return;
    }

    // Check if actor is valid character
    if (!isValidActorForRerollTracking(actor)) {
        debugLog(`Ignoring roll from non-Player Character or minion actor: ${actor.name || "Unknown"}`, "c", 2);
        return;
    }

    // Initialize actor data if not already present
    if (!rollDataByActor[actorId]) {
        rollDataByActor[actorId] = {
            originalRoll: null,
            rerollCount: 0,
            betterCount: 0,
            worseCount: 0,
            sameCount: 0,
            successCount: 0,
            critSuccessCount: 0,
        };
    }

    // Retrieve actor stats
    const actorData = rollDataByActor[actorId] || {};

    // Variables to track the roll information
    let rerollCount = actorData.rerollCount || 0;
    let betterCount = actorData.betterCount || 0;
    let worseCount = actorData.worseCount || 0;
    let sameCount = actorData.sameCount || 0;
    let successCount = actorData.successCount || 0;
    let critSuccessCount = actorData.critSuccessCount || 0;
    let successPercentage = 0;
    let critsuccessPercentage = 0;

    // Check if it is a ReRoll
    if (context?.isReroll) {
        debugLog("ReRoll detected!");

        // Get the outcome of the reroll from the context (success / critical success)
        const outcome = context?.outcome || "Unknown";

        // Compare the reroll with the original roll to determine if it's better or worse
        const rerollResult = message.rolls[0]?.total;
        const originalRoll = actorData.originalRoll;

        if (originalRoll !== null) {
            if (rerollResult > originalRoll) {
                actorData.betterCount += 1;
                debugLog(`Reroll is better than the original.`);
            } else if (rerollResult < originalRoll) {
                actorData.worseCount += 1;
                debugLog(`Reroll is worse than the original.`);
            } else {
                actorData.sameCount += 1;
                debugLog(`Reroll is the same as the original.`);
            }

            // Increase reroll total
            actorData.rerollCount += 1; 

            // Calculate and log success percentage based on outcome
            if (outcome === "success") {
                actorData.successCount += 1;
                debugLog(`Reroll was a success.`);
            } else if (outcome === "criticalSuccess") {
                actorData.critSuccessCount += 1;
                debugLog(`Reroll was a critical success.`);
            } 

            // Calculate the success percentage based on the successCount and rerollCount
            successPercentage = ((actorData.successCount / actorData.rerollCount) * 100).toFixed(2);
            critsuccessPercentage = ((actorData.critSuccessCount / actorData.rerollCount) * 100).toFixed(2);
            debugLog(`Actor ${actorId}'s success percentage: ${successPercentage}%`);
            debugLog(`Actor ${actorId}'s critical success percentage: ${critsuccessPercentage}%`);
        } else {
            debugLog(`No original roll found for actor ${actorId}.`);
        }
		
		// Save RollData
		await saveRollData();
		
		// Output to chat if enabled in settings
		const outputToChat = game.settings.get(MODULE_NAME, "outputToChat");
		debugLog(`outputToChat: ${outputToChat} | Actor Name: ${actor.name}`);
		if (outputToChat) {
			const messageContent = `
				<h2>Reroll Stats for ${actor.name}</h2>
				<ul>
					<li><strong>Reroll Count:</strong> ${actorData.rerollCount}</li>
					<li><strong>Better Results:</strong> ${actorData.betterCount}</li>
					<li><strong>Worse Results:</strong> ${actorData.worseCount}</li>
					<li><strong>Same Results:</strong> ${actorData.sameCount}</li>
					<li><strong>Reroll Success:</strong> ${actorData.successCount}</li>
					<li><strong>Reroll Crit:</strong> ${actorData.critSuccessCount}</li>
					<li><strong>Success Percentage:</strong> ${successPercentage}%</li>
					<li><strong>Crit Success Percentage:</strong> ${critsuccessPercentage}%</li>
				</ul>
			`;

			// Send the message to chat
			ChatMessage.create({
				user: game.user.id,
				content: messageContent,
				speaker: { alias: "Reroll Tracker" },		
			});
		}
    } else {
        debugLog("Original D20 roll detected (not a reroll).");
		
        // Save the original roll for this actor
        actorData.originalRoll = message.rolls[0]?.total; // Save total roll value
        debugLog(`Original roll saved for actor ${actorId}: ${actorData.originalRoll}`);
    }

    // Save data persistently and compile stats
    
    await compileActorStatsToJournal();

    
});


/**
 * Hook: updateChatMessage
 * 
 * Description:
 * This hook listens for updates to chat messages in Foundry VTT. It specifically looks for "saves" data provided 
 * by the **pf2e-toolbelt** module under `flags.pf2e-toolbelt.targetHelper.saves`. The primary goal is to track 
 * reroll data for saving throws made by actors in the game, similar to how rerolls are tracked for other chat messages.
 * 
 * Functionality:
 * - **Token Lookup**: Finds the token on the canvas using `canvas.tokens.placeables`, ensuring both linked and unlinked 
 *   tokens are accounted for.
 * - **Actor Verification**: Confirms the actor associated with the token is valid for reroll tracking, ensuring minions, 
 *   NPCs, or invalid actors are excluded.
 * - **Roll Parsing**: Parses the save roll from the JSON string to extract total roll value, die value, reroll status, 
 *   and the degree of success.
 * - **Data Handling**: Tracks the reroll logic and calculates better, worse, or same roll outcomes for each actor. 
 *   Updates persistent roll tracking data for each actor.
 * - **Logging**: Uses `debugLog` to output key details about token lookups, actor validation, roll outcomes, 
 *   and reroll performance.
 * 
 * Key Variables:
 * - **message**: The chat message object that was updated.
 * - **updateData**: The data that was used to update the message.
 * - **options**: Options related to the update.
 * - **userId**: The ID of the user who made the update.
 * 
 * Example Log Messages:
 * ```
 * Detected saves in pf2e-toolbelt targetHelper
 * Processing save for tokenId: kJMtxiKsaRZ8E9o7
 * Token ID: kJMtxiKsaRZ8E9o7 | Roll Total: 29 | Die: 17 | Outcome: success | Degree of Success: 2 | Is Reroll: false
 * Original roll saved for actor: Pestilence
 * ```
 * 
 * Important Notes:
 * - **Token Resolution**: Tokens are resolved using `canvas.tokens.placeables` instead of `game.actors.tokens`, 
 *   as the latter only tracks linked tokens.
 * - **Actor Validation**: Uses the `isValidActorForRerollTracking` function to ensure the actor is a valid PC and 
 *   not a minion or temporary entity.
 * - **Data Persistence**: Calls `saveRollData()` to store all roll tracking information to game settings.
 * 
 * @param {ChatMessage} message - The updated chat message object.
 * @param {Object} updateData - The data used to update the message.
 * @param {Object} options - Additional options related to the update.
 * @param {string} userId - The ID of the user who made the update.
 */
Hooks.on("updateChatMessage", async (message, updateData, options, userId) => {
    
    // Check if "pf2e-toolbelt" is active - otherwise exit hook
    const isToolbeltEnabled = game.modules.get('pf2e-toolbelt')?.active;
    if (!isToolbeltEnabled) {
        debugLog('pf2e-toolbelt is not enabled. Exiting hook.');
        return; // Exit early if the module is not enabled
    }
	
    // Only process for GM
    if (!game.user.isGM) return;

    // Check if the message contains targetHelper saves information
    const saves = message.flags?.["pf2e-toolbelt"]?.targetHelper?.saves;
    if (!saves) return;

    debugLog("Detected saves in pf2e-toolbelt targetHelper", "c", 1);

    // Loop through each save in the targetHelper saves
    for (const [tokenId, saveData] of Object.entries(saves)) {
        debugLog(`Processing save for tokenId: ${tokenId}`, "c", 1);

        // Locate the token on the canvas
        const token = canvas.tokens.placeables.find(t => t.id === tokenId);
        if (!token) {
            debugLog(`No token found for tokenId: ${tokenId}`, "c", 2);
            continue;
        }

        const actor = token.actor;
        if (!actor) {
            debugLog(`No actor found for tokenId: ${tokenId}`, "c", 2);
            continue;
        }

        // Parse the roll from the 'roll' property (stored as JSON string)
        let rollData = {};
        try {
            rollData = JSON.parse(saveData.roll);
        } catch (error) {
            debugLog(`Failed to parse roll data for tokenId: ${tokenId}`, "c", 3);
            continue;
        }

        // Extract relevant data from the roll and save context
        const rollTotal = rollData.total || saveData.value;
        const rollDie = saveData.die;
        const successState = saveData.success; // success, failure, etc.
        const isReroll = rollData?.options?.isReroll ?? false;
        const outcome = saveData.success || "unknown";

        debugLog(
            `Token ID: ${tokenId} | Roll Total: ${rollTotal} | Die: ${rollDie} | Outcome: ${outcome} | Is Reroll: ${isReroll}`,
            "c",
            1
        );

        // Process the roll for reroll tracking (similar to the logic in createChatMessage hook)
        const actorId = actor.id;

        // Check if actor is valid character
        if (!isValidActorForRerollTracking(actor)) {
            debugLog(`Ignoring roll from non-Player Character or minion actor: ${actor?.name || "Unknown"}`, "c", 2);
            continue;
        }

        // Initialize actor data if not already present
        if (!rollDataByActor[actorId]) {
            rollDataByActor[actorId] = {
                originalRoll: null,
                rerollCount: 0,
                betterCount: 0,
                worseCount: 0,
                sameCount: 0,
                successCount: 0,
                critSuccessCount: 0,
            };
        }

        // Retrieve actor stats
        const actorData = rollDataByActor[actorId];
		
		// Variables to track the roll information
		let rerollCount = actorData.rerollCount || 0;
		let betterCount = actorData.betterCount || 0;
		let worseCount = actorData.worseCount || 0;
		let sameCount = actorData.sameCount || 0;
		let successCount = actorData.successCount || 0;
		let critSuccessCount = actorData.critSuccessCount || 0;
		let successPercentage = 0;
		let critsuccessPercentage = 0;
		
        // Check if it is a reroll
        if (isReroll) {
            debugLog("ReRoll detected from targetHelper save!", "c", 1);

            // Compare the reroll with the original roll to determine if it's better or worse
            const rerollResult = rollTotal;
            const originalRoll = actorData.originalRoll;

            // Check if there was an original roll
            if (originalRoll !== null) {
                if (rerollResult > originalRoll) {
                    actorData.betterCount += 1;
                    debugLog(`Reroll is better than the original.`);
                } else if (rerollResult < originalRoll) {
                    actorData.worseCount += 1;
                    debugLog(`Reroll is worse than the original.`);
                } else {
                    actorData.sameCount += 1;
                    debugLog(`Reroll is the same as the original.`);
                }

                // Increase reroll total
                actorData.rerollCount += 1;

                // Calculate and log success percentage based on outcome
                if (outcome === "success") {
                    actorData.successCount += 1;
                    debugLog(`Reroll was a success.`);
                } else if (outcome === "criticalSuccess") {
                    actorData.critSuccessCount += 1;
                    debugLog(`Reroll was a critical success.`);
                }

                // Calculate the success percentage based on the successCount and rerollCount
                const successPercentage = (
                    (actorData.successCount / actorData.rerollCount) * 100
                ).toFixed(2);
                debugLog(`Actor ${actorId}'s success percentage: ${successPercentage}%`);
                const critSuccessPercentage = (
                    (actorData.critSuccessCount / actorData.rerollCount) * 100
                ).toFixed(2);
                debugLog(`Actor ${actorId}'s critical success percentage: ${critSuccessPercentage}%`);
            } else {
                // No original roll
                debugLog(`No original roll found for actor ${actorId}.`);
            }
			
			// Save RollData
			await saveRollData();
			
			// Output to chat if enabled in settings
			const outputToChat = game.settings.get(MODULE_NAME, "outputToChat");
			debugLog(`outputToChat: ${outputToChat} | Actor Name: ${actor.name}`);
			if (outputToChat) {
				const messageContent = `
					<h2>Reroll Stats for ${actor.name}</h2>
					<ul>
						<li><strong>Reroll Count:</strong> ${actorData.rerollCount}</li>
						<li><strong>Better Results:</strong> ${actorData.betterCount}</li>
						<li><strong>Worse Results:</strong> ${actorData.worseCount}</li>
						<li><strong>Same Results:</strong> ${actorData.sameCount}</li>
						<li><strong>Reroll Success:</strong> ${actorData.successCount}</li>
						<li><strong>Reroll Crit:</strong> ${actorData.critSuccessCount}</li>
						<li><strong>Success Percentage:</strong> ${successPercentage}%</li>
						<li><strong>Crit Success Percentage:</strong> ${critsuccessPercentage}%</li>
					</ul>
				`;

				// Send the message to chat
				await ChatMessage.create({
					user: game.user.id,
					content: messageContent,
					speaker: { alias: "Reroll Tracker" },		
				});
			}
        } else {
            debugLog("Original D20 roll detected (not a reroll).");
            // Save the original roll for this actor
            actorData.originalRoll = rollTotal; // Save total roll value
            debugLog(`Original roll saved for actor ${actorId}: ${actorData.originalRoll}`);
        }

        // Save data persistently
        await compileActorStatsToJournal();
    }
});

