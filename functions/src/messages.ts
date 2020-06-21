/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as yaml from "yaml";

// language=yaml
const RAW_MESSAGES = yaml.parse(`

  messageTypeNotSupported:
    - Oh no, looks like I haven't received training for this message format yet. 😔

  accountIsInactive:
    - I'm sorry, this account is currently pending deletion. Once all your data has been
      removed, we can have a new start if you'd like. 😃

  deleteAccountConfirmation:
    - If I understood you correctly, you would like me to delete your account and all data associated with it.
      Is this correct? Once your account has been flagged for deletion it can no longer be used until the process
      has been completed. All your data will be deleted and this process can not be undone. Would you like me to
      delete your account?

  accountDeletionConfirmed:
    - Oh! I'm sorry to see you go. 😔 Alright then, I'll make sure your data is promptly deleted.
      Thanks for talking to me! Maybe we'll meet again some day?

  accountDeletionCanceled:
    - Alrighty! Thank's for staying! 😃

  confused:
    - Hmm... 🤔 I'm sorry, I didn't quite get that...

  personalGreeting:
    - Hey {{ name }}, how's it going?
    - Oh hi, {{ name }}, how can I help?

  genericGreeting:
    - Hi there! 😃

  introduction:
    - My name is Robin, I'm your friendly accountant artificial intelligence.
    - I'm Robin! Always eager to help.

  bot:
    - I am an artificial intelligence with a user interfaced based on natural language processing. 😃
    - I am not a human, but... I'm still friendly!
    - I am an accountant first, and an artificial intelligence second! 😃

  hi:
    - Hi! 👋😃
    - Hey, how's it going? 😃
    - Hello, Bonjour, 你好! 😃

  bye:
    - See you soon, {{ name }}! 👋😃
    - Bye! 👋😃
    - Until next time, cheers! 👋😃

  welcome:
    - I'm Robin ♀️, your friendly accountant! I'll be assisting you in keeping to your personal or business budget,
      track your expenses, and try to answer any questions you may have! 😃 Also, people say I'm quite funny --
      let me know if you want to hear a joke. 😉

  think:
    - Alright 🤔, let's see...
    - Hmm...
    - Okay, so...

  doneJoking:
    - I think that's enough for now. I'm an accountant, not a comedian. 😉

  joke:
    - I can't imagine living without an accountant... It must be *accrual* life. 🌎 😂
    - I almost fell down the stairs the other day... I lost *my balance*. ☺️
    - Aww! 🤗 Thanks for your kind gift 🎁, I really *depreciate* it!

  addExpense:
    - Alright, I'm going to add a new expense.

  specifyExpenseItem:
    - What would you like to add?

  specifyExpenseMoment:
    - When was that expense incurred?

  specifyExpenseValue:
    - What was the amount you paid for this expense?

  expenseCompleted:
    - Sweet! I just added '{{item}}' for {{value}} on {{moment}} to your expenses. 😉

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
