/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import axios from "axios";
import { DateTime } from "luxon";

import log from "./log";
import { ROBIN_MESSAGES } from "./messages";

export interface IRobinContext {
    state: string;
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
    intent: string;
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

export function defaultContext(): IRobinContext {
    return {
        state: "init",
        userName: "anonymous",
        lastMessageOn: DateTime.local(),
        messageCounter: 0,
        lastGreetingOn: DateTime.fromSeconds(0),
        jokeCounter: 0,
        lastJokeOn: DateTime.fromSeconds(0),
    };
}

class RobinLogic {
    private messages: string[] = [];

    private readonly states: { [name: string]: Array<[string, () => string]> } = {
        "init": [
            ["first_interaction", () => {
                this.sayHi();
                this.sayWelcome();
                return "main!";
            }],
        ],
        "main": [
            ["tell_joke_intent", () => {
                if(this.ephemeral.intent !== "tell_joke") {
                    return "";
                }

                this.sayJoke();
                return "main";
            }],
            ["who_are_you", () => {
                if(this.ephemeral.intent !== "who_are_you") {
                    return "";
                }

                this.say(ROBIN_MESSAGES.introduction.any());
                return "main";
            }],
            ["bye", () => {
                if(this.messages.length === 0 && this.ephemeral.bye) {
                    this.say(ROBIN_MESSAGES.bye.any({name: this.context.userName}));
                    return "main";
                }

                return "";
            }],
            ["confused", () => {
                if(this.messages.length === 0) {
                    this.say(ROBIN_MESSAGES.confused.any());
                }

                return "main";
            }],
        ],
    };

    constructor(
        private wit: any,
        private ephemeral: IEphemeralContext,
        private context: IRobinContext,
        private session: IRobinSession,
    ) {
        //
    }

    private say(message: string) {
        this.messages.push(message);
    }

    private sayHi() {
        if(this.context.userName) {
            this.say(ROBIN_MESSAGES.personalGreeting.any({name: this.context.userName}));
        } else {
            this.say(ROBIN_MESSAGES.genericGreeting.any());
        }
    }

    private sayWelcome() {
        this.say(ROBIN_MESSAGES.welcome.any());
    }

    private sayJoke() {
        this.say(ROBIN_MESSAGES.joke.get(this.context.jokeCounter, ROBIN_MESSAGES.doneJoking.any()));
        this.context.jokeCounter = Math.min(this.context.jokeCounter + 1, ROBIN_MESSAGES.joke.length);
        this.context.lastJokeOn = DateTime.local();
    }

    private execute(state: string): string {
        const transitions = this.states[state] || this.states["init"];
        for(const t of transitions) {
            log.info(`SM trying ${state}.${t[0]}`);
            const next = t[1]();
            if(next.endsWith("!")) {
                log.info(`SM transitioning to ${state}.${next}`);
                return this.execute(next.slice(0, -1));
            } else if(next !== "") {
                return state;
            }
        }

        log.warn("SM is out of options");
        return state;
    }

    transition(): IRobinResult {
        log.info(`SM starts with ${this.context.state}`);
        this.context.state = this.execute(this.context.state);
        log.info(`SM ends with ${this.context.state}`);

        this.context.messageCounter += 1;
        this.context.lastMessageOn = this.session.timestamp;

        return {
            context: this.context,
            messages: this.messages,
            wit: this.wit,
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
        ephemeral.intent = wit.intents.map((i: any) => i.name)[0] || "";
    }

    async process(session: IRobinSession): Promise<IRobinResult> {
        const context = Object.assign({}, session.context);
        const ephemeral: IEphemeralContext = {
            greetings: false,
            bye: false,
            thanks: false,
            sentiment: "neutral",
            intent: "",
        };

        const wit = await this.queryWit(session);
        wit.intents = wit.intents || [];
        wit.entities = wit.entities || {};
        wit.traits = wit.traits || {};

        Robin.processTraits(wit, ephemeral);
        Robin.processIntents(wit, ephemeral);

        return (new RobinLogic(wit, ephemeral, context, session)).transition();
    }
}
