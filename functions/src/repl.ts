/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as readline from "readline";
import { DateTime } from "luxon";
import {
    IRobinContext
    , Robin,
} from "./robin";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const robin = new Robin({
    token: process.env.WIT_ACCESS_TOKEN || "",
    log: false,
});

function prompt(): Promise<string> {
    return new Promise((resolve, reject) => {
        rl.question("robin> ", input => {
            resolve(input);
        });
    });
}

(async () => {
    let context: IRobinContext = {
        name: "Rico",
        jokeCounter: 0,
    };

    while(true) {
        const message = (await prompt()).trim();
        if(!message) {
            break;
        }

        const result = await robin.process({
            context,
            message,
            timestamp: DateTime.local(),
        });

        context = result.context;

        console.log("");
        result.messages.forEach((m, i, a) => {
            console.log(`[${i + 1}/${a.length}] ${m}`);
            console.log("");
        });
    }
})();
