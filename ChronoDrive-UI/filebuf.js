"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
var protobufjs_1 = require("protobufjs");
var FileMessageType;
(function (FileMessageType) {
    FileMessageType[FileMessageType["ADD"] = 0] = "ADD";
    FileMessageType[FileMessageType["UPDATE"] = 1] = "UPDATE";
    FileMessageType[FileMessageType["DELETE"] = 2] = "DELETE";
    FileMessageType[FileMessageType["OTHER"] = 3] = "OTHER";
})(FileMessageType = exports.FileMessageType || (exports.FileMessageType = {}));
var FileMessage = /** @class */ (function (_super) {
    __extends(FileMessage, _super);
    function FileMessage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    __decorate([
        protobufjs_1.Field.d(1, "string"),
        __metadata("design:type", String)
    ], FileMessage.prototype, "user", void 0);
    __decorate([
        protobufjs_1.Field.d(2, "string"),
        __metadata("design:type", String)
    ], FileMessage.prototype, "filename", void 0);
    __decorate([
        protobufjs_1.Field.d(3, "string"),
        __metadata("design:type", String)
    ], FileMessage.prototype, "path", void 0);
    __decorate([
        protobufjs_1.Field.d(4, FileMessageType),
        __metadata("design:type", Number)
    ], FileMessage.prototype, "type", void 0);
    __decorate([
        protobufjs_1.Field.d(5, "int32"),
        __metadata("design:type", Number)
    ], FileMessage.prototype, "timestamp", void 0);
    __decorate([
        protobufjs_1.Field.d(6, "string", "optional"),
        __metadata("design:type", String)
    ], FileMessage.prototype, "data", void 0);
    FileMessage = __decorate([
        protobufjs_1.Type.d("FileMessage")
    ], FileMessage);
    return FileMessage;
}(protobufjs_1.Message));
exports.FileMessage = FileMessage;
//# sourceMappingURL=filebuf.js.map