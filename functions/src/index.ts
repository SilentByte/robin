/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as functions from "firebase-functions";
import axios from "axios";
import { DateTime } from "luxon";
import { Robin } from "./robin";

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
        console.error("Caller provided invalid authenticity token");
        response.status(403).end();
        return;
    }

    console.log("Caller is authorized");

    const userId = request.body?.message?.from?.id;
    const chatId = request.body?.message?.chat?.id;
    const timestamp = request.body?.message?.date;
    const name = request.body?.message?.from?.first_name || request.body?.message?.from?.username;
    const message = request.body?.message?.text;

    if(!userId || !chatId || !message || !timestamp) {
        console.warn("Received malformed message");
        console.warn(request.body);
        response.status(400).end();
        return;
    }

    console.log("Querying Robin...");
    const result = await robin.process({
        timestamp: DateTime.fromSeconds(timestamp), // TODO: Adjust timezone based on user location.
        message: message,
        context: {
            name,
        },
    });

    console.log("Sending Telegram response...");
    await sendTelegram(chatId, result.message);

    response.end();
});
