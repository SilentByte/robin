/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as yaml from "yaml";

// language=yaml
const RAW_MESSAGES = yaml.parse(`

  voiceNotSupported:
    - I'm sorry, I can't understand voice messages at the moment. 😔
      My team and I are working on it! 🔨 😃

  messageTypeNotSupported:
    - Oh no, looks like I haven't received training for this message format yet. 😔

  personalGreeting:
    - Hey {{ name }}, how's it going?
    - Oh hi, {{ name }}, how can I help?

  genericGreeting:
    - Hi there! 😃

  doneJoking:
    - I think that's enough for now. I'm an accountant, not a comedian. 😉

  joke:
    - I can't imagine living without an accountant... It must be *accrual* life. 🌎 😂
    - I almost fell down the stairs the other day... I lost *my balance*. ☺️
    - Aww! 🤗 Thanks for your kind gift 🎁, I really *depreciate* it!

`);

type KeyValueMap = { [key: string]: string };

class MessageCollection {
    constructor(private messages: string[]) {
        //
    }

    get length() {
        return this.messages.length;
    }

    format(text: string, values: KeyValueMap) {
        return text.replace(/{{([a-zA-Z0-9\s]+)}}/g, (matched) => {
            return values[matched.replace(/[{}\s]/g, "")] || "";
        });
    }

    any(placeholders: KeyValueMap = {}) {
        return this.format(this.messages[Math.floor(Math.random() * this.messages.length)] || "", placeholders);
    }

    get(i: number, otherwise: string = "", placeholders: KeyValueMap = {}) {
        return this.format(this.messages[i] || otherwise, placeholders);
    }
}

export const ROBIN_MESSAGES: { [key: string]: MessageCollection } = {};

for(const [key, messages] of Object.entries(RAW_MESSAGES)) {
    ROBIN_MESSAGES[key] = new MessageCollection(messages as string[]);
}
