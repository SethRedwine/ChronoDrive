
import { ProtoBuf } from 'protobufjs';

let FileSync = ProtoBuf.newBuilder().import({
    "package": "FileSync",
    "messages": [
        {
            "name": "FileMessage",
            "fields": [
                {
                    "rule": "required",
                    "type": "string",
                    "name": "name",
                    "id": 1,
                    "options": {}
                },
                {
                    "rule": "required",
                    "type": "string",
                    "name": "path",
                    "id": 2,
                    "options": {}
                },
                {
                    "rule": "required",
                    "type": "FileMessageType",
                    "name": "type",
                    "id": 3,
                    "options": {
                        "default": "UPDATE"
                    }
                },
                {
                    "rule": "optional",
                    "type": "boolean",
                    "name": "isDirecory",
                    "id": 4,
                    "options": {}
                },
                {
                    "rule": "optional",
                    "type": "string",
                    "name": "data",
                    "id": 4,
                    "options": {}
                },
                {
                    "rule": "required",
                    "type": "int32",
                    "name": "timestamp",
                    "id": 5,
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
}).build("SyncDemo")

export { FileSync };