/*
 * Robin Accountant
 * Copyright (c) 2020 by SilentByte <https://www.silentbyte.com/>
 */

import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as ffmpeg from "fluent-ffmpeg";
import { v4 as uuid4 } from "uuid";

function writeData(filename: string, data: ArrayBuffer): Promise<void> {
    return new Promise(function(resolve, reject) {
        fs.writeFile(filename, data, error => {
            if(error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

function readData(filename: string): Promise<ArrayBuffer> {
    return new Promise(function(resolve, reject) {
        fs.readFile(filename, (error, data) => {
            if(error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
}

export async function convertAudioToMp3(data: ArrayBuffer): Promise<ArrayBuffer> {
    const tmpInputFileName = path.join(os.tmpdir(), uuid4());
    const tmpOutputFileName = path.join(os.tmpdir(), uuid4());

    try {
        console.log(`Starting audio conversion for ${tmpInputFileName}...`);
        await writeData(tmpInputFileName, data);
        await new Promise((resolve, reject) => {
            ffmpeg(tmpInputFileName)
                .noVideo()
                .toFormat("mp3")
                .on("error", err => reject(err))
                .on("end", () => resolve())
                .save(tmpOutputFileName);
        });

        console.log(`Audio conversion for ${tmpInputFileName} completed`);
        return await readData(tmpOutputFileName);
    } finally {
        fs.unlink(tmpInputFileName, () => null);
        fs.unlink(tmpOutputFileName, () => null);
    }
}
