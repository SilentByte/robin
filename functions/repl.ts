/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as readline from "readline";
import { DateTime } from "luxon";
import {
    IRobinContext
    , Robin,
} from "./src/robin";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const robin = new Robin({
    token: process.env.WIT_ACCESS_TOKEN || "",
    log: false,
});

function prompt(): Promise<string> {
    return new Promise(resolve => {
        rl.question("robin> ", input => {
            resolve(input);
        });
    });
}

function formatMessage(message: string) {
    try {
        return JSON.stringify(JSON.parse(message), null, 4);
    } catch {
        return message;
    }
}

(async () => {
    let context: IRobinContext = {
        userName: "Rico",
        lastMessageOn: DateTime.local(),
        jokeCounter: 0,
        lastJokeOn: DateTime.fromSeconds(0),
    };

    while(true) {
        const message = (await prompt()).trim();
        if(!message) {
            continue;
        } else if(message === "exit") {
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
            console.log(`${i + 1}) ${formatMessage(m)}`);
            console.log("");
        });
    }

    rl.close();
})();
