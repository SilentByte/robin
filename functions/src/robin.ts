/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import axios from "axios";
import { DateTime } from "luxon";

export interface IRobinContext {
    name?: string;
}

export interface IRobinSession {
    message: string;
    timestamp: DateTime;
    context: IRobinContext;
}

export interface IRobinResult {
    context: IRobinContext;
    message: string;
}

export class Robin {
    private readonly url = "https://api.wit.ai/message";
    private readonly version = "20200612";
    private readonly token: string;

    constructor(options: { token: string }) {
        this.token = options.token;
    }

    private async sendMessage(message: string, timestamp: DateTime): Promise<any> {
        const response = await axios.get(this.url, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
            params: {
                v: this.version,
                q: message,
                context: JSON.stringify({
                    reference_time: timestamp.toISO(),
                }),
            },
        });

        console.log(response.data)
        return response.data;
    }

    async process(session: IRobinSession): Promise<IRobinResult> {
        const response = await this.sendMessage(session.message, session.timestamp);
        return {
            context: session.context,
            message: JSON.stringify(response),
        };
    }
}

