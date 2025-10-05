import { LT } from "./localization.js";
// Log to Console
console.log("%cPF2e ReRoll Stats | reroll.js loaded", "color: orange; font-weight: bold;");

// Namespace for the module
const MODULE_NAME = "pf2e-reroll-stats";

// Label to append to the beginning of logs
const LOG_LABEL = "PF2e ReRoll Stats |";

// Function for debugging and logging
export function DL(intLogType, stringLogMsg, objObject = null) {
	// Handle the case where the first argument is a string
	if (typeof intLogType === "string") {
		objObject = stringLogMsg; // Shift arguments
		stringLogMsg = intLogType;
		intLogType = 1; // Default log type to 'all'
	}

	let debugLevel = "none";
    try {
        const key = `${MODULE_NAME}.debugLevel`;
        if (game?.settings?.settings?.has?.(key)) {
            debugLevel = game.settings.get(MODULE_NAME, "debugLevel");
        }
    } catch (e) {
        // ignore – fall back to "none"
    }

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
			const allowedFiles = ["localization.js", "reroll.js"];
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

// Global variable for tracking roll data by actor
let rollDataByActor = {};

Hooks.once("init", () => {
    // Register settings for persistent data
    game.settings.register(MODULE_NAME, "rollData", {
        name: LT.settings.rollDataName(),
        hint: LT.settings.rollDataHint(),
        scope: "world", // Saved at the world level
        config: false,  // Not exposed in the settings menu
        type: Object,
        default: {},
    });
    
	// Register settings to output to chat after a reroll
    game.settings.register(MODULE_NAME, "outputToChat", {
        name: LT.settings.outputToChatName(),
        hint: LT.settings.outputToChatHint(),
        scope: "world", 
        config: true,  
        type: Boolean,
        default: false,
		onChange: (value) => {
            DL(`PF2E Reroll Stats | Setting outputToChat: ${value}`);
        },
		requiresReload: true
	 });
	
	// Register settings to ignore minions
    game.settings.register(MODULE_NAME, "ignoreMinion", {
        name: LT.settings.ignoreMinionName(),
        hint: LT.settings.ignoreMinionHint(),
        scope: "world", 
        config: true,  
        type: Boolean,
        default: true,
	 });
	 
    // Register settings for persistent data
    game.settings.register(MODULE_NAME, "debugLevel", {
        name: LT.settings.debugLevelName(),
		hint: LT.settings.debugLevelHint(),
		scope: "world",
		config: true,
		type: String,
		choices: {
			"none": LT.settings.debugLevelNone(),
			"error": LT.settings.debugLevelErrors(),
			"warn": LT.settings.debugLevelWarnings(),
			"all": LT.settings.debugLevelAll()
		},
		default: "none", // Default to no logging
		requiresReload: true
	});
	const debugLevel = game.settings.get(MODULE_NAME, "debugLevel");
	console.log(`%cPF2e ReRoll Stats || Debugging: ${debugLevel}`, "color: orange; font-weight: bold;");

});

// helper: record the GM choice for a no-outcome reroll
async function _rrRecordNoOutcomeSelection({ actorId, choice }) {
	try {
		const actor = game.actors.get(actorId);
		if (!actor) {
			DL(2, `_rrRecordNoOutcomeSelection(): actor not found ${actorId}`);
			return;
		}

		// Ensure bucket exists
		if (!rollDataByActor[actorId]) {
			rollDataByActor[actorId] = {
				originalRoll: null,
				rerollCount: 0,
				betterCount: 0,
				worseCount: 0,
				sameCount: 0,
				successCount: 0,
				critSuccessCount: 0
			};
		}
		const data = rollDataByActor[actorId];

        // Setup Colors for chat output
        let betterColor = "";
        let successColor = "";
        let critColor = "";
        let worseColor = "";
        let sameColor = "";
        

		// Always +1 total rerolls
		data.rerollCount = (data.rerollCount || 0) + 1;

		switch (choice) {
			case "better-crit":
				data.betterCount = (data.betterCount || 0) + 1;
				data.critSuccessCount = (data.critSuccessCount || 0) + 1;
                betterColor = "color: green; font-weight: bold;";
                critColor = "color: green; font-weight: bold;";
				DL(`_rrRecordNoOutcomeSelection(): better-crit for ${actor.name}`);
				break;
			case "better-success":
				data.betterCount = (data.betterCount || 0) + 1;
				data.successCount = (data.successCount || 0) + 1;
                betterColor = "color: green; font-weight: bold;";
                successColor = "color: green; font-weight: bold;";
				DL(`_rrRecordNoOutcomeSelection(): better-success for ${actor.name}`);
				break;
			case "better-fail":
				data.betterCount = (data.betterCount || 0) + 1;
                betterColor = "color: green; font-weight: bold;";
				DL(`_rrRecordNoOutcomeSelection(): better-fail for ${actor.name}`);
				break;
			case "worse":
                worseColor = "color: red; font-weight: bold;";
				data.worseCount = (data.worseCount || 0) + 1;
				DL(`_rrRecordNoOutcomeSelection(): worse for ${actor.name}`);
				break;
			case "same":
                sameColor = "color: blue; font-weight: bold;";
				data.sameCount = (data.sameCount || 0) + 1;
				DL(`_rrRecordNoOutcomeSelection(): same for ${actor.name}`);
				break;
			default:
				DL(2, `_rrRecordNoOutcomeSelection(): unknown choice ${choice}`);
				return;
		}

		// Persist
		await saveRollData();

		// Optional: output to chat (mirrors your normal reroll path)
		const outputToChat = game.settings.get(MODULE_NAME, "outputToChat");
		if (outputToChat) {
			const r = Math.max(1, Number(data.rerollCount) || 1); // prevent divide by zero
			const betterPct = Math.round(((Number(data.betterCount) || 0) / r) * 100);
			const worsePct = Math.round(((Number(data.worseCount) || 0) / r) * 100);
			const samePct = Math.round(((Number(data.sameCount) || 0) / r) * 100);
			const successTotal = (Number(data.successCount) || 0) + (Number(data.critSuccessCount) || 0);
			const successPct = Math.round((successTotal / r) * 100);
			const critPct = Math.round(((Number(data.critSuccessCount) || 0) / r) * 100);

			const messageContent = `
                <h2>${LT.chat.actorHeader({ actorName: actor.name })}</h2>
                <ul>
                    <li><strong>${LT.chat.rerollCountLabel()}</strong> ${data.rerollCount}</li>
                    <li style="${betterColor}"><strong>${LT.chat.betterResultsLabel()}</strong> ${data.betterCount} (${betterPct}%)</li>
                    <li style="${worseColor}"><strong>${LT.chat.worseResultsLabel()}</strong> ${data.worseCount} (${worsePct}%)</li>
                    <li style="${sameColor}"><strong>${LT.chat.sameResultsLabel()}</strong> ${data.sameCount} (${samePct}%)</li>
                    <li style="${successColor}"><strong>${LT.chat.successPercentageLabel()}</strong> ${successTotal} (${successPct}%)</li>
                    <li style="${critColor}"><strong>${LT.chat.criticalSuccessPercentageLabel()}</strong> ${data.critSuccessCount} (${critPct}%)</li>
                </ul>
            `;

			await ChatMessage.create({
                user: game.user.id,
                content: messageContent,
                speaker: { alias: LT.chat.speakerSingle() }
            });
		}

        // reset colors
        betterColor = "";
        successColor = "";
        critColor = "";
        worseColor = "";
        sameColor = "";

		// Rebuild journal summary (keep consistent with your existing flow)
		await compileActorStatsToJournal();
	} catch (err) {
		DL(3, `_rrRecordNoOutcomeSelection(): error ${err?.message || err}`, err);
	}
}

// Helper to show a confirmation dialog and return a promise that resolves to true/false
async function showConfirmationDialog(message) {
  return new Promise((resolve) => {
    new Dialog({
      title: LT.dialog.titleConfirm(),
      content: `<p>${message}</p><p>${LT.dialog.areYouSure()}</p>`,
      buttons: {
        yes: {
          label: LT.dialog.yes(),
          callback: () => resolve(true),
        },
        no: {
          label: LT.dialog.no(),
          callback: () => resolve(false),
        },
      },
      default: "no",
    }).render(true);
  });
}

// Checks if an actor is valid for reroll tracking, Returns true if valid, false otherwise
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
		DL(`Actor Traits: `, traits);

		const hasMinionTrait = traits.includes("minion");
		DL(`Has Minion Trait: ${hasMinionTrait}`);
		
		// Return true if it's a character and not a minion
		return isCharacter && !hasMinionTrait;
	}
}

