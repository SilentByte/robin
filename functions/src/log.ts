/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

const LOG_LEVELS = {
    "debug": 0,
    "info": 1,
    "warn": 2,
    "error": 3,
};

class Logger {
    constructor(private level: keyof typeof LOG_LEVELS) {
        //
    }

    debug(object: any): void {
        if(LOG_LEVELS[this.level] <= LOG_LEVELS.debug) {
            console.debug(JSON.stringify(object));
        }
    }

    info(object: any): void {
        if(LOG_LEVELS[this.level] <= LOG_LEVELS.info) {
            console.info(JSON.stringify(object));
        }
    }

    warn(object: any): void {
        if(LOG_LEVELS[this.level] <= LOG_LEVELS.warn) {
            console.warn(JSON.stringify(object));
        }
    }

    error(object: any): void {
        if(LOG_LEVELS[this.level] <= LOG_LEVELS.error) {
            console.error(JSON.stringify(object));
        }
    }
}

export default new Logger("info");
