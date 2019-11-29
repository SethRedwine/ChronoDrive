
import * as ProtoBuf from './Protobuf/protobuf.min.js';

let FileSync = ProtoBuf.newBuilder().import({
    "package": "FileSync",
    "messages": [
        {
            "name": "FileMessage",
            "fields": [
                {
                    "rule": "required",
                    "type": "string",
                    "name": "user",
                    "id": 1,
                    "options": {}
                },
                {
                    "rule": "required",
                    "type": "string",
                    "name": "filename",
                    "id": 2,
                    "options": {}
                },
                {
                    "rule": "required",
                    "type": "string",
                    "name": "path",
                    "id": 3,
                    "options": {}
                },
                {
                    "rule": "required",
                    "type": "FileMessageType",
                    "name": "type",
                    "id": 4,
                    "options": {
                        "default": "UPDATE"
                    }
                },
                {
                    "rule": "required",
                    "type": "int32",
                    "name": "timestamp",
                    "id": 5,
                    "options": {}
                },
                {
                    "rule": "optional",
                    "type": "string",
                    "name": "data",
                    "id": 6,
                    "options": {}
                }
            ],
            "enums": [
                {
                    "name": "FileMessageType",
                    "values": [
                        {
                            "name": "ADD",
                            "id": 0
                        },
                        {
                            "name": "UPDATE",
                            "id": 1
                        },
                        {
                            "name": "DELETE",
                            "id": 2
                        },
                        {
                            "name": "OTHER",
                            "id": 3
                        }
                    ],
                    "options": {}
                }
            ],
            "messages": [],
            "options": {}
        }
    ],
    "enums": [],
    "imports": [],
    "options": {}
}).build("FileSync")

interface FileMessage {
    user: string;
    filename: string;
    path: string;
    type: string;
    timestamp: number;
    data?: string;
    toArrayBuffer(): Iterable<number>;
}

export { FileSync, FileMessage };