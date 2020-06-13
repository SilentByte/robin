/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as readline from "readline";
import * as colors from "colors";
import * as columnify from "columnify";
import { DateTime } from "luxon";
import {
    IRobinContext,
    Robin,
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
        lastGreetingOn: DateTime.fromSeconds(0),
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

        console.log("");
        result.messages.forEach((m, i, a) => {
            console.log(`${i + 1}) ${formatMessage(m)}`);
            console.log("");
        });

        console.log(
            columnify(Object.keys(context).map(k => {
                const previous = (context as any)[k].toString();
                let next = (result.context as any)[k].toString();

                if(previous !== next) {
                    k = colors.yellow.bold(k);
                    next = colors.yellow.bold(next);
                }

                return {
                    state: k,
                    previous,
                    next,
                };
            }), {
                columnSplitter: "    ",
                headingTransform: heading => colors.bold(heading.toUpperCase()),
            }),
        );
        console.log("");

        context = result.context;
    }

    rl.close();
})();
