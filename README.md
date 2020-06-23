
![Selfie2Anime](robin.png)

[![Robin](https://img.shields.io/badge/bot-robin-5936ac.svg?style=for-the-badge)](https://robin.silentbyte.com)&nbsp;
[![Version](https://img.shields.io/badge/version-1.0-05A5CC.svg?style=for-the-badge)](https://robin.silentbyte.com)&nbsp;
[![Status](https://img.shields.io/badge/status-live-00B20E.svg?style=for-the-badge)](https://robin.silentbyte.com)


# Robin

Robin is a new AI experience powered by [Wit.ai](https://wit.ai/). This repository represents our submission for the [Devpost/Facebook Artificial Intelligence Hackathon](https://fbai2.devpost.com/).

This project is live at https://robin.silentbyte.com/.


## Inspiration

Budgeting and personal finance is a challenge for many people, and a large percentage of the population lives paycheck-to-paycheck, having little to no savings. Extreme circumstances like the current Covid-19 pandemic affect the most vulnerable people the most.

We have decided to leverage the power of Wit.ai to build an easy-to-use chat bot that assists people with budgeting and tracking expenses in an effort to empower people to stay on top of their finances and to put some fun into personal finance. Wit.ai supports a direct and natural way to interact with technology through language, making book-keeping easy and accessible.


## What it does
Robin allows users to quickly set up a budget and keep track of expenses. Users can add expenses whenever they occur just by pulling out their phones and leaving a text or quick voice message. Robin is then able to do calculations on these expenses and tell the users how much of their weekly budget is left, when expenses have been incurred, what expenses have been incurred over what period of time, and so on.


## How we built it
Robin lives inside of a TypeScript Cloud Function and is hosted on Firebase. Incoming messages from Messenger and Telegram get forwarded to Robin for processing. Messages are analyzed based on the current state of the conversation (backed by a database and a state machine) and are then forwarded to Wit.ai, which returns a list of intents, entities, and traits (we have also implemented support for voice message and audio conversion). We then process those intents, entities, and traits, and match them against the current state of the conversation. Robin then produces a list of reply messages to be send back to the user and a list of actions to be carried out, along with the new state of the conversation that is then persisted in the database and loaded again once the next message for the particular user arrives.


## Challenges we ran into
As mentioned above, the implementation of a chat bot's logic can become very complex very quickly. The major challenge we faced was dealing with that complexity in a way that allows more functionality to be added without increasing complexity exponentially. Another challenge we faced goes hand-in-hand: debugging complex, interwoven state can be difficult and time-consuming. Extensive logging and tracing really helped a lot here and is something to remember for the next project. Finally, we had to come up with a custom solution to support voice messages because Wit.ai does not natively support the voice message formats of Telegram/Messenger.


## Accomplishments that we're proud of
We were able to set up an MVP of a chat bot that implements the functionality discussed above. The system works well supports both Messenger and Telegram, and can be extended to other chat clients trivially. We were also able to get voice support running through a custom audio convert solution.


## What we learned
Sometimes things that seem simple on the surface turn out to be much more difficult when observed in detail. The first few Wit.ai intents were quickly implemented (e.g. tell_joke and greeting), but the more complicated ones such as add_expense quickly lead to a state explosion that required us to change our approach from a direct implementation of the logic to an indirect solution through a state machine. We also learned that it is a good idea to keep things more generic from the start in order to be able to support multiple back-ends (Messenger/Telegram) without excessive refactoring sessions.


## What's next for Robin
Currently, Robin is in MVP-status and the functionality needs to be refined a little more. A feature we'd particularly like to implement is support for sending pictures of receipts that will then be tracked by Robin. This would allow users to keep track of important expenses and come in handy for tax time.


---


## Build Instructions

1) Install [NodeJS](https://nodejs.org/) and [Firebase/CLI](https://firebase.google.com/) according to their official instructions.

2) Set up your [Wit.ai](https://wit.ai/) and create [Telegram](https://core.telegram.org/bots) and [Messenger](https://developers.facebook.com/docs/messenger-platform/) bots to get your access keys.

3) Navigate into `/functions` and run `npm install`.

4) Create a Firebase project and add it to this repository.

5) Set up a configuration entry within Firebase for each of the following variables:
    * messenger.access_token
    * messenger.authenticity_token
    * telegram.access_token
    * telegram.authenticity_token
    * wit.access_token

    The Firebase command is `firebase functions:config:set messenger.access_token='YOUR_TOKEN`.

    The `access_token` variables are the API tokens given to you by Wit.ai, Messenger, and Telegram. The `athenticity_token` is a token you generate yourself and add to Telegram/Messenger which allows you to ensure that incoming messages are authentic.

6) Deploy the project onto Firebase by running `firebase deploy`.


## License

MIT, see [LICENSE.txt](LICENSE.txt).

