/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as yaml from "yaml";

// language=yaml
const RAW_MESSAGES = yaml.parse(`

  messageTypeNotSupported:
    - Oh no, looks like I haven't received training for this message format yet. 😔
    - I'm sorry, I'm not yet experienced enough with this message format. 😔

  accountIsInactive:
    - I'm sorry, this account is currently pending deletion. Once all your data has been
      removed, we can have a new start if you'd like. 😃

    - This account is currently being deleted. Once this process is complete, we can talk
      again if you'd like (although I will have forgotten you). 😃

  deleteAccountConfirmation:
    - If I understood you correctly, you would like me to delete your account and all data associated with it.
      Once your account has been flagged for deletion it can no longer be used until the process has been completed.
      All your data will be deleted and this process can not be undone. Would you like me to delete your account?

  accountDeletionConfirmed:
    - Oh! I'm sorry to see you go. 😔 Alright then, I'll make sure your data is promptly deleted.
      Thanks for talking to me! Maybe we'll meet again some day?

  accountDeletionCanceled:
    - Alrighty! Thank's for staying! 😃
    - Great! I was worried there for a second! 😃

  help:
    - |
      Here are some of the things I can do:

      - Set your budget, e.g. "I want to set my weekly budget to 600 dollars".

      - Find out how much of your budget is used up, e.g. "What is left in my budget?".

      - Track expenses, e.g. "I bought food today for 30 dollars".

      - Ask me about incurred expenses, e.g. "What did I spend from Monday to Thursday?".

      - Check future expenses, e.g. "Can I afford to spend 60 dollars on fuel?".

      - Delete your account and data, e.g. "Delete my account".

      - I also know some jokes, let me know if you want to hear one. 😉

  confused:
    - Hmm... 🤔 I'm sorry, I didn't quite get that...
    - I think I misunderstood you... 🤔

  personalGreeting:
    - Hey {{ name }}, how's it going?
    - Oh hi, {{ name }}, how can I help?

  genericGreeting:
    - Hi there! 😃
    - Oh, hello! 😃

  introduction:
    - My name is Robin, I'm your friendly accountant artificial intelligence.
    - I'm Robin! Always eager to help.
    - I'm Robin! I'm here to assist you with your finances.

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

  thanks:
    - You're welcome!
    - No problem!
    - That's what I'm here for! 😃

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
    - I've told you all my jokes already. 😉

  joke:
    - I can't imagine living without an accountant... It must be *accrual* life. 😂
    - I almost fell down the stairs the other day... I lost *my balance*. ☺️
    - Aww! 🤗 Thanks for your kind gift 🎁, I really *depreciate* it!

  specifyBudget:
    - What would you like your weekly budget to be?
    - To what amount would you like to set your weekly budget?

  settingBudget:
    - I have set your budget to {{value}}.
    - I changed your budget to {{value}}.
    - Your budget is now {{value}}.

  queryBudget:
    - Your budget is currently set to {{value}} per week. This week's balance is at {{balance}}.
    - Your weekly budget of {{value}} is currently at {{balance}}.

  specifyAffordabilityValue:
    - Please tell me how much you intend to spend.
    - How much will that be?

  queryAffordability:
    - Assuming you spend {{value}}, your budget for the week would be at {{balance}}.
    - If you spend {{value}}, your weekly budget's balance would be at {{balance}}.

  addExpense:
    - Alright, I'm going to add a new expense.
    - Okay, adding a new expense.

  specifyExpenseItem:
    - What would you like to add?
    - What item would you like to track?

  specifyExpenseMoment:
    - When was that expense incurred?
    - When did you buy this?

  specifyExpenseValue:
    - What was the amount you paid for this expense?
    - How much did you pay for this?
    - What did that cost?

  expenseCompleted:
    - Sweet! I just added '{{item}}' for {{value}} on {{moment}} to your expenses. 😉
    - I'm now tracking '{{item}}' bought on {{moment}} for {{value}}.
    - I'll remember that you paid {{value}} for '{{item}}' on {{moment}}.

  expenseSummary:
    - 'I have recorded the following expenses from {{start}} to {{end}}:'
    - "Between {{start}} and {{end}}, I'm tracking the following expenses:"

  expenseTotal:
    - This amounts to a total of {{value}}.
    - This is a total {{value}}.
    - All this sums up to {{value}}.

  noExpenses:
    - You do not have incurred any expenses from {{start}} to {{end}}.
    - I have not tracked any expenses between {{start}} and {{end}}.

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
