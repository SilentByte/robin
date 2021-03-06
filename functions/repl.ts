/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as fs from "fs";
import * as readline from "readline";
import * as colors from "colors";
import * as columnify from "columnify";
import * as yaml from "yaml";
import {
    DateTime,
    Interval,
} from "luxon";

import {
    Robin,
    IRobinExpense,
    defaultContext,
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
    let context = defaultContext();
    let lastWit = null;
    let expenses: IRobinExpense[] = [];

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

        const result = await new Robin({
            token: process.env.WIT_ACCESS_TOKEN || "",
        }).process({
            context,
            text,
            timestamp: DateTime.local(),
            async queryExpenses(interval: Interval): Promise<IRobinExpense[]> {
                return expenses.filter(e => interval.contains(e.incurredOn))
                    .sort((lhs, rhs) => lhs.incurredOn.toSeconds() - rhs.incurredOn.toSeconds());
            },
        });

        lastWit = result.wit;

        console.log("");
        result.messages.forEach((m, i) => {
            console.log(`${i + 1}) ${formatMessage(m)}`);
            console.log("");
        });

        console.log(
            columnify(Object.keys(context).map(k => {
                const previous = (context as any)[k]?.toString() || "null";
                let next = (result.context as any)[k]?.toString() || "null";

                let state = k;
                if(previous !== next) {
                    state = colors.yellow.bold(k);
                    next = colors.yellow.bold(next);
                }

                return {
                    state,
                    previous,
                    next,
                };
            }), {
                columnSplitter: "    ",
                headingTransform: heading => colors.bold(heading.toUpperCase()),
            }),
        );
        console.log("");

        if(result.actions.length > 0) {
            console.log(yaml.stringify(result.actions));
            console.log("");

            result.actions.forEach(a => {
                if(a.type === "add_expense") {
                    expenses.push({
                        item: a.item,
                        value: a.value,
                        incurredOn: a.incurredOn,
                    });
                }
            });
        }

        context = result.context;
    }

    rl.close();
})();
