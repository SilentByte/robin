/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import axios from "axios";
import { DateTime } from "luxon";

function squash(message: string): string {
    return message.replace(/\s+/g, " ");
}

export interface IRobinContext {
    name?: string;
    jokeCounter: number;
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

// TODO: Replace with proper messaging system that can easily format text
//       and replace placeholders with actual values. Also set up message
//       formatting (e.g. *bold* for Telegram).
export const ROBIN_MESSAGES = {
    voiceNotSupported: squash(`
        I'm sorry, I can't understand voice messages at the moment. 😔
        My team and I are working on it! 🔨😃
    `),
    messageTypeNotSupported: squash(`
        Oh no, looks like I haven't received training for this message format yet. 😔
    `),
    greetings: [
        squash(`Hey %NAME, how's it going?`),
        squash(`Oh hi, %NAME, how can I help?`),
        squash(`Hi there!`),
    ],
    outOfJokes: "I think that's enough for now. I'm an accountant, not a comedian. 😉",
    jokes: [
        squash(`I can't imagine living without an accountant... It must be <b>accrual</b> life. 🌎😂`),
        squash(`I almost fell down the stairs the other day... I lost <b>my balance</b>. ☺️`),
        squash(`Aww! 🤗 Thanks for your kind gift, I really <b>depreciate</b> it!`),
    ],
};

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

        const messages = [];
        if(response.traits.wit$greetings) {
            messages.push(ROBIN_MESSAGES.greetings[Math.floor(Math.random() * ROBIN_MESSAGES.greetings.length)]
                .replace("%NAME", session.context.name || "friend"));
        }

        if(response.intents.some((i: any) => i.name === "tell_joke")) {
            messages.push(ROBIN_MESSAGES.jokes[session.context.jokeCounter] || ROBIN_MESSAGES.outOfJokes);
        } else {
            messages.push(JSON.stringify(response));
        }

        return {
            context: session.context,
            messages,
        };
    }
}

