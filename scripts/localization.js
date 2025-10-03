/*  Localization — dynamic LT ========================== */

import { DL } from "./reroll.js";

export const MOD_ID = "reroll";

/*
    L: localize a key (no placeholders)
*/
export function L(key) {
    // Debug
    //DL("L(): start");
    try {
        const s = game.i18n.localize(key);
        if (s === key) DL(2, "L(): missing key", { key });
        return s;
    } catch (err) {
        DL(3, "L(): error", err);
        return key;
    }
}

/*
    LF: format a key with {placeholders}
*/
export function LF(key, data = {}) {
    // Debug
    //DL("LF(): start");
    try {
        const out = game.i18n.format(key, data);
        if (out === key) DL(2, "LF(): missing key", { key, data });
        return out;
    } catch (err) {
        DL(3, "LF(): error", err);
        return key;
    }
}

/*
    Dynamic LT:
    - Any property chain becomes a key path under "bbmm"
    - Call with no args => L()
    - Call with an object => LF()
*/
function makeNode(key) {
    // Callable function: LT.something(...) -> localize/format
    const fn = (data) => {
        // Debug
        //DL("LT(): lookup", { key, hasData: !!data });
        return data && typeof data === "object" ? LF(key, data) : L(key);
    };

    return new Proxy(fn, {
        get(_target, prop) {
            // Avoid prototype noise
            if (prop === "prototype" || prop === "name" || prop === "length") return undefined;
            // Allow peeking at full key if ever needed
            if (prop === "_key") return key;
            // Build nested path
            const nextKey = key ? key + "." + String(prop) : String(prop);
            return makeNode(nextKey);
        }
    });
}

// Start all lookups from the root 
export const LT = makeNode(MOD_ID);