// Save rollDataByActor to settings
async function saveRollData() {
    // Only save data if the user is the GM
    if (game.user.isGM) {
        await game.settings.set(MODULE_NAME, "rollData", rollDataByActor);
        DL("Reroll data saved.");
		
    } else {
        DL("Player cannot save reroll data.");
    }
}

// Function to display actor stats in chat
function displayActorStatsInChat() {
    
	// Get the selected token's actor
    const token = canvas.tokens.controlled[0];
    if (!token) {
        ui.notifications.error(LT.notifications.noTokenSelected());
        return;
    }
    const actor = token.actor;
    if (!actor) { // make sure an actor exists for token
        ui.notifications.error(LT.notifications.selectedTokenHasNoActor());
        return;
    }

    const actorId = actor.id;
    const actorName = actor.name;
    const actorData = rollDataByActor[actorId];

    if (!actorData) {
        ui.notifications.info(LT.notifications.noRerollDataForActor({ actorName }));
        return;
    }

    // Calculate percentages
    const { rerollCount, betterCount, worseCount, sameCount, successCount, critSuccessCount } = actorData;
	
	// Calculate percentages
    const actorBetterPct = actorData.rerollCount > 0 ? Math.round((actorData.betterCount / actorData.rerollCount) * 100) : 0;
	const actorWorsePct = Math.round((actorData.worseCount / actorData.rerollCount) * 100);
	const actorSamePct = Math.round((actorData.sameCount / actorData.rerollCount) * 100);
	const actorSuccessPct = Math.round((actorData.successCount / actorData.rerollCount) * 100);
	const actorCritPct = Math.round((actorData.critSuccessCount / actorData.rerollCount) * 100);	
	const successPct = Math.round(((actorData.successCount + actorData.critSuccessCount) / actorData.rerollCount) * 100);
	const critPct = Math.round((actorData.critSuccessCount / actorData.rerollCount) * 100);
	
	// Prepare the chat message content
    const messageContent = `
        <h2>${LT.chat.actorHeader({ actorName: actor.name })}</h2>
        <ul>
            <li><strong>${LT.chat.rerollCountLabel()}</strong> ${rerollCount}</li>
            <li><strong>${LT.chat.betterResultsLabel()}</strong> ${betterCount} (${actorBetterPct}%)</li>
            <li><strong>${LT.chat.worseResultsLabel()}</strong> ${worseCount} (${actorWorsePct}%)</li>
            <li><strong>${LT.chat.sameResultsLabel()}</strong> ${sameCount} (${actorSamePct}%)</li>
			<li><strong>${LT.chat.successPercentageLabel()}</strong> ${successCount + critSuccessCount} (${successPct}%)</li>
			<li><strong>${LT.chat.criticalSuccessPercentageLabel()}</strong> ${critSuccessCount} (${critPct}%)</li>
        </ul>
    `;

    // Send the message to chat
    ChatMessage.create({
        user: game.user.id,
        content: messageContent,
        speaker: { 
			alias: LT.chat.speakerSingle()
		},		
    });
}

