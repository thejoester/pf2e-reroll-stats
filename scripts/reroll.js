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
        name: "Output actor stats to chat after reroll?",
        hint: "Will output an actor's reroll stats in chat after each reroll.",
        scope: "world", 
        config: true,  
        type: Boolean,
        default: false,
		onChange: (value) => {
            debugLog(`PF2E Reroll Stats | Setting outputToChat: ${value}`);
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
    game.settings.register(MODULE_NAME, "debugLevel", {
        name: "Debug Level",
		hint: "Set the debug level for logging. None disables all logging, All includes info, warnings, and errors.",
		scope: "world",
		config: true,
		type: String,
		choices: {
			"none": "None",
			"error": "Errors",
			"warn": "Warnings",
			"all": "All"
		},
		default: "none", // Default to no logging
		requiresReload: true
	});
	const debugLevel = game.settings.get(MODULE_NAME, "debugLevel");
	console.log(`%cPF2e ReRoll Stats || Debugging: ${debugLevel}`, "color: orange; font-weight: bold;");

});

Hooks.once("ready", async () => {
    // Initialize rollDataByActor from game settings or as an empty object
    rollDataByActor = game.settings.get(MODULE_NAME, "rollData") || {};
    console.log(`%c${LOG_LABEL} Reroll Tracker ready!`, "color: Orange; font-weight: bold;");
});

/*
	Displays a confirmation dialog with a custom message.
	*Requires message, example: "This will delete all data." 
	*returns {Promise<boolean>} - Resolves to `true` if the user confirms, `false` otherwise.
 */
async function showConfirmationDialog(message) {
  return new Promise((resolve) => {
    new Dialog({
      title: "Confirmation",
      content: `<p>${message}</p><P>Are you sure?</p>`,
      buttons: {
        yes: {
          label: "Yes",
          callback: () => resolve(true),
        },
        no: {
          label: "No",
          callback: () => resolve(false),
        },
      },
      default: "no",
    }).render(true);
  });
}

// Function for debugging
function debugLog(intLogType, stringLogMsg, objObject = null) {
	// Handle the case where the first argument is a string
	if (typeof intLogType === "string") {
		objObject = stringLogMsg; // Shift arguments
		stringLogMsg = intLogType;
		intLogType = 1; // Default log type to 'all'
	}

	const debugLevel = game.settings.get(MODULE_NAME, "debugLevel");

	// Map debugLevel setting to numeric value for comparison
	const levelMap = {
		"none": 4,
		"error": 3,
		"warn": 2,
		"all": 1
	};

	const currentLevel = levelMap[debugLevel] || 4; // Default to 'none' if debugLevel is undefined

	// Check if the log type should be logged based on the current debug level
	if (intLogType < currentLevel) return;

	// Capture stack trace to get file and line number
	const stack = new Error().stack.split("\n");
	let fileInfo = "Unknown Source";
	for (let i = 2; i < stack.length; i++) {
		const line = stack[i].trim();
		const fileInfoMatch = line.match(/(\/[^)]+):(\d+):(\d+)/); // Match file path and line number
		if (fileInfoMatch) {
			const [, filePath, lineNumber] = fileInfoMatch;
			const fileName = filePath.split("/").pop(); // Extract just the file name
			// Ensure the file is one of the allowed files
			const allowedFiles = ["FormulaSearch.js", "LevelUp.js", "PowerfulAlchemy.js", "QuickAlchemy.js", "settings.js", "VialSearch.js"];
			if (allowedFiles.includes(fileName)) {
				fileInfo = `${fileName}:${lineNumber}`;
				break;
			}
		}
	}

	// Prepend the file and line info to the log message
	const formattedLogMsg = `[${fileInfo}] ${stringLogMsg}`;
	
	if (objObject) {
		switch (intLogType) {
			case 1: // Info/Log (all)
				console.log(`%c${LOG_LABEL} | ${formattedLogMsg}`, "color: orange; font-weight: bold;", objObject);
				break;
			case 2: // Warning
				console.log(`%c${LOG_LABEL} | WARNING: ${formattedLogMsg}`, "color: yellow; font-weight: bold;", objObject);
				break;
			case 3: // Critical/Error
				console.log(`%c${LOG_LABEL} | ERROR: ${formattedLogMsg}`, "color: red; font-weight: bold;", objObject);
				break;
			default:
				console.log(`%c${LOG_LABEL} | ${formattedLogMsg}`, "color: orange; font-weight: bold;", objObject);
		}
	} else {
		switch (intLogType) {
			case 1: // Info/Log (all)
				console.log(`%c${LOG_LABEL} | ${formattedLogMsg}`, "color: orange; font-weight: bold;");
				break;
			case 2: // Warning
				console.log(`%c${LOG_LABEL} | WARNING: ${formattedLogMsg}`, "color: yellow; font-weight: bold;");
				break;
			case 3: // Critical/Error
				console.log(`%c${LOG_LABEL} | ERROR: ${formattedLogMsg}`, "color: red; font-weight: bold;");
				break;
			default:
				console.log(`%c${LOG_LABEL} | ${formattedLogMsg}`, "color: orange; font-weight: bold;");
		}
	}
}

