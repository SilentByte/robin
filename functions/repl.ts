/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as fs from "fs";
import * as readline from "readline";
import * as colors from "colors";
import * as columnify from "columnify";
import * as yaml from "yaml";
import { DateTime } from "luxon";
import {
    IRobinContext,
    Robin,
} from "./src/robin";

const HISTORY_FILE_NAME = ".robin.history.json";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 100,
    removeHistoryDuplicates: true,
});

rl.on("close", () => {
    fs.writeFileSync(HISTORY_FILE_NAME, JSON.stringify((rl as any).history));
});

if(fs.existsSync(HISTORY_FILE_NAME)) {
    (rl as any).history = JSON.parse(fs.readFileSync(HISTORY_FILE_NAME, "utf8")) || [];
}

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
        messageCounter: 0,
        lastGreetingOn: DateTime.fromSeconds(0),
        jokeCounter: 0,
        lastJokeOn: DateTime.fromSeconds(0),
    };

    let lastWit = null;
    repl: while(true) {
        const text = (await prompt()).trim();
        switch(text) {
            case "":
                continue;
            case "exit":
                break repl;
            case "wit":
                console.log(yaml.stringify(lastWit));
                continue;
        }

        const result = await robin.process({
            context,
            text,
            timestamp: DateTime.local(),
        });

        lastWit = result.wit;

        console.log("");
        result.messages.forEach((m, i) => {
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
