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
    text?: string;
    voice?: ArrayBuffer;
    timestamp: DateTime;
    context: IRobinContext;
}

export interface IRobinResult {
    context: IRobinContext;
    messages: string[];
    wit: any;
}

export class Robin {
    private readonly url = "https://api.wit.ai";
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

    private async queryWitText(message: string, timestamp: DateTime): Promise<any> {
        const response = await axios.get(`${this.url}/message`, {
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

    // TODO: Currently forcing voice to be in audio/mpeg format due to Wit's broken OGG support.
    private async queryWitVoice(voice: ArrayBuffer, timestamp: DateTime): Promise<any> {
        const response = await axios.post(`${this.url}/speech`, voice, {
            headers: {
                "Authorization": `Bearer ${this.token}`,
                "Content-Type": "audio/mpeg",
                "Accept": "application/json",
            },
            params: {
                v: this.version,
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

    private async queryWit(session: IRobinSession): Promise<any> {
        if(session.text) {
            return await this.queryWitText(session.text, session.timestamp);
        } else if(session.voice) {
            return await this.queryWitVoice(session.voice, session.timestamp);
        } else {
            throw new Error("Either text or voice must be given");
        }
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
        const context = Object.assign({}, session.context);
        const ephemeral: IEphemeralContext = {
            greetings: false,
            bye: false,
            thanks: false,
            sentiment: "neutral",
            intents: [],
        };

        const wit = await this.queryWit(session);
        wit.intents = wit.intents || [];
        wit.entities = wit.entities || {};
        wit.traits = wit.traits || {};

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

        if(context.messageCounter === 0 || session.text === "/start") {
            messages.push(ROBIN_MESSAGES.welcome.any());
        }

        if(ephemeral.intents.includes("tell_joke")) {
            messages.push(ROBIN_MESSAGES.joke.get(context.jokeCounter, ROBIN_MESSAGES.doneJoking.any()));
            context.jokeCounter = Math.min(context.jokeCounter + 1, ROBIN_MESSAGES.joke.length);
            context.lastJokeOn = DateTime.local();
        }

        context.messageCounter += 1;
        context.lastMessageOn = session.timestamp;

        return {
            context,
            messages,
            wit,
        };
    }
}
