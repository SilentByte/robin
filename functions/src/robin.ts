/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import axios from "axios";
import { DateTime } from "luxon";

import log from "./log";
import { ROBIN_MESSAGES } from "./messages";

export type RobinState = "default";

export interface IRobinContext {
    state: RobinState;
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

class RobinLogic {
    private messages: string[] = [];

    private constructor(
        private wit: any,
        private ephemeral: IEphemeralContext,
        private context: IRobinContext,
        private session: IRobinSession,
    ) {
        this.processGreetings();
        this.processFirstInteraction();
        this.processIntents();
        this.processBye();
        this.processConfused();

        this.context.messageCounter += 1;
        this.context.lastMessageOn = session.timestamp;
    }

    private processGreetings() {
        if(this.ephemeral.greetings || this.context.messageCounter === 0) {
            if(this.context.userName) {
                this.messages.push(ROBIN_MESSAGES.personalGreeting.any({name: this.context.userName}));
            } else {
                this.messages.push(ROBIN_MESSAGES.genericGreeting.any());
            }
        }
    }

    private processFirstInteraction() {
        if(this.context.messageCounter === 0 || this.session.text === "/start") {
            this.messages.push(ROBIN_MESSAGES.welcome.any());
        }
    }

    private processTellJokeIntent() {
        this.messages.push(ROBIN_MESSAGES.joke.get(this.context.jokeCounter, ROBIN_MESSAGES.doneJoking.any()));
        this.context.jokeCounter = Math.min(this.context.jokeCounter + 1, ROBIN_MESSAGES.joke.length);
        this.context.lastJokeOn = DateTime.local();
    }

    private processIntents() {
        const intent = ({
            "tell_joke": () => this.processTellJokeIntent(),
        } as any)[this.ephemeral.intents[0]];

        if(intent) {
            intent();
        }
    }

    private processBye() {
        if(this.messages.length === 0 && this.ephemeral.bye) {
            this.messages.push(ROBIN_MESSAGES.bye.any({name: this.context.userName}));
        }
    }

    private processConfused() {
        if(this.messages.length === 0) {
            this.messages.push(ROBIN_MESSAGES.confused.any());
        }
    }

    static process(
        wit: any,
        ephemeral: IEphemeralContext,
        context: IRobinContext,
        session: IRobinSession,
    ): IRobinResult {
        const logic = new RobinLogic(wit, ephemeral, context, session);
        return {
            context: logic.context,
            messages: logic.messages,
            wit: logic.wit,
        };
    }
}

export class Robin {
    private readonly url = "https://api.wit.ai";
    private readonly version = "20200612";
    private readonly token: string;

    constructor(options: {
        token: string;
    }) {
        this.token = options.token;
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

        log.debug(response.data);
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

        log.debug(response.data);
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
        ephemeral.thanks = !!wit.traits.wit$thanks;

        ephemeral.greetings = !!wit.traits.wit$greetings;
        ephemeral.bye = !!wit.traits.wit$bye;

        if(ephemeral.greetings && ephemeral.bye) {
            if(wit.traits.wit$greetings.confidence > wit.traits.wit$bye.confidence) {
                ephemeral.bye = false;
            } else {
                ephemeral.greetings = false;
            }
        }

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
        return RobinLogic.process(wit, ephemeral, context, session);
    }
}
