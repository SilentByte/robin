/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import axios from "axios";
import {
    DateTime,
    Interval,
    Settings as LuxonSettings,
} from "luxon";

import log from "./log";
import { convertAudioToMp3 } from "./convert";
import { ROBIN_MESSAGES } from "./messages";
import {
    defaultContext,
    IRobinContext,
    IRobinExpense,
    Robin,
} from "./robin";

LuxonSettings.defaultLocale = "en";

admin.initializeApp();

const db = admin.firestore();
db.settings({
    ignoreUndefinedProperties: true,
});

const config = functions.config();
const robin = new Robin({
    token: config.wit.access_token,
});

const TELEGRAM_API_URL = "https://api.telegram.org";
const MESSENGER_API_URL = `https://graph.facebook.com/v7.0/me/messages?access_token=${config.messenger.access_token}`;

async function sendTelegram(chatId: string, message: string): Promise<void> {
    try {
        await axios.post(`${TELEGRAM_API_URL}/bot${config.telegram.access_token}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: "HTML",
        });
    } catch(e) {
        log.error(e);
        throw e;
    }
}

async function sendMessenger(recipientId: string, message: string): Promise<void> {
    try {
        await axios.post(MESSENGER_API_URL, {
            recipient: {
                "id": recipientId,
            },
            message: {
                "text": message,
            },
        });
    } catch(e) {
        log.error(e);
        throw e;
    }
}

async function fetchTelegramFile(fileId: string): Promise<ArrayBuffer> {
    try {
        const file = (await axios.get(`${TELEGRAM_API_URL}/bot${config.telegram.access_token}/getFile`, {
            params: {
                file_id: fileId,
            },
        })).data;

        return (
            await axios.get(`${TELEGRAM_API_URL}/file/bot${config.telegram.access_token}/${file.result.file_path}`, {
                responseType: "arraybuffer",
            })
        ).data;
    } catch(e) {
        log.error(e);
        throw e;
    }
}

async function fetchMessengerFile(url: string): Promise<ArrayBuffer> {
    try {
        return (
            await axios.get(url, {
                responseType: "arraybuffer",
            })
        ).data;
    } catch(e) {
        log.error(e);
        throw e;
    }
}

async function fetchContext(id: string): Promise<IRobinContext> {
    log.info(`Fetching context for ${id}`);
    const doc = await db
        .collection("users")
        .doc(id)
        .get();

    const data = doc.data();
    if(!data) {
        log.info(`Setting up new context for ${id}`);
        return defaultContext();
    }

    return {
        state: data.state,
        isActive: data.isActive,
        userName: data.userName,
        lastMessageOn: DateTime.fromSeconds(data.lastMessageOn || 0),
        messageCounter: data.messageCounter || 0,
        lastGreetingOn: DateTime.fromSeconds(data.lastGreetingOn || 0),
        jokeCounter: data.jokeCounter || 0,
        lastJokeOn: DateTime.fromSeconds(data.lastJokeOn || 0),
        budget: data.budget || 0,
        currentExpenseItem: data.currentExpenseItem,
        currentExpenseValue: data.currentExpenseValue,
        currentExpenseIncurredOn: DateTime.fromSeconds(data.currentExpenseIncurredOn || 0),
    };
}

async function updateContext(id: string, context: IRobinContext) {
    log.info(`Updating context for ${id}`);

    const serializedContext: any = Object.assign({}, context);
    Object.entries(context).forEach(([k, v]) => {
        if(v instanceof DateTime) {
            serializedContext[k] = v.toUTC().toSeconds();
        }
    });

    await db.collection("users").doc(id).set(serializedContext, {
        merge: true,
    });
}

async function queryExpenses(docId: string, interval: Interval): Promise<IRobinExpense[]> {
    const snap = await db
        .collection("users")
        .doc(docId)
        .collection("expenses")
        .where("incurredOn", ">=", interval.start.toSeconds())
        .where("incurredOn", "<=", interval.end.toSeconds())
        .orderBy("incurredOn")
        .get();

    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            item: data.item,
            value: data.value,
            incurredOn: DateTime.fromSeconds(data.incurredOn),
        };
    });
}

async function handleTelegram(request: functions.Request) {
    if(request.query.token !== config.telegram.authenticity_token) {
        log.error("Caller provided invalid Telegram authenticity token");
        return;
    }

    log.info("Received Telegram message:");
    log.info(request.body);

    const message = request.body.message;
    if(!message.text && !message.voice) {
        log.warn("Message type is not supported");
        await sendTelegram(message.chat.id, ROBIN_MESSAGES.messageTypeNotSupported.any());
        return;
    }

    const docId = `telegram:${message.from.id}`;
    const context = await fetchContext(docId);

    if(!context.isActive) {
        log.warn("Accessing inactive user");
        await sendTelegram(message.chat.id, ROBIN_MESSAGES.accountIsInactive.any());
        return;
    }

    const result = await robin.process({
        timestamp: DateTime.fromSeconds(message.date), // TODO: Adjust timezone based on user location.
        text: message.text,
        voice: message.voice && await convertAudioToMp3(await fetchTelegramFile(message.voice.file_id)),
        context: {
            ...context,
            userName: message.from.first_name || message.from.username,
        },
        queryExpenses: (interval: Interval) => queryExpenses(docId, interval),
    });

    const actions: Promise<any>[] = result.actions.map(a => {
        if(a.type === "add_expense") {
            return db.collection("users").doc(docId).collection("expenses").add({
                item: a.item,
                value: a.value,
                incurredOn: a.incurredOn.toSeconds(),
            });
        }

        return Promise.resolve();
    });

    await Promise.all([
        updateContext(docId, result.context),
        ...actions,
        (async () => {
            log.info("Sending Telegram response...");
            for(const m of result.messages) {
                await sendTelegram(message.chat.id, m);
            }
        })(),
    ]);
}

async function handleMessengerChallenge(request: functions.Request, response: functions.Response) {
    const mode = request.query["hub.mode"];
    const token = request.query["hub.verify_token"];
    const challenge = request.query["hub.challenge"];

    if(mode && token) {
        if(mode === "subscribe" && token === config.messenger.authenticity_token) {
            response.status(200).send(challenge);
        } else {
            response.status(403).end();
        }
    } else {
        response.status(400).end();
    }
}

async function handleMessengerSingle(event: any) {
    log.info("Received Messenger message:");
    log.info(event);

    if(!event.message.text && event.message?.attachments[0]?.type !== "audio") {
        log.warn("Message type is not supported");
        await sendMessenger(event.sender.id, ROBIN_MESSAGES.messageTypeNotSupported.any());
        return;
    }

    const docId = `messenger:${event.sender.id}`;
    const context = await fetchContext(docId);

    if(!context.isActive) {
        log.warn("Accessing inactive user");
        await sendMessenger(event.sender.id, ROBIN_MESSAGES.accountIsInactive.any());
        return;
    }

    const result = await robin.process({
        timestamp: DateTime.fromSeconds(event.timestamp), // TODO: Adjust timezone based on user location.
        text: event.message.text,
        voice: event.message?.attachments && event.message.attachments[0]?.type === "audio"
            ? await convertAudioToMp3(await fetchMessengerFile(event.message.attachments[0].payload.url))
            : undefined,
        context: {
            ...context,
            userName: "friend",
        },
        queryExpenses: (interval: Interval) => queryExpenses(docId, interval),
    });

    const actions: Promise<any>[] = result.actions.map(a => {
        if(a.type === "add_expense") {
            return db.collection("users").doc(docId).collection("expenses").add({
                item: a.item,
                value: a.value,
                incurredOn: a.incurredOn.toSeconds(),
            });
        }

        return Promise.resolve();
    });

    await Promise.all([
        updateContext(docId, result.context),
        ...actions,
        (async () => {
            log.info("Sending Messenger response...");
            for(const m of result.messages) {
                await sendMessenger(event.sender.id, m);
            }
        })(),
    ]);
}

async function handleMessenger(request: functions.Request, response: functions.Response) {
    const body = request.body;
    if(body.object === "page") {
        log.info("Received Messenger page event");
        await Promise.all([
            ...body.entry.map((entry: any) => handleMessengerSingle(entry.messaging[0])),
        ]);

        response.status(200).send("EVENT_RECEIVED");
    } else {
        response.status(400).end();
    }
}

// noinspection JSUnusedGlobalSymbols
export const robinTelegram = functions.https.onRequest(async (request, response) => {
    try {
        await handleTelegram(request);
    } finally {
        response.end();
    }
});

// noinspection JSUnusedGlobalSymbols
export const robinMessenger = functions.https.onRequest(async (request, response) => {
    try {
        if(request.method === "GET") {
            await handleMessengerChallenge(request, response);
        } else if(request.method === "POST") {
            await handleMessenger(request, response);
        } else {
            response.end();
        }
    } catch(e) {
        log.error(e);
        response.end();
    }
});

// noinspection JSUnusedGlobalSymbols
export const deleteUser = functions.firestore
    .document("users/{id}")
    .onUpdate(async (change, _context) => {
        if(change.after.data().isActive === false) {
            const id = change.after.id;

            log.info(`Deleting user ${id}`);

            const batch = db.batch();
            (await db.collection("users").doc(id).collection("expenses").get())
                .forEach(snap => batch.delete(snap.ref));

            batch.delete(db.collection("users").doc(id));
            await batch.commit();
        }
    });