// Function to compile actor stats into a journal entry with totals and pages
async function compileActorStatsToJournal() {
    let journalContent = `<h1>${LT.journalTitle()}</h1>`;

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
	let actorSuccessPct = 0;
	let actorCritPct = 0;

    // Compile individual actor stats
    for (const [actorId, stats] of Object.entries(rollDataByActor)) {
        const actor = game.actors.get(actorId);
        if (!actor) continue;

		// Calculate percentages
        actorBetterPct = stats.rerollCount > 0 ? Math.round((stats.betterCount / stats.rerollCount) * 100) : "N/A";
        actorWorsePct = stats.rerollCount > 0 ? Math.round((stats.worseCount / stats.rerollCount) * 100) : "N/A";
        actorSamePct = stats.rerollCount > 0 ? Math.round((stats.sameCount / stats.rerollCount) * 100) : "N/A";
        actorSuccessPct = stats.rerollCount > 0 ? Math.round(((stats.successCount + stats.critSuccessCount) / stats.rerollCount) * 100) : "N/A";
        actorCritPct = stats.rerollCount > 0 ? Math.round((stats.critSuccessCount / stats.rerollCount) * 100) : "N/A";

        journalContent += `
            <h2>${actor.name}</h2>
            <ul>
                <li><strong>${LT.chat.totalRerollCountLabel()}</strong> ${stats.rerollCount || 0}</li>
				<li><strong>${LT.chat.totalBetterResultsLabel()}</strong> ${stats.betterCount || 0} (${actorBetterPct}%)</li>
                <li><strong>${LT.chat.totalWorseResultsLabel()}</strong> ${stats.worseCount || 0} (${actorWorsePct}%)</li>
                <li><strong>${LT.chat.totalSameResultsLabel()}</strong> ${stats.sameCount || 0} (${actorSamePct}%)</li>
                <li><strong>${LT.chat.totalSuccessResultsLabel()}</strong> ${stats.successCount + stats.critSuccessCount || 0} (${actorSuccessPct}%)</li>
                <li><strong>${LT.chat.totalCriticalResultsLabel()}</strong> ${stats.critSuccessCount || 0} (${actorCritPct}%)</li>
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
    const totalCritPct = totalRerollCount > 0 ? Math.round((totalCritSuccessCount / totalRerollCount) * 100) : "N/A";

    // Append totals section
    journalContent += `
        <h2>${LT.chat.totalsHeader()}</h2>
        <ul>
            <li><strong>${LT.chat.totalRerollCountLabel()}</strong> ${totalRerollCount}</li>
            <li><strong>${LT.chat.totalBetterResultsLabel()}</strong> ${totalBetterCount} (${totalBetterPct}%)</li>
            <li><strong>${LT.chat.totalWorseResultsLabel()}</strong> ${totalWorseCount} (${totalWorsePct}%)</li>
            <li><strong>${LT.chat.totalSameResultsLabel()}</strong> ${totalSameCount} (${totalSamePct}%)</li>
            <li><strong>${LT.chat.totalSuccessResultsLabel()}</strong> ${totalSuccessCount} (${totalSuccessPct}%)</li>
            <li><strong>${LT.chat.totalCriticalResultsLabel()}</strong> ${totalCritSuccessCount} (${totalCritPct}%)</li>
        </ul>
    `;

    // Define the journal entry name
    const journalName = LT.journalTitle();
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

    DL("Hero Point Reroll Stats have been compiled into a journal entry.");
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
        totalRerollCount += stats.rerollCount || 0;
        totalBetterCount += stats.betterCount || 0;
        totalWorseCount += stats.worseCount || 0;
        totalSameCount += stats.sameCount || 0;
        totalSuccessCount += stats.successCount || 0;
        totalCritSuccessCount += stats.critSuccessCount || 0;
    }

    // Calculate success percentages
	const totalBetterPct = totalRerollCount > 0 ? Math.round((totalBetterCount / totalRerollCount) * 100) : "N/A";
	const totalWorsePct = totalRerollCount > 0 ? Math.round((totalWorseCount / totalRerollCount) * 100) : "N/A";
	const totalSamePct = totalRerollCount > 0 ? Math.round((totalSameCount / totalRerollCount) * 100) : "N/A";
	const totalSuccessPct = totalRerollCount > 0 ? Math.round(((totalSuccessCount + totalCritSuccessCount) / totalRerollCount) * 100) : "N/A";
	const totalCritPct = totalRerollCount > 0 ? Math.round((totalCritSuccessCount / totalRerollCount) * 100) : "N/A";	


    // Prepare message content
    const messageContent = `
        <h2>${LT.chat.totalsHeader()}</h2>
        <ul>
            <li><strong>${LT.chat.totalRerollCountLabel()}</strong> ${totalRerollCount}</li>
            <li><strong>${LT.chat.betterResultsLabel()}</strong> ${totalBetterCount} (${totalBetterPct}%)</li>
            <li><strong>${LT.chat.worseResultsLabel()}</strong> ${totalWorseCount} (${totalWorsePct}%)</li>
            <li><strong>${LT.chat.sameResultsLabel()}</strong> ${totalSameCount} (${totalSamePct}%)</li>
            <li><strong>${LT.chat.totalSuccessResultsLabel()}</strong> ${totalSuccessCount + totalCritSuccessCount} (${totalSuccessPct}%)</li>
            <li><strong>${LT.chat.totalCriticalResultsLabel()}</strong> ${totalCritSuccessCount} (${totalCritPct}%)</li>
        </ul>
    `;

    // Send the message to chat
    ChatMessage.create({
        user: game.user.id,
        content: messageContent,
        speaker: { alias: LT.chat.speakerCombined() },
    });
    DL("Combined reroll stats calculated and displayed.");
}

// Function to delete all roll data for a selected token's actor
async function deleteActorRollData() {
    // Get the selected tokens
    const tokens = canvas.tokens.controlled;

    // Check if any tokens are selected
    if (tokens.length === 0) {
        ui.notifications.warn(LT.notifications.noTokensSelected());
        return;
    }

    // Confirm deletion
	const confirmation = await showConfirmationDialog(LT.deleteSelected());
	if (confirmation){
		let deletedCount = 0;

		// Loop through each selected token
		tokens.forEach(token => {
			const actor = token.actor;
			if (!actor) {
				ui.notifications.warn(LT.notifications.tokenHasNoActor());
				return;
			}

			const actorId = actor.id;

			// Check if roll data exists for this actor
			if (rollDataByActor[actorId]) {
				// Delete the roll data for the actor
				delete rollDataByActor[actorId];
				DL(`Deleted roll data for ${actor.name}`);
				deletedCount++;
			} else {
				ui.notifications.warn(LT.notifications.noRollDataForActor({ actorName: actor.name }));
			}
		});

		// Save the updated roll data persistently
		await saveRollData(); // Save Roll Data
		await compileActorStatsToJournal(); // Update Journal

		// Provide feedback to the GM
		if (deletedCount > 0) {
			ui.notifications.info(LT.notifications.deletedActorCount({ count: deletedCount }));
		} else {
			ui.notifications.info(LT.notifications.noRollDataToDeleteSelected());
		}
	}
}

// Function to delete all reroll data - optional to delete journal also
async function deleteAllRerollStats(deleteJournal = false) {
	
	const confirmation = await showConfirmationDialog(LT.deleteAll());
	if (confirmation) {
		// Clear the roll data
		rollDataByActor = {};
		DL(2, "All Hero Point reroll stats have been cleared.");

		// Optionally delete the journal entry
		if (deleteJournal) {
			const journalName = LT.journalTitle();
			const journalEntry = game.journal.getName(journalName);
			if (journalEntry) {
				await journalEntry.delete();
				DL(2, `Journal entry "${journalName}" has been deleted.`);
			} else {
				DL(2, `Journal entry "${journalName}" not found.`);
			}
		}
		await saveRollData();
		// Notify the user
		DL("All Hero Point reroll stats have been deleted.");
	}
}

// Function to open screen to edit actor reroll data
async function openRerollEditor() {
    
	// Retrieve stored reroll data
    if (!rollDataByActor || Object.keys(rollDataByActor).length === 0) {
        ui.notifications.info(LT.notifications.noActorsWithRerollData());
        return;
    }

    // Create an HTML form with enhanced styling
    const content = `
    <form style="width: 100%; height: 100%; max-height: 600px; overflow-y: auto; padding: 5px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
        <div style="width: 300px; margin-bottom: 20px;">
            <select id="actor-select" style="width: 100%; padding: 8px; font-size: 1em; border: 1px solid #ccc; border-radius: 4px;">
			<option>${LT.selectActor()}</option>
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
            <button type="button" id="save-reroll-data" style="width: 100%; padding: 5px; font-size: 1.2em; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">${LT.save()}</button>
        </div>
    </form>
    `;

    // Create a dialog window
    const dialog = new Dialog({
        title: LT.dialog.editTitle(),
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
                    actorData[field] = Math.max(0, (actorData[field] || 0) + change);
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
                        ui.notifications.error(LT.notifications.countsDoNotAddUp());
                        return;
                    }

                    // Ensure no counts are negative
                    const fieldsToCheck = [
                        "rerollCount",
                        "betterCount",
                        "worseCount",
                        "sameCount",
                        "successCount",
                        "critSuccessCount"
                    ];
                    for (const field of fieldsToCheck) {
                        if ((actorData[field] || 0) < 0) {
                            ui.notifications.error(LT.notifications.negativeCountsNotAllowed());
                            return;
                        }
                    }
                    
                    // Check if successCount or critSuccessCount is greater than betterRolls
                    if (
                        (actorData.successCount || 0) > (actorData.betterCount || 0) || 
                        (actorData.critSuccessCount || 0) > (actorData.betterCount || 0)
                    ) {
                        ui.notifications.error(LT.notifications.successCountsExceedBetter());
                        return;
                    }
					
					// prompt for confirmation
                    const confirmed = await Dialog.confirm({
                        title: LT.dialog.saveChanges(),
                        content: LT.dialog.areYouSure(),
                    });

					// If yes
                    if (confirmed) {
                        // await game.settings.set(MODULE_NAME, "rollData", rollDataByActor);
						await saveRollData();
						await compileActorStatsToJournal();
                        ui.notifications.info(LT.notifications.saved());
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

// Hook into chat message creation to track d20 rolls
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

    DL(`D20 roll detected!`);

    // Access the flags or context for the PF2e system
    const context = message.getFlag("pf2e", "context") || {};
    const actorId = context.actor || "Unknown Actor";
	
    // Retrieve the actor object
    const actor = game.actors.get(actorId);
    if (!actor) {
        DL(2, `No actor found for actorId: ${actorId}`);
        return;
    }

    // Check if actor is valid character
    if (!isValidActorForRerollTracking(actor)) {
        DL(2, `Ignoring roll from non-Player Character or minion actor: ${actor.name || "Unknown"}`);
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
        DL("ReRoll detected!");

        // If outcome is missing (no DC prompt), we whisper a GM-only chooser and stop further auto-accounting
        const hasOutcome = !!context?.outcome;
        if (!hasOutcome) {
            DL("createChatMessage(): Reroll without outcome detected — prompting GM.");

            // Build the button bar (data attributes drive our click handler)
            const actorId = actor.id;
            const promptHtml = `
                <div>
                    <p>${LT.chat.noOutcomePrompt()}</p>
                    <div style="display:flex;flex-wrap:wrap;gap:.5rem;">
                        <button type="button" class="reroll-no-outcome-btn" data-choice="better-crit" data-actor-id="${actorId}">${LT.chat.betterCritBtn()}</button>
                        <button type="button" class="reroll-no-outcome-btn" data-choice="better-success" data-actor-id="${actorId}">${LT.chat.betterSuccessBtn()}</button>
                        <button type="button" class="reroll-no-outcome-btn" data-choice="better-fail" data-actor-id="${actorId}">${LT.chat.betterFailBtn()}</button>
                        <button type="button" class="reroll-no-outcome-btn" data-choice="worse" data-actor-id="${actorId}">${LT.chat.worseBtn()}</button>
                        <button type="button" class="reroll-no-outcome-btn" data-choice="same" data-actor-id="${actorId}">${LT.chat.sameBtn()}</button>
                    </div>
                </div>
            `;

            // Whisper to all GMs
            const gmRecipients = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
            await ChatMessage.create({
                user: game.user.id,
                content: promptHtml,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                whisper: gmRecipients,
                speaker: { alias: LT.chat.speakerSingle() },
                flags: {
                    [MODULE_NAME]: {
                        type: "noOutcomePrompt",
                        actorId
                    }
                }
            });

            // Stop normal reroll handling here — we’ll update stats on button click
            return;
        }
		
		// Detect Workbench’s Variant Hero Point Rules mode
		const isWorkbenchActive = game.modules.get("xdy-pf2e-workbench")?.active;
		if (isWorkbenchActive && game.settings.settings.has("xdy-pf2e-workbench.heroPointRules")) {
			const hpRule = game.settings.get("xdy-pf2e-workbench", "heroPointRules");
			DL(`Workbench hp rule: ${hpRule}`);
			
			if (hpRule !== "no") {
				const messageContent = `
					<h2>${LT.workbench.title()}</h2>
					<p>${LT.workbench.warning()}</p>
					<p>${LT.workbench.fixIntro()}</p>
					<ol>
						<li>Change the setting manually under <b>PF2e Workbench</b> > <b>Manage House Rule Settings</b> and set "Variant Hero Point house rules" to <b>Normal</b>.</li>
						<li>${LT.workbench.step2()}</li>
					</ol>
				`;

				ChatMessage.create({
					user: game.user.id,
					content: messageContent,
					speaker: { alias: LT.chat.speakerSingle() },
				});
				return;
			}
		}
		
        // Get the outcome of the reroll from the context (success / critical success)
        const outcome = context?.outcome || "Unknown";

        // Compare the reroll with the original roll to determine if it's better or worse
        const rerollResult = message.rolls[0]?.total;
        const originalRoll = actorData.originalRoll;

        // Setup Colors for chat output
        let betterColor = "";
        let successColor = "";
        let critColor = "";
        let worseColor = "";
        let sameColor = "";

        if (originalRoll !== null) {
            if (rerollResult > originalRoll) { // Reroll is better
                betterColor = "color: green; font-weight: bold;";
                actorData.betterCount += 1;
                DL(`Reroll is better than the original.`);
            } else if (rerollResult < originalRoll) { // Reroll is worse
                worseColor = "color: red; font-weight: bold;";
                actorData.worseCount += 1;
                DL(`Reroll is worse than the original.`);
            } else { // Reroll is the same
                sameColor = "color: blue; font-weight: bold;";
                actorData.sameCount += 1;
                DL(`Reroll is the same as the original.`);
            }

            // Increase reroll total
            actorData.rerollCount += 1; 

            // Calculate and log success percentage based on outcome
            if (outcome === "success") { // Success
                successColor = "color: green; font-weight: bold;";
                actorData.successCount += 1;
                DL(`Reroll was a success.`);
            } else if (outcome === "criticalSuccess") { // Critical Success
                critColor = "color: green; font-weight: bold;";
                actorData.critSuccessCount += 1;
                DL(`Reroll was a critical success.`);
            } 

        } else {
            DL(2,`No original roll found for actor ${actorId}.`);
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
		DL(`Setting: outputToChat: ${outputToChat} | Actor Name: ${actor.name}`);
		if (outputToChat) {
			// Prepare the chat message content
			const messageContent = `
				<h2>${LT.chat.actorHeader({ actorName: actor.name })}</h2>
				<ul>
					<li><strong>${LT.chat.rerollCountLabel()}</strong> ${actorData.rerollCount}</li>
					<li style="${betterColor}"><strong>${LT.chat.betterResultsLabel()}</strong> ${actorData.betterCount} (${actorBetterPct}%)</li>
					<li style="${worseColor}"><strong>${LT.chat.worseResultsLabel()}</strong> ${actorData.worseCount} (${actorWorsePct}%)</li>
					<li style="${sameColor}"><strong>${LT.chat.sameResultsLabel()}</strong> ${actorData.sameCount} (${actorSamePct}%)</li>
					<li style="${successColor}"><strong>${LT.chat.successPercentageLabel()}</strong> ${actorData.successCount + actorData.critSuccessCount} (${successPct}%)</li>
					<li style="${critColor}"><strong>${LT.chat.criticalSuccessPercentageLabel()}</strong> ${actorData.critSuccessCount} (${critPct}%)</li>
				</ul>
			`;
			
			// Send the message to chat
			ChatMessage.create({
				user: game.user.id,
				content: messageContent,
				speaker: { alias: LT.chat.speakerSingle() },		
			});
		}

        // Setup Colors for chat output
        betterColor = "";
        successColor = "";
        critColor = "";
        worseColor = "";
        sameColor = "";

    } else {
        DL("Original D20 roll detected (not a reroll).");
		
        // Save the original roll for this actor
        actorData.originalRoll = message.rolls[0]?.total; // Save total roll value
        DL(`Original roll saved for actor ${actorId}: ${actorData.originalRoll}`);
    }

    // Save data persistently and compile stats
    await compileActorStatsToJournal();

    
});

// Hook into chat message updates to catch pf2e-toolbelt targetHelper saves
Hooks.on("updateChatMessage", async (message, updateData, options, userId) => {
    
    // Check if "pf2e-toolbelt" is active - otherwise exit hook
    const isToolbeltEnabled = game.modules.get('pf2e-toolbelt')?.active;
    if (!isToolbeltEnabled) {
        DL('pf2e-toolbelt is not enabled. Exiting hook.');
        return; // Exit early if the module is not enabled
    }
	
    // Only process for GM
    if (!game.user.isGM) return;

    // Check if the message contains targetHelper saves information
    const saves = message.flags?.["pf2e-toolbelt"]?.targetHelper?.saves;
    if (!saves) return;

    DL("Detected saves in pf2e-toolbelt targetHelper");

    // Loop through each save in the targetHelper saves
    for (const [tokenId, saveData] of Object.entries(saves)) {
        DL(`Processing save for tokenId: ${tokenId}`);

        // Locate the token on the canvas
        const token = canvas.tokens.placeables.find(t => t.id === tokenId);
        if (!token) {
            DL(2, `No token found for tokenId: ${tokenId}`);
            continue;
        }

        const actor = token.actor;
        if (!actor) {
            DL(2, `No actor found for tokenId: ${tokenId}`);
            continue;
        }

        // Parse the roll from the 'roll' property (stored as JSON string)
        let rollData = {};
        try {
            rollData = JSON.parse(saveData.roll);
        } catch (error) {
            DL(3, `Failed to parse roll data for tokenId: ${tokenId}`);
            continue;
        }

        // Extract relevant data from the roll and save context
        const rollTotal = rollData.total || saveData.value;
        const rollDie = saveData.die;
        const successState = saveData.success; // success, failure, etc.
        const isReroll = rollData?.options?.isReroll ?? false;
        const outcome = saveData.success || "unknown";

        DL(`Token ID: ${tokenId} | Roll Total: ${rollTotal} | Die: ${rollDie} | Outcome: ${outcome} | Is Reroll: ${isReroll}`);

        // Process the roll for reroll tracking (similar to the logic in createChatMessage hook)
        const actorId = actor.id;

        // Check if actor is valid character
        if (!isValidActorForRerollTracking(actor)) {
            DL(2, `Ignoring roll from non-Player Character or minion actor: ${actor?.name || "Unknown"}`);
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
            DL("ReRoll detected from targetHelper save!");
			
			// Detect Workbench’s Variant Hero Point Rules mode
			const isWorkbenchActive = game.modules.get("xdy-pf2e-workbench")?.active;
			if (isWorkbenchActive && game.settings.settings.has("xdy-pf2e-workbench.heroPointRules")) {
				const hpRule = game.settings.get("xdy-pf2e-workbench", "heroPointRules");
				DL(`Workbench hp rule: ${hpRule}`);
				
				if (hpRule !== "no") {
					const messageContent = `
						<h2>${LT.workbench.title()}</h2>
						<p>${LT.workbench.warning()}</p>
						<p>${LT.workbench.fixIntro()}</p>
						<ol>
							<li>Change the setting manually under <b>PF2e Workbench</b> > <b>Manage House Rule Settings</b> and set "Variant Hero Point house rules" to <b>Normal</b>.</li>
							<li>${LT.workbench.step2()}</li>
						</ol>
					`;

					ChatMessage.create({
						user: game.user.id,
						content: messageContent,
						speaker: { alias: LT.chat.speakerSingle() },
					});
					return;
				}
			}			
			
            // Compare the reroll with the original roll to determine if it's better or worse
            const rerollResult = rollTotal;
            const originalRoll = actorData.originalRoll;

            // Check if there was an original roll
            if (originalRoll !== null) {
                if (rerollResult > originalRoll) {
                    actorData.betterCount += 1;
                    DL(`Reroll is better than the original.`);
                } else if (rerollResult < originalRoll) {
                    actorData.worseCount += 1;
                    DL(`Reroll is worse than the original.`);
                } else {
                    actorData.sameCount += 1;
                    DL(`Reroll is the same as the original.`);
                }
                // Increase reroll total
                actorData.rerollCount += 1;
                // Calculate and log success percentage based on outcome
                if (outcome === "success") {
                    actorData.successCount += 1;
                    DL(`Reroll was a success.`);
                } else if (outcome === "criticalSuccess") {
                    actorData.critSuccessCount += 1;
                    DL(`Reroll was a critical success.`);
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
                DL(`No original roll found for actor ${actorId}.`);
            }
			// Save RollData
			await saveRollData();
			
			// Output to chat if enabled in settings
			const outputToChat = game.settings.get(MODULE_NAME, "outputToChat");
			DL(`outputToChat: ${outputToChat} | Actor Name: ${actor.name}`);
			if (outputToChat) {
				const messageContent = `
					<h2>${LT.chat.actorHeader({ actorName: actor.name })}</h2>
					<ul>
						<li><strong>${LT.chat.rerollCountLabel()}</strong> ${rerollCount}</li>
						<li><strong>${LT.chat.betterResultsLabel()}</strong> ${betterCount} (${actorBetterPct}%)</li>
						<li><strong>${LT.chat.worseResultsLabel()}</strong> ${worseCount} (${actorWorsePct}%)</li>
						<li><strong>${LT.chat.sameResultsLabel()}</strong> ${sameCount} (${actorSamePct}%)</li>
						<li><strong>${LT.chat.successPercentageLabel()}</strong> ${successCount + critSuccessCount} (${successPct}%)</li>
						<li><strong>${LT.chat.criticalSuccessPercentageLabel()}</strong> ${critSuccessCount} (${critPct}%)</li>
					</ul>
				`;

				// Send the message to chat
				await ChatMessage.create({
					user: game.user.id,
					content: messageContent,
					speaker: { alias: LT.chat.speakerSingle() },		
				});
			}
        } else {
            DL("Original D20 roll detected (not a reroll).");
            // Save the original roll for this actor
            actorData.originalRoll = rollTotal; // Save total roll value
            DL(`Original roll saved for actor ${actorId}: ${actorData.originalRoll}`);
        }

        // Save data persistently
        await compileActorStatsToJournal();
    }
});

// Handle clicks on the no-outcome buttons in our special GM prompt
Hooks.on("renderChatMessage", async (message, $html) => {
	try {
		// Only the GM should wire buttons, and only for our special prompt
		if (!game.user?.isGM) return;
		const flag = message?.flags?.[MODULE_NAME];
		if (!flag || flag?.type !== "noOutcomePrompt") return;

		$html.on("click", ".reroll-no-outcome-btn", async (ev) => {
			ev.preventDefault();
			ev.stopPropagation();

			const btn = ev.currentTarget;
			const choice = btn?.dataset?.choice;
			const actorId = btn?.dataset?.actorId;
			if (!choice || !actorId) { DL(2, "renderChatMessage(): missing choice/actorId"); return; }

			try {
    console.log(`%c${LOG_LABEL} Reroll Tracker ready!`, "color: orange; font-weight: bold;");
				// Disable all buttons after first click to enforce "ONE button"
				$html.find(".reroll-no-outcome-btn").prop("disabled", true);
			} catch (err) {
				DL(3, `_rrRecordNoOutcomeSelection(): error ${err?.message || err}`, err);
			}
		});
	} catch (err) {
		DL(3, `renderChatMessage(): error ${err?.message || err}`, err);
	}
});

// On ready, load existing roll data from settings
Hooks.once("ready", async () => {
    // Initialize rollDataByActor from game settings or as an empty object
    rollDataByActor = game.settings.get(MODULE_NAME, "rollData") || {};
    console.log(`%c${LOG_LABEL} Reroll Tracker ready!`, "color: Orange; font-weight: bold;");

     try {
		const api = {
			displayActorStatsInChat,
			compileActorStatsToJournal,
			displayCombinedRerollStats,
			deleteActorRollData,
			deleteAllRerollStats,
			openRerollEditor
		};

		// Expose the API via the module
		const mod = game.modules.get("pf2e-reroll-stats");
		if (mod) mod.api = api;

		// Also attach to globalThis for easy access
		globalThis.pf2eRerollStats = api;

	} catch (e) {
		console.error(`PF2e ReRoll Stats || Failed to expose API: ${e?.message || e}`);
	}
});