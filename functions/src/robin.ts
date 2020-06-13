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
    lastGreetingOn: DateTime;
    jokeCounter: number;
    lastJokeOn: DateTime;
}

interface IEphemeralContext {
    greetings: boolean;
    bye: boolean;
    thanks: boolean;
    sentiment: "negative" | "neutral" | "positive";
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

    private async queryWit(message: string, timestamp: DateTime): Promise<any> {
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

    private static processTraits(response: any, context: IRobinContext, ephemeral: IEphemeralContext) {
        ephemeral.greetings = !!response.traits.wit$greetings;
        ephemeral.bye = !!response.traits.wit$bye;
        ephemeral.thanks = !!response.traits.wit$thanks;

        if(response.traits.wit$sentiment) {
            ephemeral.sentiment = response.traits.wit$sentiment[0].value;
        }
    }

    async process(session: IRobinSession): Promise<IRobinResult> {
        const response = await this.queryWit(session.message, session.timestamp);

        const context = Object.assign({}, session.context);
        const ephemeral: IEphemeralContext = {
            greetings: false,
            bye: false,
            thanks: false,
            sentiment: "neutral",
        };

        Robin.processTraits(response, context, ephemeral);

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
