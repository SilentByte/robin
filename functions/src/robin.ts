/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import axios from "axios";
import { DateTime } from "luxon";
import { ROBIN_MESSAGES } from "./messages";

export interface IRobinContext {
    userName: string;
    lastMessageOn: DateTime;
    messageCounter: number;
    lastGreetingOn: DateTime;
    jokeCounter: number;
    lastJokeOn: DateTime;
}

interface IEphemeralContext {
    greetings: boolean;
    bye: boolean;
    thanks: boolean;
    sentiment: "negative" | "neutral" | "positive";
    intents: string[];
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
                q: message.slice(0, 280),
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

    private static processTraits(wit: any, ephemeral: IEphemeralContext) {
        ephemeral.greetings = !!wit.traits.wit$greetings;
        ephemeral.bye = !!wit.traits.wit$bye;
        ephemeral.thanks = !!wit.traits.wit$thanks;

        if(wit.traits.wit$sentiment) {
            ephemeral.sentiment = wit.traits.wit$sentiment[0].value;
        }
    }

    private static processIntents(wit: any, ephemeral: IEphemeralContext) {
        ephemeral.intents = wit.intents.map((i: any) => i.name);
    }

    async process(session: IRobinSession): Promise<IRobinResult> {
        const wit = await this.queryWit(session.message, session.timestamp);

        const context = Object.assign({}, session.context);
        const ephemeral: IEphemeralContext = {
            greetings: false,
            bye: false,
            thanks: false,
            sentiment: "neutral",
            intents: [],
        };

        Robin.processTraits(wit, ephemeral);
        Robin.processIntents(wit, ephemeral);

        const messages = [];

        if(ephemeral.greetings || context.messageCounter === 0) {
            if(context.userName) {
                messages.push(ROBIN_MESSAGES.personalGreeting.any({name: context.userName}));
            } else {
                messages.push(ROBIN_MESSAGES.genericGreeting.any());
            }
        }

        if(context.messageCounter === 0) {
            messages.push(ROBIN_MESSAGES.welcome.any());
        }

        if(ephemeral.intents.includes("tell_joke")) {
            messages.push(ROBIN_MESSAGES.joke.get(context.jokeCounter, ROBIN_MESSAGES.doneJoking.any()));
            context.jokeCounter = Math.min(context.jokeCounter + 1, ROBIN_MESSAGES.joke.length);
            context.lastJokeOn = DateTime.local();
        } else {
            messages.push(JSON.stringify(wit));
        }

        context.messageCounter += 1;
        context.lastMessageOn = session.timestamp;

        return {
            context,
            messages,
        };
    }
}