/*
	Function that checks if an actor is valid for reroll tracking.
 
	An actor is considered valid if it meets the following conditions:
	1. The actor is of type 'character'.
	2. Unless "Ignore Minions" is disabled in settings, ensure actor does not have the 'minion' trait in its list of traits.
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
		debugLog(`Actor Traits: `, traits);

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

    // Calculate percentages
    const { rerollCount, betterCount, worseCount, sameCount, successCount, critSuccessCount } = actorData;
	
	// Calculate percentages
	const actorBetterPct = Math.round((actorData.betterCount / actorData.rerollCount) * 100);
	const actorWorsePct = Math.round((actorData.worseCount / actorData.rerollCount) * 100);
	const actorSamePct = Math.round((actorData.sameCount / actorData.rerollCount) * 100);
	const actorSuccessPct = Math.round((actorData.successCount / actorData.rerollCount) * 100);
	const actorCritPct = Math.round((actorData.critSuccessCount / actorData.rerollCount) * 100);	
	const successPct = Math.round(((actorData.successCount + actorData.critSuccessCount) / actorData.rerollCount) * 100);
	const critPct = Math.round((actorData.critSuccessCount / actorData.rerollCount) * 100);
	
	// Prepare the chat message content
    const messageContent = `
        <h2>Reroll Stats for ${actorName}</h2>
        <ul>
            <li><strong>Reroll Count:</strong> ${rerollCount}</li>
            <li><strong>Better Results:</strong> ${betterCount} (${actorBetterPct}%)</li>
            <li><strong>Worse Results:</strong> ${worseCount} (${actorWorsePct}%)</li>
            <li><strong>Same Results:</strong> ${sameCount} (${actorSamePct}%)</li>
			<li><strong>Reroll Sucess:</strong> ${successCount + critSuccessCount} (${successPct}%)</li>
			<li><strong>Reroll Crit:</strong> ${critSuccessCount} (${critPct}%)</li>
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
	let actorBetterPct = 0;
	let actorWorsePct = 0;
	let actorSamePct = 0;
	let actorsuccessPercentage = 0;
	let actorcritsuccessPercentage = 0;

    // Compile individual actor stats
    for (const [actorId, stats] of Object.entries(rollDataByActor)) {
        const actor = game.actors.get(actorId);
        if (!actor) continue;

		// Calculate percentages
		actorBetterPct = Math.round((stats.betterCount / stats.rerollCount) * 100);
		actorWorsePct = Math.round((stats.worseCount / stats.rerollCount) * 100);
		actorSamePct = Math.round((stats.sameCount / stats.rerollCount) * 100);
		actorSuccessPct = Math.round(((stats.successCount + stats.critSuccessCount) / stats.rerollCount) * 100);
		actorCritPct = Math.round((stats.critSuccessCount / stats.rerollCount) * 100);

        journalContent += `
            <h2>${actor.name}</h2>
            <ul>
                <li><strong>Total Reroll Count:</strong> ${stats.rerollCount || 0}</li>
				<li><strong>Total Better Results:</strong> ${stats.betterCount || 0} (${actorBetterPct}%)</li>
                <li><strong>Total Worse Results:</strong> ${stats.worseCount || 0} (${actorWorsePct}%)</li>
                <li><strong>Total Same Results:</strong> ${stats.sameCount || 0} (${actorSamePct}%)</li>
                <li><strong>Total Success Count:</strong> ${stats.successCount + stats.critSuccessCount || 0} (${actorSuccessPct}%)</li>
                <li><strong>Total Critical Success Count:</strong> ${stats.critSuccessCount || 0} (${actorCritPct}%)</li>
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
	const totalBetterPct = totalRerollCount > 0 ? Math.round((totalBetterCount / totalRerollCount) * 100) : "N/A";
	const totalWorsePct = totalRerollCount > 0 ? Math.round((totalWorseCount / totalRerollCount) * 100) : "N/A";
	const totalSamePct = totalRerollCount > 0 ? Math.round((totalSameCount / totalRerollCount) * 100) : "N/A";
    const totalSuccessPct = totalRerollCount > 0 ? Math.round(((totalSuccessCount + totalCritSuccessCount) / totalRerollCount) * 100) : "N/A";
    const toalCritPct = totalRerollCount > 0 ? Math.round((totalCritSuccessCount / totalRerollCount) * 100) : "N/A";

    // Append totals section
    journalContent += `
        <h2>Total Stats</h2>
        <ul>
            <li><strong>Total Reroll Count:</strong> ${totalRerollCount}</li>
            <li><strong>Total Better Results:</strong> ${totalBetterCount} (${totalBetterPct}%)</li>
            <li><strong>Total Worse Results:</strong> ${totalWorseCount} (${totalWorsePct}%)</li>
            <li><strong>Total Same Results:</strong> ${totalSameCount} (${totalSamePct}%)</li>
            <li><strong>Total Success Results:</strong> ${totalSuccessCount} (${totalSuccessPct}%)</li>
            <li><strong>Total Critical Results:</strong> ${totalCritSuccessCount} (${toalCritPct}%)</li>
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
	const totalBetterPct = totalRerollCount > 0 ? Math.round((totalBetterCount / totalRerollCount) * 100) : "N/A";
	const totalWorsePct = totalRerollCount > 0 ? Math.round((totalWorseCount / totalRerollCount) * 100) : "N/A";
	const totalSamePct = totalRerollCount > 0 ? Math.round((totalSameCount / totalRerollCount) * 100) : "N/A";
	const totalSuccessPct = totalRerollCount > 0 ? Math.round(((totalSuccessCount + totalCritSuccessCount) / totalRerollCount) * 100) : "N/A";
	const totalCritPct = totalRerollCount > 0 ? Math.round((totalCritSuccessCount / totalRerollCount) * 100) : "N/A";	


    // Prepare message content
    const messageContent = `
        <h2>Reroll Stats totals</h2>
        <ul>
            <li><strong>Total Reroll Count:</strong> ${totalRerollCount}</li>
<li><strong>Better Results:</strong> ${totalBetterCount} (${totalBetterPct})%</li>
            <li><strong>Worse Results:</strong> ${totalWorseCount} (${totalWorsePct})%</li>
            <li><strong>Same Results:</strong> ${totalSameCount} (${totalSamePct})%</li>
            <li><strong>Success Percentage:</strong> ${totalSuccessCount + totalCritSuccessCount} (${totalSuccessPct})%</li>
            <li><strong>Critical Success Percentage:</strong> ${totalCritSuccessCount} (${totalCritPct})%</li>
        </ul>
    `;

    // Send the message to chat
    ChatMessage.create({
        user: game.user.id,
        content: messageContent,
        speaker: { alias: "Combined Reroll Tracker" },
    });
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

	const confirmation = showConfirmationDialog("This will DELETE all roll data for the selected token(s). This CANNOT be undone!");
	if (confirmation){
		let deletedCount = 0;

		// Loop through each selected token
		tokens.forEach(token => {
			const actor = token.actor;
			if (!actor) {
				ui.notifications.warn("Token has no associated actor!");
				return;
			}

			const actorId = actor.id;

			// Check if roll data exists for this actor
			if (rollDataByActor[actorId]) {
				// Delete the roll data for the actor
				delete rollDataByActor[actorId];
				debugLog(`Deleted roll data for ${actor.name}`);
				deletedCount++;
			} else {
				ui.notifications.warn(`No roll data found for actor: ${actor.name}`);
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
}

// Function to delete all reroll data - optional to delete journal also
async function deleteAllRerollStats(deleteJournal = false) {
	
	const confirmation = showConfirmationDialog("This will DELETE all roll data for ALL characters! This CANNOT be undone!");
	if (confirmation) {
		// Clear the roll data
		rollDataByActor = {};
		debugLog(2, "All Hero Point reroll stats have been cleared.");

		// Optionally delete the journal entry
		if (deleteJournal) {
			const journalName = "Reroll Stats";
			const journalEntry = game.journal.getName(journalName);
			if (journalEntry) {
				await journalEntry.delete();
				debugLog(2, `Journal entry "${journalName}" has been deleted.`);
			} else {
				debugLog(2, `Journal entry "${journalName}" not found.`);
			}
		}
		saveRollData();
		// Notify the user
		debugLog("All Hero Point reroll stats have been deleted.");
	}
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

/*
	Hook: createChatMessage
*/
Hooks.on("createChatMessage", async (message) => {

    // Only process for GM
    if (!game.user.isGM) return;

    // Check if the message has rolls and if one of them is a d20 roll
    const isD20Roll = Array.isArray(message.rolls) && message.rolls.some(roll => 
        Array.isArray(roll.dice) && roll.dice.some(die => die.faces === 20)
    );

    if (!isD20Roll) {
        return;
    }

    debugLog(`D20 roll detected!`);

    // Access the flags or context for the PF2e system
    const context = message.getFlag("pf2e", "context") || {};
    const actorId = context.actor || "Unknown Actor";
	
    // Retrieve the actor object
    const actor = game.actors.get(actorId);
    if (!actor) {
        debugLog(2, `No actor found for actorId: ${actorId}`);
        return;
    }

    // Check if actor is valid character
    if (!isValidActorForRerollTracking(actor)) {
        debugLog(2, `Ignoring roll from non-Player Character or minion actor: ${actor.name || "Unknown"}`);
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
    let actorBetterPct = 0;
	let actorWorsePct = 0;
	let actorSamePct = 0;
	let actorSuccessPct = 0;
	let actorCritPct = 0;
	let successPct = 0;
	let critPct = 0;
			
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

        } else {
            debugLog(2,`No original roll found for actor ${actorId}.`);
        }
		
		// Calculate percentages
		actorBetterPct = Math.round((actorData.betterCount / actorData.rerollCount) * 100);
		actorWorsePct = Math.round((actorData.worseCount / actorData.rerollCount) * 100);
		actorSamePct = Math.round((actorData.sameCount / actorData.rerollCount) * 100);
		actorSuccessPct = Math.round((actorData.successCount / actorData.rerollCount) * 100);
		actorCritPct = Math.round((actorData.critSuccessCount / actorData.rerollCount) * 100);	
		successPct = Math.round(((actorData.successCount + actorData.critSuccessCount) / actorData.rerollCount) * 100);
		critPct = Math.round((actorData.critSuccessCount / actorData.rerollCount) * 100);
		
		// Save RollData
		await saveRollData();
		await compileActorStatsToJournal();
		
		// Output to chat if enabled in settings
		const outputToChat = game.settings.get(MODULE_NAME, "outputToChat");
		debugLog(`Setting: outputToChat: ${outputToChat} | Actor Name: ${actor.name}`);
		if (outputToChat) {
			// Prepare the chat message content
			const messageContent = `
				<h2>Reroll Stats for ${actor.name}</h2>
				<ul>
					<li><strong>Reroll Count:</strong> ${actorData.rerollCount}</li>
					<li><strong>Better Results:</strong> ${actorData.betterCount} (${actorBetterPct}%)</li>
					<li><strong>Worse Results:</strong> ${actorData.worseCount} (${actorWorsePct}%)</li>
					<li><strong>Same Results:</strong> ${actorData.sameCount} (${actorSamePct}%)</li>
					<li><strong>Reroll Sucess:</strong> ${actorData.successCount + actorData.critSuccessCount} (${successPct}%)</li>
					<li><strong>Reroll Crit:</strong> ${actorData.critSuccessCount} (${critPct}%)</li>
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

    debugLog("Detected saves in pf2e-toolbelt targetHelper");

    // Loop through each save in the targetHelper saves
    for (const [tokenId, saveData] of Object.entries(saves)) {
        debugLog(`Processing save for tokenId: ${tokenId}`);

        // Locate the token on the canvas
        const token = canvas.tokens.placeables.find(t => t.id === tokenId);
        if (!token) {
            debugLog(2, `No token found for tokenId: ${tokenId}`);
            continue;
        }

        const actor = token.actor;
        if (!actor) {
            debugLog(2, `No actor found for tokenId: ${tokenId}`);
            continue;
        }

        // Parse the roll from the 'roll' property (stored as JSON string)
        let rollData = {};
        try {
            rollData = JSON.parse(saveData.roll);
        } catch (error) {
            debugLog(3, `Failed to parse roll data for tokenId: ${tokenId}`);
            continue;
        }

        // Extract relevant data from the roll and save context
        const rollTotal = rollData.total || saveData.value;
        const rollDie = saveData.die;
        const successState = saveData.success; // success, failure, etc.
        const isReroll = rollData?.options?.isReroll ?? false;
        const outcome = saveData.success || "unknown";

        debugLog(`Token ID: ${tokenId} | Roll Total: ${rollTotal} | Die: ${rollDie} | Outcome: ${outcome} | Is Reroll: ${isReroll}`);

        // Process the roll for reroll tracking (similar to the logic in createChatMessage hook)
        const actorId = actor.id;

        // Check if actor is valid character
        if (!isValidActorForRerollTracking(actor)) {
            debugLog(2, `Ignoring roll from non-Player Character or minion actor: ${actor?.name || "Unknown"}`);
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
		let actorBetterPct = 0;
		let actorWorsePct = 0;
		let actorSamePct = 0;
		let actorSuccessPct = 0;
		let actorCritPct = 0;
		let successPct = 0;
		let critPct = 0;
		
        // Check if it is a reroll
        if (isReroll) {
            debugLog("ReRoll detected from targetHelper save!");

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
                // Calculate percentages
				actorBetterPct = Math.round((actorData.betterCount / actorData.rerollCount) * 100);
				actorWorsePct = Math.round((actorData.worseCount / actorData.rerollCount) * 100);
				actorSamePct = Math.round((actorData.sameCount / actorData.rerollCount) * 100);
				actorSuccessPct = Math.round((actorData.successCount / actorData.rerollCount) * 100);
				actorCritPct = Math.round((actorData.critSuccessCount / actorData.rerollCount) * 100);	
				successPct = Math.round(((actorData.successCount + actorData.critSuccessCount) / actorData.rerollCount) * 100);
				critPct = Math.round((actorData.critSuccessCount / actorData.rerollCount) * 100);
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
					<h2>Reroll Stats for ${actorName}</h2>
					<ul>
						<li><strong>Reroll Count:</strong> ${rerollCount}</li>
						<li><strong>Better Results:</strong> ${betterCount} (${actorBetterPct}%)</li>
						<li><strong>Worse Results:</strong> ${worseCount} (${actorWorsePct}%)</li>
						<li><strong>Same Results:</strong> ${sameCount} (${actorSamePct}%)</li>
						<li><strong>Reroll Sucess:</strong> ${successCount + critSuccessCount} (${successPct}%)</li>
						<li><strong>Reroll Crit:</strong> ${critSuccessCount} (${critPct}%)</li>
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

