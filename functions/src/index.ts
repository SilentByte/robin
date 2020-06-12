/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as functions from "firebase-functions";

export const test = functions.https.onRequest((request, response) => {
    response.send("Test");
});
