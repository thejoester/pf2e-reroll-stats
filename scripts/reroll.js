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
function saveRollData() {
    // Only save data if the user is the GM
    if (game.user.isGM) {
        game.settings.set(MODULE_NAME, "rollData", rollDataByActor);
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
    if (!actor) {
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
            <li><strong>Crit Success Percentage:</strong> ${successPercentage}%</li>
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


// Hook into chat messages
Hooks.on("createChatMessage", (message) => {
    // Only process for GM
    if (!game.user.isGM) {
        return; // Prevent players from processing reroll logic
    }

    // Check if the message has rolls and if one of them is a d20 roll
    const isD20Roll = message.rolls?.some(roll => 
        roll.dice?.some(die => die.faces === 20)
    );

    if (isD20Roll) {
        debugLog(`D20 roll detected...`);

        // Access the flags or context for the PF2e system
        const context = message.getFlag("pf2e", "context");
        const actorId = context?.actor || "Unknown Actor";
		
		// Retrieve the actor object
        const actor = game.actors.get(actorId);

        // Check if actor is valid character
        if (!isValidActorForRerollTracking(actor)) {
            debugLog(`Ignoring roll from non-Player Character or minion actor: ${actor?.name || "Unknown"}`,"c",2);
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
        const actorData = rollDataByActor[actorId];

		// Check if it is a ReRoll
        if (context?.isReroll) {
            debugLog("ReRoll detected!");

            // Get the outcome of the reroll from the context (success / critical success)
            const outcome = context?.outcome || "Unknown";

            // Compare the reroll with the original roll to determine if it's better or worse
            const rerollResult = message.rolls[0]?.total;
            const originalRoll = actorData.originalRoll;

			// Check if there was an original roll
            if (originalRoll !== null) { // original roll found
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
				const critsuccessPercentage = (
                    (actorData.critSuccessCount / actorData.rerollCount) * 100
                ).toFixed(2);
                debugLog(`Actor ${actorId}'s critical success percentage: ${critsuccessPercentage}%`);
            } else { // No original roll
                debugLog(`No original roll found for actor ${actorId}.`);
            }
        } else {
            debugLog("Original D20 roll detected (not a reroll).");

            // Save the original roll for this actor
            actorData.originalRoll = message.rolls[0]?.total; // Save total roll value
            debugLog(`Original roll saved for actor ${actorId}: ${actorData.originalRoll}`);
        }

        // Save data persistently
        saveRollData();
		compileActorStatsToJournal();
		
    } else {
        debugLog("Not a d20 roll.");
    }
});