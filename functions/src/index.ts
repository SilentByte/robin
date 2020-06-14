/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

import axios from "axios";
import { DateTime } from "luxon";
import { IRobinContext, Robin } from "./robin";
import { ROBIN_MESSAGES } from "./messages";

admin.initializeApp();

const db = admin.firestore();
const config = functions.config();
const robin = new Robin({
    token: config.wit.access_token,
    log: true,
});

async function sendTelegram(chatId: string, message: string): Promise<void> {
    try {
        await axios.post(`https://api.telegram.org/bot${config.telegram.access_token}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: "HTML",
        });
    } catch(e) {
        console.error(e);
        throw e;
    }
}

function defaultContext(): IRobinContext {
    return {
        userName: "anonymous",
        lastMessageOn: DateTime.local(),
        messageCounter: 0,
        lastGreetingOn: DateTime.fromSeconds(0),
        jokeCounter: 0,
        lastJokeOn: DateTime.fromSeconds(0),
    };
}

async function fetchContext(id: string): Promise<IRobinContext> {
    console.log(`Fetching context for ${id}`);
    const doc = await db
        .collection("users")
        .doc(id)
        .get();

    const data = doc.data();
    if(!data) {
        console.log(`Setting up new context for ${id}`);
        return defaultContext();
    }

    const fromISO = (iso: string) => data.lastMessageOn ? DateTime.fromISO(iso) : DateTime.fromSeconds(0);
    return {
        userName: data.userName,
        lastMessageOn: fromISO(data.lastMessageOn),
        messageCounter: data.messageCounter || 0,
        lastGreetingOn: fromISO(data.lastGreetingOn),
        jokeCounter: data.jokeCounter || 0,
        lastJokeOn: fromISO(data.lastJokeOn),
    };
}

async function updateContext(id: string, context: IRobinContext) {
    console.log(`Updating context for ${id}`);

    const serializedContext: any = Object.assign({}, context);
    Object.entries(context).forEach(([k, v]) => {
        if(v instanceof DateTime) {
            serializedContext[k] = v.toISO();
        }
    });

    await db.collection("users").doc(id).set(serializedContext);
}

async function handleTelegram(request: functions.Request) {
    if(request.query.token !== config.telegram.authenticity_token) {
        console.error("Caller provided invalid Telegram authenticity token");
        return;
    }

    console.log("Received Telegram message:");
    console.log(request.body);

    const message = request.body.message;
    if(message.voice) {
        console.warn("Declining voice message");
        await sendTelegram(message.chat.id, ROBIN_MESSAGES.voiceNotSupported.any());
        return;
    } else if(!message.text) {
        console.warn("Message type is not supported");
        await sendTelegram(message.chat.id, ROBIN_MESSAGES.messageTypeNotSupported.any());
        return;
    }

    const docId = `telegram:${message.from.id}`;
    const result = await robin.process({
        timestamp: DateTime.fromSeconds(message.date), // TODO: Adjust timezone based on user location.
        text: message.text,
        context: {
            ...await fetchContext(docId),
            userName: message.from.first_name || message.from.username,
        },
    });

    await Promise.all([
        updateContext(docId, result.context),
        (async () => {
            console.log("Sending Telegram response...");
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
        console.error("Unhandled exception");
        console.error(e);
    } finally {
        response.end();
    }
});
