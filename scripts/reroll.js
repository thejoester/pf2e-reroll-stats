import { LT } from "./localization.js";

const MODULE_NAME = "pf2e-reroll-stats";        // Namespace for the module
const LOG_LABEL = "PF2e ReRoll Stats";        // Label to append to the beginning of logs
const SESSION_KEY_WB_WARN = `${MODULE_NAME}.wbWarnShown`;

//log to console
console.log("%cPF2e ReRoll Stats | reroll.js loaded", "color: orange; font-weight: bold;");

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

async function migration_critFailData() {
	try {

		// Reusable migration object
		let migrationData = game.settings.get(MODULE_NAME, "migrationData") || {};
		const hasCritFailMigration = Number(migrationData?.critFailMigration) === 1;
		if (hasCritFailMigration) return; // Already done

		// Localized strings
		const title = LT.migration.title();
		const question = LT.migration.question();
		const archiveBtn = LT.migration.archiveReset();
		const keepBtn = LT.migration.keep();
		const cancelBtn = LT.migration.cancel();

		const content = `
			<h2>${title}</h2>
			<p>${question}</p>
			<p style="margin-top:0.5rem;"><em>${LT.migration.note()}</em></p>
		`;
		
		const DialogV2 = foundry?.applications?.api?.DialogV2;

		const dlg = new DialogV2({
            id: "pf2e-reroll-migration",
            title: LT.migration.title(),
            content: `
                <h2>${LT.migration.title()}</h2>
                <p>${LT.migration.question()}</p>
                <p style="margin-top:0.5rem;"><em>${LT.migration.note()}</em></p>
            `,
            buttons: [
                {
                    action: "archive",
                    label: LT.migration.archiveReset(),
                    icon: "fa-solid fa-box-archive",
                    default: true,
                    callback: async () => {
                        try {
                            DL("migration(): user chose Archive & Reset");
                            await compileActorStatsToJournal(LT.migration.archiveHeader());

                            DL("migration(): archive page written");

                            // Reset all roll data
                            for (const actorId of Object.keys(rollDataByActor ?? {})) {
                                rollDataByActor[actorId] = {
                                    originalRoll: null,
                                    rerollCount: 0,
                                    betterCount: 0,
                                    worseCount: 0,
                                    sameCount: 0,
                                    successCount: 0,
                                    critSuccessCount: 0,
                                    critFailCount: 0
                                };
                            }
                            await saveRollData(); // Persist the reset
                            await compileActorStatsToJournal(); // Rebuild journal with reset stats

                            migrationData.critFailMigration = 1;
                            await game.settings.set(MODULE_NAME, "migrationData", migrationData);

                            ui.notifications?.info(LT.migration.archivedAndReset());
                            DL("migration(): migration flag updated");
                        } catch (err) {
                            DL(3, "migration(): error archiving/resetting stats", err);
                            ui.notifications?.error(LT.migration.errorArchive());
                        }
                    }
                },
                {
                    action: "keep",
                    label: LT.migration.keep(),
                    icon: "fa-solid fa-square-check",
                    callback: async () => {
                        DL("migration(): user chose Keep");
                        migrationData.critFailMigration = 1;
                        await game.settings.set(MODULE_NAME, "migrationData", migrationData);
                        ui.notifications?.warn(LT.migration.keptWarning());
                    }
                },
                {
                    action: "cancel",
                    label: LT.migration.cancel(),
                    icon: "fa-regular fa-clock",
                    callback: () => {
                        DL(2, "migration(): user chose Decide Later");
                    }
                }
            ],
            position: { width: 560 }
        });
        dlg.render(true);
	} catch (e) {
		DL(3, `migration_critFailData(): error - ${e?.message || e}`);
	}
}

