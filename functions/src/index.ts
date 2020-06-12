/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as functions from "firebase-functions";
import axios from "axios";
import { DateTime } from "luxon";
import { Robin, ROBIN_MESSAGES } from "./robin";

const config = functions.config();
const robin = new Robin({
    token: config.wit.access_token,
});

async function sendTelegram(chatId: string, message: string): Promise<string> {
    return await axios.post(`https://api.telegram.org/bot${config.telegram.access_token}/sendMessage`, {
        chat_id: chatId,
        text: message,
    });
}

export const robinTelegram = functions.https.onRequest(async (request, response) => {
    if(request.query.token !== config.telegram.authenticity_token) {
        console.error("Caller provided invalid Telegram authenticity token");
        response.status(403).end();
        return;
    }

    console.log("Received Telegram message:");
    console.log(request.body);

    const message = request.body.message;
    if(message.voice) {
        console.warn("Declining voice message");
        await sendTelegram(message.chat.id, ROBIN_MESSAGES.voiceNotSupported);
        response.end();
        return;
    } else if(!message.text) {
        console.warn("Message type is not supported");
        await sendTelegram(message.chat.id, ROBIN_MESSAGES.messageTypeNotSupported);
        response.end();
        return;
    }

    console.log("Querying Robin...");
    const result = await robin.process({
        timestamp: DateTime.fromSeconds(message.date), // TODO: Adjust timezone based on user location.
        message: message.text,
        context: {
            name: message.from.first_name || message.from.username,
        },
    });

    console.log("Sending Telegram response...");
    await sendTelegram(message.chat.id, result.message);

    response.end();
});
