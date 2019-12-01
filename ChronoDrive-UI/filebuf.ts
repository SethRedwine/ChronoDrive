// TODO: Apparently this won't work with protobufjs 5.0.3, which is what ndn-js needs
// Need to fork ndn-js and update to use current protobufjs

// import { Message, Type, Field } from "protobufjs";

// export enum FileMessageType {
//     ADD = 0,
//     UPDATE = 1,
//     DELETE = 2,
//     OTHER = 3,
// }

// @Type.d("FileMessage")
// export class FileMessage extends Message<FileMessage> {

//     @Field.d(1, "string")
//     public user: string;

//     @Field.d(2, "string")
//     public filename: string;

//     @Field.d(3, "string")
//     public path: string;

//     @Field.d(4, FileMessageType)
//     public type: FileMessageType;

//     @Field.d(5, "int32")
//     public timestamp: number;

//     @Field.d(6, "string", "optional")
//     public data: string;
// }