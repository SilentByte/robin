/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import axios from "axios";
import {
    DateTime,
    Settings as LuxonSettings,
} from "luxon";

import log from "./log";
import { convertAudioToMp3 } from "./convert";
import { ROBIN_MESSAGES } from "./messages";
import {
    defaultContext,
    IRobinContext,
    Robin,
} from "./robin";

const TELEGRAM_API_URL = "https://api.telegram.org";

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

    const fromISO = (iso: string) => data.lastMessageOn ? DateTime.fromISO(iso) : DateTime.fromSeconds(0);
    return {
        state: data.state,
        isActive: data.isActive,
        userName: data.userName,
        lastMessageOn: fromISO(data.lastMessageOn),
        messageCounter: data.messageCounter || 0,
        lastGreetingOn: fromISO(data.lastGreetingOn),
        jokeCounter: data.jokeCounter || 0,
        lastJokeOn: fromISO(data.lastJokeOn),
        currentExpenseItem: data.currentExpenseItem,
        currentExpenseValue: data.currentExpenseValue,
        currentExpenseIncurredOn: data.currentExpenseIncurredOn,
    };
}

async function updateContext(id: string, context: IRobinContext) {
    log.info(`Updating context for ${id}`);

    const serializedContext: any = Object.assign({}, context);
    Object.entries(context).forEach(([k, v]) => {
        if(v instanceof DateTime) {
            serializedContext[k] = v.toISO();
        }
    });

    await db.collection("users").doc(id).set(serializedContext, {
        merge: true,
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
    });

    await Promise.all([
        updateContext(docId, result.context),
        (async () => {
            log.info("Sending Telegram response...");
            for(const m of result.messages) {
                await sendTelegram(message.chat.id, m);
            }
        })(),
    ]);
}

// noinspection JSUnusedGlobalSymbols
export const robinTelegram = functions.https.onRequest(async (request, response) => {
    try {
        await handleTelegram(request);
    } catch(e) {
        log.error("Unhandled exception");
        log.error(e);
    } finally {
        response.end();
    }
});

