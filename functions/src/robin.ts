/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import axios from "axios";
import { DateTime } from "luxon";
import { ROBIN_MESSAGES } from "./messages";

export interface IRobinContext {
    userName?: string;
    lastMessageOn: DateTime;
    jokeCounter: number;
    lastJokeOn: DateTime;
}

export interface IRobinSession {
    message: string;
    timestamp: DateTime;
    context: IRobinContext;
}

export interface IRobinResult {
    context: IRobinContext;
    messages: string[];
}

export class Robin {
    private readonly url = "https://api.wit.ai/message";
    private readonly version = "20200612";
    private readonly token: string;
    private readonly log: boolean;

    constructor(options: {
        token: string;
        log: boolean;
    }) {
        this.token = options.token;
        this.log = options.log;
    }

    private async sendMessage(message: string, timestamp: DateTime): Promise<any> {
        const response = await axios.get(this.url, {
            headers: {
                "Authorization": `Bearer ${this.token}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            params: {
                v: this.version,
                q: message,
                context: JSON.stringify({
                    reference_time: timestamp.toISO(),
                }),
            },
        });

        if(this.log) {
            console.log(response.data);
        }

        return response.data;
    }

    async process(session: IRobinSession): Promise<IRobinResult> {
        const response = await this.sendMessage(session.message, session.timestamp);

        let context = Object.assign({}, session.context);
        const messages = [];
        if(response.traits.wit$greetings) {
            if(context.userName) {
                messages.push(ROBIN_MESSAGES.personalGreeting.any({name: context.userName}));
            } else {
                messages.push(ROBIN_MESSAGES.genericGreeting.any());
            }
        }

        if(response.intents.some((i: any) => i.name === "tell_joke")) {
            messages.push(ROBIN_MESSAGES.joke.get(context.jokeCounter, ROBIN_MESSAGES.doneJoking.any()));
            context.jokeCounter = Math.min(context.jokeCounter + 1, ROBIN_MESSAGES.joke.length);
            context.lastJokeOn = DateTime.local();
        } else {
            messages.push(JSON.stringify(response));
        }

        context.lastMessageOn = session.timestamp;

        return {
            context,
            messages,
        };
    }
}