// Handle reroll events
async function handleRerollEvent(actor, originalTotal, rerollTotal, outcome) {
    if (!game.user.isGM) return; // Only the GM tracks rerolls
	
	if (!actor) { // make sure an actor exists for token
        DL(3, "handleRerollEvent(): no actor provided");
        return;
    }

	if (!isValidActorForRerollTracking(actor)) { // Check if actor is valid for tracking
		DL(2, `handleRerollEvent(): ignoring non-PC/minion actor ${actor.name}`);
		return;
	}

    // Detect Workbench’s Variant Hero Point Rules mode
    const isWorkbenchActive = game.modules.get("xdy-pf2e-workbench")?.active;
    if (isWorkbenchActive && game.settings.settings.has("xdy-pf2e-workbench.heroPointRules")) {
        const hpRule = game.settings.get("xdy-pf2e-workbench", "heroPointRules");
        DL(`Workbench hp rule: ${hpRule}`);
        
        // If workbench is enabled and ignore settings disabled (default)
        if (hpRule !== "no" && !game.settings.get(MODULE_NAME, "ignoreWorkbenchVariant")) {
            
            // Check if warning message has been shown, and skip if it has this session
            let shown = null; 
            try { shown = sessionStorage.getItem(SESSION_KEY_WB_WARN); } catch (e) { /* ignore */ }
            if (!shown) {
                const messageContent = `
                    <h2>${LT.workbench.title()}</h2>
                    <p>${LT.workbench.warning()}</p>
                    <p>${LT.workbench.fixIntro()}</p>
                    <ol>
                        <li>${LT.workbench.step1()}</li>
                        <li>${LT.workbench.step2()}</li>
                        <li>${LT.workbench.step3()}</li>
                    </ol>
                `;
                await ChatMessage.create({
                    user: game.user.id,
                    content: messageContent,
                    speaker: { alias: LT.chat.speakerSingle() },
                });

                try { sessionStorage.setItem(SESSION_KEY_WB_WARN, "1"); } catch (e) { /* ignore */ }
                DL("handleRerollEvent(): Workbench variant warning shown (session-scoped)");
            }
            return;
        }
    }

	// Load existing data if not already loaded
	const actorId = actor.id;
	if (!rollDataByActor[actorId]) {
		rollDataByActor[actorId] = {
			originalRoll: null,
			rerollCount: 0,
			betterCount: 0,
			worseCount: 0,
			sameCount: 0,
			successCount: 0,
			critSuccessCount: 0,
			critFailCount: 0
		};
	}
	const actorData = rollDataByActor[actorId];

    // Setup Colors for chat output
        let betterColor = "";
        let successColor = "";
        let critColor = "";
        let worseColor = "";
        let sameColor = "";
        let critFailColor = "";

    // calculate outcome
	if (originalTotal !== null) {

            // Increase reroll total
            actorData.rerollCount += 1; 

            if (rerollTotal > originalTotal) { // Reroll is better
                betterColor = "color: green; font-weight: bold;";
                actorData.betterCount += 1;
                DL(`Reroll is better than the original.`);
            } else if (rerollTotal < originalTotal) { // Reroll is worse
                worseColor = "color: red; font-weight: bold;";
                actorData.worseCount += 1;
                DL(`Reroll is worse than the original.`);
            } else { // Reroll is the same
                sameColor = "color: blue; font-weight: bold;";
                actorData.sameCount += 1;
                DL(`Reroll is the same as the original.`);
            }

            // Calculate and log success percentage based on outcome
            if (outcome === "success") { // Success
                successColor = "color: green; font-weight: bold;";
                actorData.successCount += 1;
                DL(`Reroll was a success.`);
            } else if (outcome === "criticalSuccess") { // Critical Success
                critColor = "color: green; font-weight: bold;";
                successColor = "color: green; font-weight: bold;";
                actorData.critSuccessCount += 1;
                //actorData.successCount += 1;
                DL(`Reroll was a critical success.`);
            } else if (outcome === "criticalFailure") { // Critical Failure
                critFailColor = "color: red; font-weight: bold;";
                actorData.critFailCount += 1;
                DL(`Reroll was a critical failure.`);
            }

        } else {
            DL(2,`No original roll found for actor ${actorId}.`);
        }

	// Persist the roll stats
	await saveRollData();

	// Compute percents for chat output
	const rerollCount = actorData.rerollCount;
	const betterCount = actorData.betterCount;
	const worseCount = actorData.worseCount;
	const sameCount = actorData.sameCount;
	const successCount = actorData.successCount;
	const critSuccessCount = actorData.critSuccessCount;
	const critFailCount = actorData.critFailCount;

	const actorBetterPct = `${Math.round((betterCount / rerollCount) * 100)}%`;
	const actorWorsePct = `${Math.round((worseCount / rerollCount) * 100)}%`;
	const actorSamePct = `${Math.round((sameCount / rerollCount) * 100)}%`;
	const successPct = `${Math.round(((successCount + critSuccessCount) / rerollCount) * 100)}%`;
	const critPct = `${Math.round((critSuccessCount / rerollCount) * 100)}%`;
	const critFailPct = `${Math.round((critFailCount / rerollCount) * 100)}%`;

	// Optional chat output with color-coding like your createChatMessage path
	const outputToChat = game.settings.get(MODULE_NAME, "outputToChat");
	if (outputToChat) {

        // Prepare the chat message content
        const messageContent = `
				<h2>${LT.chat.actorHeader({ actorName: actor.name })}</h2>
				<ul>
					<li><strong>${LT.chat.rerollCountLabel()}</strong> ${actorData.rerollCount}</li>
					<li style="${betterColor}"><strong>${LT.chat.betterResultsLabel()}</strong> ${actorData.betterCount} (${actorBetterPct})</li>
					<li style="${worseColor}"><strong>${LT.chat.worseResultsLabel()}</strong> ${actorData.worseCount} (${actorWorsePct})</li>
					<li style="${sameColor}"><strong>${LT.chat.sameResultsLabel()}</strong> ${actorData.sameCount} (${actorSamePct})</li>
					<li style="${successColor}"><strong>${LT.chat.successPercentageLabel()}</strong> ${actorData.successCount + actorData.critSuccessCount} (${successPct})</li>
					<li style="${critColor}"><strong>${LT.chat.criticalSuccessPercentageLabel()}</strong> ${actorData.critSuccessCount} (${critPct})</li>
                    <li style="${critFailColor}"><strong>${LT.chat.criticalFailPercentageLabel()}</strong> ${actorData.critFailCount} (${critFailPct})</li>
				</ul>
			`;
		await ChatMessage.create({
			user: game.user.id,
			content: messageContent,
			speaker: { alias: LT.chat.speakerSingle() }
		});
	}

    // reset Colors for chat output
    betterColor = "";
    successColor = "";
    critColor = "";
    worseColor = "";
    sameColor = "";
    critFailColor = "";

	// Rebuild the journal entry, since stats changed on a reroll
	await compileActorStatsToJournal();
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
    const { rerollCount, betterCount, worseCount, sameCount, successCount, critSuccessCount, critFailCount } = actorData;
	
	// Calculate percentages
    const actorBetterPct = actorData.rerollCount > 0 ? `${Math.round((actorData.betterCount / actorData.rerollCount) * 100)}%` : 0;
	const actorWorsePct = `${Math.round((actorData.worseCount / actorData.rerollCount) * 100)}%`;
	const actorSamePct = `${Math.round((actorData.sameCount / actorData.rerollCount) * 100)}%`;
	const successPct = `${Math.round(((actorData.successCount + actorData.critSuccessCount) / actorData.rerollCount) * 100)}%`;
	const critPct = `${Math.round((actorData.critSuccessCount / actorData.rerollCount) * 100)}%`;
    const critFailPct = `${Math.round((actorData.critFailCount / actorData.rerollCount) * 100)}%`;
	
	// Prepare the chat message content
    const messageContent = `
        <h2>${LT.chat.actorHeader({ actorName: actor.name })}</h2>
        <ul>
            <li><strong>${LT.chat.rerollCountLabel()}</strong> ${rerollCount}</li>
            <li><strong>${LT.chat.betterResultsLabel()}</strong> ${betterCount} (${actorBetterPct})</li>
            <li><strong>${LT.chat.worseResultsLabel()}</strong> ${worseCount} (${actorWorsePct})</li>
            <li><strong>${LT.chat.sameResultsLabel()}</strong> ${sameCount} (${actorSamePct})</li>
			<li><strong>${LT.chat.successPercentageLabel()}</strong> ${successCount + critSuccessCount} (${successPct})</li>
			<li><strong>${LT.chat.criticalSuccessPercentageLabel()}</strong> ${critSuccessCount} (${critPct})</li>
            <li><strong>${LT.chat.criticalFailPercentageLabel()}</strong> ${critFailPct} (${critFailCount})</li>
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
async function compileActorStatsToJournal(journalName = LT.journalTitle()) {
    const journalWhen = new Date().toLocaleString();
    let journalContent = `
        <h1>${LT.journalTitle()}</h1>
        <p>${LT.migration.archivedAt({ when: journalWhen })}</p>`;

    // Initialize totals
    let totalRerollCount = 0;
    let totalBetterCount = 0;
    let totalWorseCount = 0;
    let totalSameCount = 0;
    let totalSuccessCount = 0;
    let totalCritSuccessCount = 0;
    let totalCritFailCount = 0;
	let actorBetterPct = 0;
	let actorWorsePct = 0;
	let actorSamePct = 0;
	let actorSuccessPct = 0;
	let actorCritPct = 0;
    let actorCritFailPct = 0;

    // Compile individual actor stats
    for (const [actorId, stats] of Object.entries(rollDataByActor)) {
        const actor = game.actors.get(actorId);
        if (!actor) continue;

		// Calculate percentages
        actorBetterPct = stats.rerollCount > 0 ? `${Math.round((stats.betterCount / stats.rerollCount) * 100)}%` : "N/A";
        actorWorsePct = stats.rerollCount > 0 ? `${Math.round((stats.worseCount / stats.rerollCount) * 100)}%` : "N/A";
        actorSamePct = stats.rerollCount > 0 ? `${Math.round((stats.sameCount / stats.rerollCount) * 100)}%` : "N/A";
        actorSuccessPct = stats.rerollCount > 0 ? `${Math.round(((stats.successCount + stats.critSuccessCount) / stats.rerollCount) * 100)}%` : "N/A";
        actorCritPct = stats.rerollCount > 0 ? `${Math.round((stats.critSuccessCount / stats.rerollCount) * 100)}%` : "N/A";
        actorCritFailPct = stats.rerollCount > 0 ? `${Math.round((stats.critFailCount / stats.rerollCount) * 100)}%` : "N/A";

        journalContent += `
            <h2>${actor.name}</h2>
            <ul>
                <li><strong>${LT.chat.totalRerollCountLabel()}</strong> ${stats.rerollCount || 0}</li>
				<li><strong>${LT.chat.totalBetterResultsLabel()}</strong> ${stats.betterCount || 0} (${actorBetterPct})</li>
                <li><strong>${LT.chat.totalWorseResultsLabel()}</strong> ${stats.worseCount || 0} (${actorWorsePct})</li>
                <li><strong>${LT.chat.totalSameResultsLabel()}</strong> ${stats.sameCount || 0} (${actorSamePct})</li>
                <li><strong>${LT.chat.totalSuccessResultsLabel()}</strong> ${stats.successCount + stats.critSuccessCount || 0} (${actorSuccessPct})</li>
                <li><strong>${LT.chat.totalCriticalResultsLabel()}</strong> ${stats.critSuccessCount || 0} (${actorCritPct})</li>
                <li><strong>${LT.chat.criticalFailPercentageLabel()}</strong> ${stats.critFailCount || 0} (${actorCritFailPct})</li>
            </ul>
        `;

        // Aggregate totals
        totalRerollCount += stats.rerollCount || 0;
        totalBetterCount += stats.betterCount || 0;
        totalWorseCount += stats.worseCount || 0;
        totalSameCount += stats.sameCount || 0;
        totalSuccessCount += stats.successCount || 0;
        totalCritSuccessCount += stats.critSuccessCount || 0;
        totalCritFailCount += stats.critFailCount || 0;
    }

    // Calculate percentages
	const totalBetterPct = totalRerollCount > 0 ? `${Math.round((totalBetterCount / totalRerollCount) * 100)}%` : "N/A";
	const totalWorsePct = totalRerollCount > 0 ? `${Math.round((totalWorseCount / totalRerollCount) * 100)}%` : "N/A";
	const totalSamePct = totalRerollCount > 0 ? `${Math.round((totalSameCount / totalRerollCount) * 100)}%` : "N/A";
    const totalSuccessPct = totalRerollCount > 0 ? `${Math.round(((totalSuccessCount + totalCritSuccessCount) / totalRerollCount) * 100)}%` : "N/A";
    const totalCritPct = totalRerollCount > 0 ? `${Math.round((totalCritSuccessCount / totalRerollCount) * 100)}%` : "N/A";
    const totalCritFailPct = totalRerollCount > 0 ? `${Math.round((totalCritFailCount / totalRerollCount) * 100)}%` : "N/A";

    // Append totals section
    journalContent += `
        <h2>${LT.chat.totalsHeader()}</h2>
        <ul>
            <li><strong>${LT.chat.totalRerollCountLabel()}</strong> ${totalRerollCount}</li>
            <li><strong>${LT.chat.totalBetterResultsLabel()}</strong> ${totalBetterCount} (${totalBetterPct})</li>
            <li><strong>${LT.chat.totalWorseResultsLabel()}</strong> ${totalWorseCount} (${totalWorsePct})</li>
            <li><strong>${LT.chat.totalSameResultsLabel()}</strong> ${totalSameCount} (${totalSamePct})</li>
            <li><strong>${LT.chat.totalSuccessResultsLabel()}</strong> ${totalSuccessCount} (${totalSuccessPct})</li>
            <li><strong>${LT.chat.totalCriticalResultsLabel()}</strong> ${totalCritSuccessCount} (${totalCritPct})</li>
            <li><strong>${LT.chat.criticalFailPercentageLabel()}</strong> ${totalCritFailCount} (${totalCritFailPct})</li>
        </ul>
    `;

    // Define the journal entry name
    //const journalName = LT.journalTitle();
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
                    content: journalContent,
                    format: 1 // HTML format
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

//function to retrieve the d20 face value from a rolls/rerolls
function getD20FaceValue(message) {

    // If xdy-workbench is set to "useHighestHeroPointRoll" and we captured RAW, prefer it
	try {
		const modId = "xdy-pf2e-workbench";
		if (game.modules.get(modId)?.active && game.settings?.settings?.has?.(`${modId}.heroPointRules`)) {
			if (game.settings.get(modId, "heroPointRules") === "useHighestHeroPointRoll") {
				const raw = message?.rolls?.[0]?.options?._wbRaw;
				if (Number.isFinite(raw?.rawNewD20)) {
					DL(`d20 face value (pre-Workbench/useHighest) = ${raw.rawNewD20}`);
					return raw.rawNewD20;
				}
			}
		}
	} catch (e) {
		// ignore and fall back to normal extraction
	}

    const d20Face =
        message.rolls?.[0]
        ?.dice?.find(d => d.faces === 20 && d.number === 1)
        ?.results?.find(r => r?.active)?.result ?? null;
    DL(`d20 face value = ${d20Face}`);
    return d20Face;
}

// function to retrieve the d20 face value from pf2e-toolbox target helper rolls/rerolls
function getTBD20FaceValue(data) {
    // If xdy-workbench is set to "useHighestHeroPointRoll" and we captured RAW, prefer it
    try {
		const modId = "xdy-pf2e-workbench";
		if (game.modules.get(modId)?.active && game.settings?.settings?.has?.(`${modId}.heroPointRules`)) {
			if (game.settings.get(modId, "heroPointRules") === "useHighestHeroPointRoll") {
				// If caller passed a Roll as the 2nd param (kept/new), try to read our capture off it
				const roll = arguments?.[1];
				const raw = roll?.options?._wbRaw;
				if (Number.isFinite(raw?.rawNewD20)) {
					DL(`TB d20 face (pre-Workbench/useHighest via roll.options) = ${raw.rawNewD20}`);
					return raw.rawNewD20;
				}
				// If Toolbelt handed explicit raw die in data, prefer it
				if (Number.isFinite(data?.rawDie)) {
					DL(`TB d20 face (pre-Workbench/useHighest via data.rawDie) = ${data.rawDie}`);
					return data.rawDie;
				}
			}
		}
	} catch (e) {
		// ignore and fall back
	}

    const d20Face = data?.die;
    return d20Face;
}
        
function _rsGetActiveD20(roll) {
    try {
        const d20 = roll?.dice?.find(d => d.faces === 20 && d.number === 1);
        const res = d20?.results?.find(r => r?.active)?.result;
        return Number.isFinite(res) ? res : null;
    } catch (err) {
        DL(3, "_rsGetActiveD20(): error", err);
        return null;
    }
}

function _wbCaptureUseHighest(oldRoll, newRoll, _something, which) {
    try {

        const faceBefore = (function getActiveD20(r) {
            try {
                const d20 = r?.dice?.find(d => d.faces === 20 && d.number === 1);
                const res = d20?.results?.find(rr => rr?.active)?.result;
                return Number.isFinite(res) ? res : null;
            } catch { return null; }
        })(newRoll);

        DL(`capture BEFORE WB: d20=${faceBefore}`);
        if (!newRoll.options) newRoll.options = {};
        newRoll.options._wbRaw = { rawNewD20: faceBefore, rule: "useHighestHeroPointRoll" };

        if (which !== "new") return;

        // Check the specific rule directly; no helper functions created.
        const modId = "xdy-pf2e-workbench";
        if (!game.modules.get(modId)?.active) return;
        if (!game.settings?.settings?.has?.(`${modId}.heroPointRules`)) return;
        const rule = game.settings.get(modId, "heroPointRules");
        if (rule !== "useHighestHeroPointRoll") return;

        const rawNewD20 = _rsGetActiveD20(newRoll);
        if (!newRoll.options) newRoll.options = {};
        newRoll.options._wbRaw = { rawNewD20, rule };

        DL(`_wbCaptureUseHighest(): rawNewD20=${rawNewD20}`);
    } catch (err) {
        DL(3, "_wbCaptureUseHighest(): error", err);
    }
}

/* =======================================================================
   {MACRO FUNCTIONS}
======================================================================= */

// Function to display combined reroll stats for all actors
function macro_displayCombinedRerollStats() {
    // Aggregate stats
    let totalRerollCount = 0;
    let totalBetterCount = 0;
    let totalWorseCount = 0;
    let totalSameCount = 0;
    let totalSuccessCount = 0;
    let totalCritSuccessCount = 0;
    let totalCritFailCount = 0;

    for (const stats of Object.values(rollDataByActor)) {
        totalRerollCount += stats.rerollCount || 0;
        totalBetterCount += stats.betterCount || 0;
        totalWorseCount += stats.worseCount || 0;
        totalSameCount += stats.sameCount || 0;
        totalSuccessCount += stats.successCount || 0;
        totalCritSuccessCount += stats.critSuccessCount || 0;
        totalCritFailCount += stats.critFailCount || 0;
    }

    // Calculate success percentages
	const totalBetterPct = totalRerollCount > 0 ? `${Math.round((totalBetterCount / totalRerollCount) * 100)}%` : "N/A";
	const totalWorsePct = totalRerollCount > 0 ? `${Math.round((totalWorseCount / totalRerollCount) * 100)}%` : "N/A";
	const totalSamePct = totalRerollCount > 0 ? `${Math.round((totalSameCount / totalRerollCount) * 100)}%` : "N/A";
	const totalSuccessPct = totalRerollCount > 0 ? `${Math.round(((totalSuccessCount + totalCritSuccessCount) / totalRerollCount) * 100)}%` : "N/A";
	const totalCritPct = totalRerollCount > 0 ? `${Math.round((totalCritSuccessCount / totalRerollCount) * 100)}%` : "N/A";	
    const totalCritFailPct = totalRerollCount > 0 ? `${Math.round((totalCritFailCount / totalRerollCount) * 100)}%` : "N/A";


    // Prepare message content
    const messageContent = `
        <h2>${LT.chat.totalsHeader()}</h2>
        <ul>
            <li><strong>${LT.chat.totalRerollCountLabel()}</strong> ${totalRerollCount}</li>
            <li><strong>${LT.chat.betterResultsLabel()}</strong> ${totalBetterCount} (${totalBetterPct})</li>
            <li><strong>${LT.chat.worseResultsLabel()}</strong> ${totalWorseCount} (${totalWorsePct})</li>
            <li><strong>${LT.chat.sameResultsLabel()}</strong> ${totalSameCount} (${totalSamePct})</li>
            <li><strong>${LT.chat.totalSuccessResultsLabel()}</strong> ${totalSuccessCount + totalCritSuccessCount} (${totalSuccessPct})</li>
            <li><strong>${LT.chat.totalCriticalResultsLabel()}</strong> ${totalCritSuccessCount} (${totalCritPct})</li>
            <li><strong>${LT.chat.criticalFailPercentageLabel()}</strong> ${totalCritFailCount} (${totalCritFailPct})</li>
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
async function macro_deleteActorRollData() {
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
async function macro_deleteAllRerollStats(deleteJournal = false) {
	
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
async function macro_openRerollEditor() {
    
	// Retrieve stored reroll data
    if (!rollDataByActor || Object.keys(rollDataByActor).length === 0) {
        ui.notifications.info(LT.notifications.noActorsWithRerollData());
        return;
    }

    // Create an HTML form with enhanced styling
    const content = `
        <form style="width: 100%; height: 100%; max-height: 600px; overflow-y: auto; padding: 5px; border: 1px solid #ccc; border-radius: 8px; background-color: #f9f9f9;">
            <div style="width: 300px; margin-bottom: 20px;">
                <select id="actor-select" style="width: 100%; padding: 0px; font-size: 1em; border: 1px solid #ccc; border-radius: 4px;">
                <option>${LT.selectActor()}</option>
                    ${Object.keys(rollDataByActor).map(actorId => {
                        const actor = game.actors.get(actorId);
                        return actor ? `<option value="${actorId}">${actor.name}</option>` : "";
                    }).join("")}
                </select>
            </div>
            <div id="reroll-data" style="display:none; margin-top: 10px;">
                ${["rerollCount", "betterCount", "worseCount", "sameCount", "successCount", "critSuccessCount", "critFailCount"].map(field => `
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
        </form>`;

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
                    ["rerollCount", "betterCount", "worseCount", "sameCount", "successCount", "critSuccessCount", "critFailCount" ].forEach(field => {
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
                        "critSuccessCount",
                        "critFailCount"
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
                        (actorData.critSuccessCount || 0) > (actorData.betterCount || 0) ||
                        (actorData.critFailCount || 0) > (actorData.worseCount || 0)
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

// Function to add a reroll result via dialog
async function macro_addRerollResult() {
	try {
		// Selected token/actor checks
		const token = canvas.tokens.controlled[0];
		if (!token || !token.actor) {
			ui.notifications?.warn(LT.notifications.noTokenSelected());
			return;
		}
		const actor = token.actor;
		if (actor.type !== "character") {
			ui.notifications?.warn(LT.noteifications.onlyCharactersSupported());
			return;
		}

		const actorName = actor.name;
		const title = LT.macro.addRerollResult({ name: actorName});

		// Build the dialog
		const dlg = new foundry.applications.api.DialogV2({
			window: { title },
			content: `
				<style>
					#rrs-wrap { padding-top: 4px; }
					#rrs-wrap p { margin: 0 0 8px 0; text-align: center; }
					#rrs-wrap .rrs-list { display: flex; flex-direction: column; gap: 8px; }
					#rrs-wrap .rrs-btn i { width: 1.2em; text-align: center; flex: 0 0 auto; }
				</style>

				<div id="rrs-wrap">
					<p>${LT.macro.selectOutcome({name: actorName})}</strong>:</p>
					<div class="rrs-list">
						<button type="button" class="rrs-btn"
							data-outcome="criticalSuccess" data-kind="better"
							style="box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;height:44px;padding:6px 10px;text-align:center;">
							<i class="fa-solid fa-star"></i><span>${LT.chat.betterCritBtn()}</span>
						</button>

						<button type="button" class="rrs-btn"
							data-outcome="success" data-kind="better"
							style="box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;height:44px;padding:6px 10px;text-align:center;">
							<i class="fa-solid fa-check"></i><span>${LT.chat.betterSuccessBtn()}</span>
						</button>

						<button type="button" class="rrs-btn"
							data-outcome="failure" data-kind="better"
							style="box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;height:44px;padding:6px 10px;text-align:center;">
							<i class="fa-solid fa-circle-xmark"></i><span>${LT.chat.betterFailBtn()}</span>
						</button>

						<button type="button" class="rrs-btn"
							data-outcome="failure" data-kind="worse"
							style="box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;height:44px;padding:6px 10px;text-align:center;">
							<i class="fa-solid fa-arrow-down"></i><span>${LT.chat.worseBtn()}</span>
						</button>

						<button type="button" class="rrs-btn"
							data-outcome="criticalFailure" data-kind="worse"
							style="box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;height:44px;padding:6px 10px;text-align:center;">
							<i class="fa-solid fa-skull-crossbones"></i><span>${LT.chat.critFailBtn()}</span>
						</button>

						<button type="button" class="rrs-btn"
							data-outcome="same"
							style="box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;height:44px;padding:6px 10px;text-align:center;">
							<i class="fa-solid fa-equals"></i><span>${LT.chat.sameBtn()}</span>
						</button>
					</div>
				</div>
			`,
			buttons: [{ action: "close", label: LT.close() }]
		});

		// Attach the click handler AFTER the dialog renders
		dlg.addEventListener("render", () => {
			const root = dlg.element;
			if (!root) return;
			const list = root.querySelector("#rrs-wrap .rrs-list");
			if (!list) return;

			list.addEventListener("click", async (ev) => {
				const btn = ev.target.closest("button[data-outcome]");
				if (!btn) return;

				const outcome = btn.dataset.outcome;
				const kind = btn.dataset.kind;

				let original = 1, reroll = 2;
				if (outcome === "same") {
					original = 1; reroll = 1;
				} else if (kind === "worse") {
					original = 2; reroll = 1;
				}

				DL(`macro_addRerollResult(): clicked ${outcome} (${kind ?? "neutral"})`);
				await handleRerollEvent(actor, original, reroll, outcome);
				dlg.close();
			});
		}, { once: true });

		await dlg.render({ force: true });
	} catch (err) {
		DL(3, "macro_addRerollResult(): error opening dialog", err);
		ui.notifications?.error("Failed to open reroll input dialog.");
	}
}

// Backup the current reroll stats to a JSON file (downloads in the browser)
async function macro_backupRerollData() {
	// GM only 
	if (!game.user.isGM) {
		ui.notifications?.warn(LT.notifications.gmOnly());
		DL(2, "macro_backupRerollData(): blocked non-GM");
		return;
	}

	try {
		// Make sure we’re working with the latest persisted state
		const persisted = game.settings.get(MODULE_NAME, "rollData") || {};
		// Merge any unsaved in-memory changes, favoring in-memory
		const snapshot = foundry?.utils?.deepClone
			? foundry.utils.deepClone({ ...persisted, ...rollDataByActor })
			: structuredClone({ ...persisted, ...rollDataByActor });

		const payload = {
			module: MODULE_NAME,
			exportedAt: new Date().toISOString(),
			world: {
				id: game.world?.id ?? null,
				title: game.world?.title ?? null
			},
			system: {
				id: game.system?.id ?? null,
				version: game.system?.version ?? null
			},
			data: snapshot
		};

		const json = JSON.stringify(payload, null, 2);

		// Build a readable filename: <world>-reroll-backup-YYYYMMDD.json
		const safeWorld = String(game.world?.title ?? "world").replace(/[^\w.-]+/g, "_");
		const now = new Date();
		const ts = [
			now.getFullYear(),
			String(now.getMonth() + 1).padStart(2, "0"),
			String(now.getDate()).padStart(2, "0"),
		].join("");
		const filename = `${safeWorld}-reroll-backup-${ts}.json`;

		// Foundry client helper triggers a browser download
		saveDataToFile(json, "application/json", filename);

		ui.notifications?.info(LT.macro.backupSaved());
		DL(`macro_backupRerollData(): wrote ${filename}`, { bytes: json.length });
	} catch (err) {
		DL(3, "macro_backupRerollData(): failed to write backup", err);
		ui.notifications?.error(LT.macro.backupFailed());
	}
}

// Import reroll stats from a backup .json file 
async function macro_restoreRerollData() {
	// GM only
	if (!game.user.isGM) {
		ui.notifications?.warn(LT.notifications.gmOnly());
		DL(2, "macro_restoreRerollData(): blocked non-GM");
		return;
	}

	try {
		const DialogV2 = foundry?.applications?.api?.DialogV2;
		const dialogId = "pf2e-reroll-restore";

		const title = LT.macro.restoreTitle();
		const warning = LT.macro.restoreWarning();
		const areYouSure = LT.dialog.areYouSure();
		const chooseFile = LT.macro.selectBackupFile();
		const okLbl = LT.dialog.ok();
		const cancelLbl = LT.cancel();

		const content = `
			<div style="display:flex;flex-direction:column;gap:.5rem;">
				<p style="color:#b00;font-weight:bold;">${warning}</p>
				<p>${areYouSure}</p>
				<label for="pf2e-rrs-file">${chooseFile}</label>
				<input type="file" id="pf2e-rrs-file" accept="application/json,.json" />
			</div>
		`;

		const dlg = new DialogV2({
			id: dialogId,
			title,
			content,
			buttons: [
				{
					action: "ok",
					label: okLbl,
					default: true,
					callback: async () => {
						try {
							const input = document.getElementById("pf2e-rrs-file");
							const file = input?.files?.[0] ?? null;
							if (!file) {
								ui.notifications?.warn(LT.notifications.noFileSelected());
								DL(2, "macro_restoreRerollData(): no file selected");
								return;
							}

							const text = await file.text();
							let payload;
							try {
								payload = JSON.parse(text);
							} catch (e) {
								DL(3, "macro_restoreRerollData(): invalid JSON", e);
								ui.notifications?.error(LT.notifications.invalidJson());
								return;
							}

							// Accept both exported envelope and plain map
							let imported = null;
							if (payload && typeof payload === "object") {
								if (payload.module === MODULE_NAME && payload.data && typeof payload.data === "object") {
									imported = payload.data; // our exported format
								} else if (!payload.module && !payload.data) {
									imported = payload; // plain map
								}
							}
							if (!imported || typeof imported !== "object") {
								ui.notifications?.error(LT.macro.invalidBackupShape());
								DL(3, "macro_restoreRerollData(): invalid backup shape", payload);
								return;
							}

							// Second confirm with counts
							const actorCount = Object.keys(imported).length;
							const confirmTitle = LT.macro.confirmImport();
							const overwriteMsg = LT.macro.overwriteCounts({ count: actorCount });

							const confirmDlg = new DialogV2({
								id: `${dialogId}-confirm`,
								title: confirmTitle,
								content: `
									<div style="display:flex;flex-direction:column;gap:.5rem;">
										<p>${overwriteMsg}</p>
										<p>${LT.dialog.areYouSure()}</p>
									</div>
								`,
								buttons: [
									{
										action: "yes",
										label: LT.dialog.yes(),
										default: true,
										callback: async () => {
											try {
												// Overwrite in-memory, persist, rebuild journal
												rollDataByActor = imported;
												DL("macro_restoreRerollData(): imported data applied in-memory", { actors: actorCount });

												await saveRollData(); // persist to world setting
												await compileActorStatsToJournal(); // rebuild journal

												ui.notifications?.info(LT.macro.importComplete());
											} catch (err) {
												DL(3, "macro_restoreRerollData(): import failed on apply", err);
												ui.notifications?.error(LT.macro.importFailed());
											}
										}
									},
									{
										action: "no",
										label: LT.dialog.no(),
										callback: () => DL("macro_restoreRerollData(): user canceled at confirm")
									}
								],
								position: { width: 520 }
							});
							await confirmDlg.render(true);
						} catch (err) {
							DL(3, "macro_restoreRerollData(): import failed", err);
							ui.notifications?.error(LT.macro.importFailed());
						}
					}
				},
				{
					action: "cancel",
					label: cancelLbl,
					callback: () => DL("macro_restoreRerollData(): canceled")
				}
			],
			position: { width: 520 }
		});

		await dlg.render(true);
	} catch (err) {
		DL(3, "macro_restoreRerollData(): failed to open dialog", err);
		ui.notifications?.error(LT.macro.importFailed());
	}
}

/* =======================================================================
    {HOOKS}
======================================================================= */

Hooks.on("pf2e.reroll", _wbCaptureUseHighest );

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

    // Retrieve or initialize actor stats
	if (!rollDataByActor[actorId]) {
		rollDataByActor[actorId] = {
			originalRoll: null,
			rerollCount: 0,
			betterCount: 0,
			worseCount: 0,
			sameCount: 0,
			successCount: 0,
			critSuccessCount: 0,
			critFailCount: 0
		};
	}
	const actorData = rollDataByActor[actorId];

    // Check if it is a ReRoll
    if (context?.isReroll) {
        
        // Get the reroll result and original roll to compare
        // const rerollResult = message.rolls[0]?.total;
        const rerollResult = getD20FaceValue(message);
        const originalRoll = actorData.originalRoll;
        const hasOutcome = !!context?.outcome;

        DL(`ReRoll detected | original: ${originalRoll} reroll: ${rerollResult} outcome:${hasOutcome}`);

        // If outcome is missing (no DC prompt), we whisper a GM-only chooser and stop further auto-accounting
        
        if (!hasOutcome) {
            DL("createChatMessage(): Reroll without outcome detected — prompting GM.");

            // Build the button bar (data attributes drive our click handler)
            const actorId = actor.id;
            const chatMsgData = `data-original="${originalRoll}" data-reroll="${rerollResult}" data-actor-id="${actorId}"`;
            let promptHtml = "";
            if (rerollResult > originalRoll) { // reroll is better
                DL("Reroll is better than original — prompting for type of better.");
                promptHtml = `
                    <div>
                        <p>${LT.chat.noOutcomePrompt()}</p>
                        <div style="display:flex;flex-wrap:wrap;gap:.5rem;">
                            <button type="button" class="reroll-no-outcome-btn" data-choice="better-crit" ${chatMsgData}>${LT.chat.betterCritBtn()}</button><br/>
                            <button type="button" class="reroll-no-outcome-btn" data-choice="better-success" ${chatMsgData}>${LT.chat.betterSuccessBtn()}</button><br/>
                            <button type="button" class="reroll-no-outcome-btn" data-choice="better-fail" ${chatMsgData}>${LT.chat.betterFailBtn()}</button>
                        </div>
                    </div>
                    `;
            } else if (rerollResult < originalRoll) { // reroll is worse
                DL("Reroll is worse than original — prompting for worse/same.");
                promptHtml = `
                    <div>
                        <p>${LT.chat.noOutcomePrompt()}</p>
                        <div style="display:flex;flex-wrap:wrap;gap:.5rem;">
                            <button type="button" class="reroll-no-outcome-btn" data-choice="worse" ${chatMsgData}>${LT.chat.worseBtn()}</button>
                            <button type="button" class="reroll-no-outcome-btn" data-choice="crit-fail" ${chatMsgData}>${LT.chat.critFailBtn()}</button>
                        </div>
                    </div>
                    `;
            } else { // reroll is same
                 DL("Reroll is the same as original — prompting for same/worse.");
                // Call Reroll handler for "same" immediately
                await handleRerollEvent(actor, originalRoll, rerollResult, "same");
                return; // Stop reroll handling
            }

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
        } else {
            DL(`Reroll has outcome '${context.outcome}' — processing normally.`);
            await handleRerollEvent(actor, originalRoll, rerollResult, context.outcome);
        } 

    } else {
        DL("Original D20 roll detected (not a reroll).");
		
        // Save the original roll for this actor
        //actorData.originalRoll = message.rolls[0]?.total; // Save total roll value
        actorData.originalRoll = getD20FaceValue(message); // Save total roll value
        DL(`Original roll saved for actor ${actorId}: ${actorData.originalRoll}`);
    }    
});

// Hook into pf2e-toolbelt targetHelper saves
Hooks.on("pf2e-toolbelt.rollSave", async ({ roll, message, rollMessage, target, data }) => {
  

	// GM only
	if (!game.user.isGM) return;

    DL("pf2e-toolbelt.rollSave() detected");

	try {
		const actor = target?.actor ?? target?.document?.actor ?? null;
		if (!actor) {
			DL(2, "pf2e-toolbelt.rollSave(): could not resolve actor from target", { target });
			return;
		}
		if (!isValidActorForRerollTracking(actor)) {
			DL(2, `pf2e-toolbelt.rollSave(): ignoring non-PC/minion actor ${actor.name}`);
		 return;
		}

		//const rollTotal = Number(roll?.total ?? data?.value ?? 0);
        const rollTotal = getTBD20FaceValue(data);
		const actorId = actor.id;

		if (!rollDataByActor[actorId]) {
			rollDataByActor[actorId] = {
				originalRoll: null,
				rerollCount: 0,
				betterCount: 0,
				worseCount: 0,
				sameCount: 0,
				successCount: 0,
				critSuccessCount: 0,
				critFailCount: 0
			};
		}

		rollDataByActor[actorId].originalRoll = rollTotal;
		DL(`pf2e-toolbelt.rollSave(): original d20 detected for ${actor.name} => total ${rollTotal}`);

		// Do NOT compile here; nothing changed in the stats yet
	} catch (err) {
		DL(3, "pf2e-toolbelt.rollSave(): error", err);
	}
});

// Hook into pf2e-toolbelt targetHelper rerolls
Hooks.on("pf2e-toolbelt.rerollSave", async ({ oldRoll, newRoll, keptRoll, message, target, data }) => {
	// GM only
	if (!game.user.isGM) return;

    DL("Reroll detected!");

	try {
		const actor = target?.actor ?? target?.document?.actor ?? null;
		if (!actor) {
			DL(2, "pf2e-toolbelt.rerollSave(): could not resolve actor from target", { target });
			return;
		}
		if (!isValidActorForRerollTracking(actor)) {
			DL(2, `pf2e-toolbelt.rerollSave(): ignoring non-PC/minion actor ${actor.name}`);
			return;
		}

		// The kept result is the one we compare against the stored original
		const kept = keptRoll ?? newRoll ?? null;
		//const keptTotal = Number(kept?.total ?? data?.value ?? 0);
        const keptTotal = getTBD20FaceValue(data);

		// Normalize outcome if present
		const rawOutcome = String(data?.success ?? data?.unadjustedOutcome ?? "unknown");
        const outcome = (() => {
            const o = rawOutcome.toLowerCase().replace(/\s+/g, "");
            if (o === "criticalsuccess") return "criticalSuccess";
            if (o === "criticalfailure") return "criticalFailure";
            if (o === "success") return "success";
            if (o === "failure") return "failure";
            return "unknown";
        })();
        DL(`pf2e-toolbelt.rollSave(): outcome raw='${rawOutcome}' normalized='${outcome}'`);

		const actorId = actor.id;
		const originalTotal = rollDataByActor[actorId]?.originalRoll ?? null;
		if (originalTotal === null) {
			DL(2, `pf2e-toolbelt.rerollSave(): no original roll stored for ${actor.name}; cannot compare`);
			return;
		}

		DL(`pf2e-toolbelt.rerollSave(): reroll for ${actor.name} => kept ${keptTotal} vs original ${originalTotal}`);

		// Single place to update stats + output + compile
		await handleRerollEvent(actor, originalTotal, keptTotal, outcome);
	} catch (err) {
		DL(3, "pf2e-toolbelt.rerollSave(): error", err);
	}
});

// Handle clicks on the no-outcome buttons in our special GM prompt
Hooks.on("renderChatMessage", async (message, html, data) => {
	// Only process if this is our reroll prompt
	const isNoOutcome = message?.flags?.[MODULE_NAME]?.type === "noOutcomePrompt";
	if (!isNoOutcome) return;

	// Add one-time click handler to all .reroll-no-outcome-btn buttons
	html.find(".reroll-no-outcome-btn").one("click", async (event) => {
		try {
			const btn = event.currentTarget;
			const choice = btn.dataset.choice;
			const actorId = btn.dataset.actorId;
			const original = parseInt(btn.dataset.original ?? "NaN", 10);
			const reroll = parseInt(btn.dataset.reroll ?? "NaN", 10);

			// Validate data
			if (!choice || isNaN(original) || isNaN(reroll)) {
				ui.notifications?.error("Missing or invalid data for reroll choice.");
				return;
			}
			const actor = game.actors.get(actorId);
			if (!actor) {
				ui.notifications?.error("Could not find actor for reroll.");
				return;
			}

			// Map button choice to final outcome label
			let outcome = "unknown";
			switch (choice) {
				case "better-crit": outcome = "criticalSuccess"; break;
				case "better-success": outcome = "success"; break;
				case "better-fail": outcome = "failure"; break;
				case "crit-fail": outcome = "criticalFailure"; break;
				case "worse": outcome = "failure"; break;
				case "same": outcome = "same"; break;
			}

			// Call the reroll tracker
			await handleRerollEvent(actor, original, reroll, outcome);

			// Optionally delete the button prompt message
			await message.delete();

		} catch (err) {
			console.error("PF2e ReRoll Stats | renderChatMessage failed", err);
			ui.notifications?.error("Error processing reroll choice.");
		}
	});
});

// On ready, load existing roll data from settings
Hooks.once("ready", async () => {
    // Initialize rollDataByActor from game settings or as an empty object
    rollDataByActor = game.settings.get(MODULE_NAME, "rollData") || {};
    
    //Make our pf2e.reroll hook run before Workbench
    try {
        const list = Hooks._hooks?.["pf2e.reroll"];
        if (Array.isArray(list)) {
            const idx = list.indexOf(_wbCaptureUseHighest);
            if (idx > 0) {
                list.splice(idx, 1);
                list.unshift(_wbCaptureUseHighest);
                DL("pf2e.reroll: moved _wbCaptureUseHighest to the front (before Workbench)");
                
            }
            DL(`pf2e.rerool list: `, list);
        }
    } catch (err) {
        DL(2, "pf2e.reroll: unable to reorder handlers", err);
    }

    // Handle Migration if needed
    try {
		if (!game.user.isGM) return; // Only the GM handles migrations

		let migrationData = game.settings.get(MODULE_NAME, "migrationData") || {};
		const hasCritFailMigration = Number(migrationData?.critFailMigration) === 1;
		// If we haven't done the crit fail migration yet, prompt the GM
        if (!hasCritFailMigration) {
            // Prompt the GM to run the migration
            await migration_critFailData();
        }
	} catch (err) {
		DL(3, "ready(): migration prompt error", err);
	}

    try {
		const api = {
			displayActorStatsInChat,
			compileActorStatsToJournal,
			macro_displayCombinedRerollStats,
			macro_deleteActorRollData,
			macro_deleteAllRerollStats,
			macro_openRerollEditor,
            macro_addRerollResult,
            macro_backupRerollData,
            macro_restoreRerollData
		};

		// Expose the API via the module
		const mod = game.modules.get("pf2e-reroll-stats");
		if (mod) mod.api = api;

		// Also attach to globalThis for easy access
		globalThis.pf2eRerollStats = api;

	} catch (e) {
		console.error(`PF2e ReRoll Stats | Failed to expose API: ${e?.message || e}`);
	}
    console.log(`%c${LOG_LABEL} Reroll Tracker ready!`, "color: Orange; font-weight: bold;");
});

Hooks.once("init", () => {
    
    // HIDDEN DATA: persistent roll data
    game.settings.register(MODULE_NAME, "rollData", {
        name: LT.settings.rollDataName(),
        hint: LT.settings.rollDataHint(),
        scope: "world", // Saved at the world level
        config: false,  // Not exposed in the settings menu
        type: Object,
        default: {},
    });

    // HIDDEN DATA: Reusable world-scoped object to track any/all migrations
	game.settings.register(MODULE_NAME, "migrationData", {
		name: "PF2e Reroll: Migration Data",
		scope: "world",
		config: false,
		type: Object,
		default: {} 
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
        default: true
	 });

     // Option to calculate reroll settings if xdy-workbench variant rule is enabled
     game.settings.register(MODULE_NAME, "ignoreWorkbenchVariant", {
        name: LT.settings.IgnoreWorkbenchVariantName(),
        hint: LT.settings.IgnoreWorkbenchVariantHint(),
        scope: "world",
        config: true,
        type: Boolean,
        default: false
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
	console.log(`%cPF2e ReRoll Stats | Debugging: ${debugLevel}`, "color: orange; font-weight: bold;");

});