"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ndn_js_1 = require("ndn-js");
var main_1 = require("./main");
var ProtoBuf = require("protobufjs");
var fileProto = "\n\tsyntax = \"proto3\";\n\n\tpackage com.fileMessage;\n\n\tenum FileMessageType {\n\t\toption allow_alias = true;\n\t\tADD = 0;\n \t\tUPDATE = 1;\n  \t\tDELETE = 2;\n  \t\tOTHER = 3;\n\t}\n\n\tmessage FileMessage {\n\t\tstring user = 1;\n\t\tstring filename = 2;\n\t\tstring path = 3;\n \t\tFileMessageType type = 4;\n\t\tint32 timestamp = 5;\n \t\tstring data = 6;\n\t}\n";
var fileMessageBuilder = ProtoBuf.protoFromString(fileProto);
// console.log('Protobuf: ', ProtoBuf);
// console.log('File Message Builder: ', fileMessageBuilder);
var HUB_PREFIX = "ndn/edu/unomaha/adhoc/pi";
exports.HUB_PREFIX = HUB_PREFIX;
var ChronoDriveSync = function (userName, fileInfo, userDirChecksum, hubPrefix, face, keyChain, certificateName, roster) {
    this.userName = userName;
    this.userDirChecksum = userDirChecksum;
    this.isRecoverySyncState = true;
    this.sync_lifetime = 15000.0;
    this.face = face;
    this.keyChain = keyChain;
    this.certificateName = certificateName;
    // TODO: rename prefix - we're filing, not chatting
    this.chat_prefix = (new ndn_js_1.Name(hubPrefix)).append(this.userName); //.append(this.getRandomString());
    // QUESTION: Do we continue to use this roster? this will make it possible to keep stored users' directories updated without relying on 
    // a login but will mean we'll need to initialize the sync before a login
    this.roster = roster;
    // NOTE: if file cache is a map addressable by file name, we can just update the 
    // file entry each time the file is changed with 
    // QUESTION: How do we ensure that files that aren't created on one system, and therefore wouldn't have interests are created?
    // Maybe we'll need a hierarchical structure instead of a map - again, maybe it WILL need to be the root FileElement
    // QUESTION: Should we keep historical states for files? it seems
    // like this approach would be very data intensive unless we did it with 
    // some sort of diffs
    // Could just keep a shorter list of updates
    // this.msgcache = [];
    this.fileInfo = fileInfo;
    //console.log("The local chat prefix " + this.chat_prefix.toUri() + " ***");
    // NOTE: Session is a timestamp
    // QUESTION: What is it good for if we have the last modified for each individual file
    var session = (new Date()).getTime();
    this.FileMessage = fileMessageBuilder.build('com.fileMessage');
    // console.log(this.screen_name + ", welcome to chatroom " + this.chatroom + "!");
    this.sync = new ndn_js_1.ChronoSync2013(this.sendInterest.bind(this), this.initial.bind(this), this.chat_prefix, (new ndn_js_1.Name("/ndn/broadcast/ChronoDrive-0.1")).append(this.userName), session, face, keyChain, certificateName, this.sync_lifetime, this.onRegisterFailed.bind(this));
    face.registerPrefix(this.chat_prefix, this.onInterest.bind(this), this.onRegisterFailed.bind(this));
};
exports.ChronoDriveSync = ChronoDriveSync;
/**
 * Send the data packet which contains the user's message
 * @param {Name} Interest name prefix
 * @param {Interest} The interest
 * @param {Face} The face
 * @param {number} interestFilterId
 * @param {InterestFilter} filter
 */
ChronoDriveSync.prototype.onInterest = function (prefix, interest, face, interestFilterId, filter) {
    // TODO: Figure out how to add checksum to incoming interest
    // TODO: Actually, here we should iterate through the fileInfo/grab the right file, then check the checksum and the timestamp and update if it's older
    // QUESTION: How do we ensure that files that aren't created on one system, and therefore wouldn't have interests are created?
    // Maybe we'll need a hierarchical structure instead of a map - again, maybe it WILL need to be the root FileElement
    var content = null;
    // chat_prefix should really be saved as a name, not a URI string.
    console.log('onInterest interest: ', interest);
    var chatPrefixSize = new ndn_js_1.Name(this.chat_prefix).size();
    var interestTimestamp = parseInt(interest.getName().get(chatPrefixSize + 1).toEscapedString());
    var lastLocalUpdate = main_1.getLastUpdateMs(this.fileInfo);
    if (lastLocalUpdate > interestTimestamp) {
        content = {
            user: this.userName,
            filename: this.fileInfo.entry.name,
            path: this.fileInfo.path,
            type: 'UPDATE',
            timestamp: lastLocalUpdate,
            data: JSON.stringify(this.fileInfo)
        };
    }
    if (content) {
        var str = new Uint8Array(this.FileMessage.encode(content));
        console.log('Data: ' + interest.getName);
        var co = new ndn_js_1.Data(interest.getName());
        co.setContent(str);
        this.keyChain.sign(co);
        try {
            face.putData(co);
        }
        catch (e) {
            console.log(e.toString());
        }
    }
};
ChronoDriveSync.prototype.onRegisterFailed = function (prefix) { };
ChronoDriveSync.prototype.initial = function () {
    var timeout = new ndn_js_1.Interest(new ndn_js_1.Name("/local/timeout"));
    timeout.setInterestLifetimeMilliseconds(60000);
    console.log('Interest: /local/timeout');
    this.face.expressInterest(timeout, this.dummyOnData, this.heartbeat.bind(this));
};
/**
 * This onData is passed as onData for timeout interest in initial, which means it
 * should not be called under any circumstances.
 */
ChronoDriveSync.prototype.dummyOnData = function (interest, co) {
    console.log("*** dummyOndata called, name: " + interest.getName().toUri() + " ***");
};
/**
 * Send a Chat interest to fetch chat messages after the user gets the Sync data packet
 * @param {SyncStates[]} syncStates The array of sync states
 * @param {bool} isRecovery if it's in recovery state
 */
ChronoDriveSync.prototype.sendInterest = function (syncStates, isRecovery) {
    // TODO: Cover the recovery state case
    this.isRecoverySyncState = isRecovery;
    var sendList = []; // of String
    var sessionNoList = []; // of number
    var sequenceNoList = []; // of number
    console.log('sendInterest syncStates: ', syncStates);
    // NOTE: looks like chronochat was matching on sync states from other users
    // I *think* we'll want to match on state from the same user here, since 
    // others won't be updating their files
    // QUESTION: If note is right, do we need to ensure the state wasn't created by
    // the current device or will that be fine?
    for (var j = 0; j < syncStates.length; j++) {
        var syncState = syncStates[j];
        var nameComponents = new ndn_js_1.Name(syncState.getDataPrefix());
        var tempName = nameComponents.get(-1).toEscapedString();
        var sessionNo = syncState.getSessionNo();
        console.log('Received sync state: ' + syncState.getDataPrefix() + ', ' + tempName + ', ' + sessionNo + ', ' + syncState.getSequenceNo());
        if (tempName == this.userName) {
            var index = -1;
            for (var k = 0; k < sendList.length; ++k) {
                if (sendList[k] == syncState.getDataPrefix()) {
                    index = k;
                    break;
                }
            }
            if (index != -1) {
                sessionNoList[index] = sessionNo;
                sequenceNoList[index] = syncState.getSequenceNo();
            }
            else {
                sendList.push(syncState.getDataPrefix());
                sessionNoList.push(sessionNo);
                sequenceNoList.push(syncState.getSequenceNo());
            }
        }
    }
    for (var i = 0; i < sendList.length; ++i) {
        // NOTE: Here is where we build interest name for the update data
        // I think instead of sessionNo we should be using the timestamp from this.fileInfo, since the sessionNo
        // is locked in at the initialization of the sync object (I think)
        // This is where we would add the file hash to the interest too
        var uri = sendList[i] + "/" + sessionNoList[i] + "/" + sequenceNoList[i];
        var interest = new ndn_js_1.Interest(new ndn_js_1.Name(uri));
        interest.setInterestLifetimeMilliseconds(this.sync_lifetime);
        console.log('Interest: ' + uri);
        this.face.expressInterest(interest, this.onData.bind(this), this.updateTimeout.bind(this));
    }
};
/**
 * Process the incoming data
 * @param {Interest} interest
 * @param {Data} co
 */
ChronoDriveSync.prototype.onData = function (interest, co) {
    // TODO: here I think we need to store the user and the timestamp & checksum to the new 'roster'
    // and obviously update the files
    // TODO: Handle recovery state
    console.log('onData interest: ', interest);
    var arr = new Uint8Array(co.getContent().size());
    arr.set(co.getContent().buf());
    var content = this.FileMessage.decode(arr.buffer);
    console.log('Data packet: ', content);
    var temp = (new Date()).getTime();
    if (temp - content.timestamp < 120000) {
        var t = (new Date(content.timestamp)).toLocaleTimeString();
        var name = content.user;
        // chat_prefix should be saved as a name, not a URI string.
        var prefix = co.getName().getPrefix(-2).toUri();
        // NOTE: here it's grabbing the last two components of the data Name - need to store timestamp and checksum here probably
        // NOTE: Session is a timestamp
        var session = parseInt((co.getName().get(-2)).toEscapedString());
        var seqno = parseInt((co.getName().get(-1)).toEscapedString());
        var l = 0;
        // update roster
        while (l < this.roster.length) {
            var name_t = this.roster[l].substring(0, this.roster[l].length - name.length);
            var session_t = this.roster[l].substring(this.roster[l].length - name.length, this.roster[l].length);
            if (name === name_t && session > session_t) {
                this.roster[l] = name + session;
                break;
            }
            else {
                l++;
            }
        }
        console.log('onData - Updated roster: ', this.roster);
        // QUESTION: Will this ever even get hit since we should have every one that has logged in on device?
        // If it does, does that mean we're catching updates we shouldn't, eg ChronoDrive updates for users that
        // never logged in here
        if (l == this.roster.length) {
            this.roster.push(name + session);
        }
        var timeout = new ndn_js_1.Interest(new ndn_js_1.Name("/local/timeout"));
        timeout.setInterestLifetimeMilliseconds(120000);
        console.log('Interest: /local/timeout');
        this.face.expressInterest(timeout, this.dummyOnData, this.alive.bind(this, timeout, seqno, name, session, prefix));
        if (content.user === this.userName) {
            main_1.writeFromFileInfo(JSON.parse(content.data));
        }
        else {
            // Got non logged in user data, should probably write it
            console.log(content.user + ": " + content.data);
        }
    }
};
/**
 * No file data coming back.
 * @param {Interest}
 */
ChronoDriveSync.prototype.updateTimeout = function (interest) {
    console.log('updateTimeout interest: ', interest);
    console.log("Timeout waiting for file data");
};
/**˝
 *
 * @param {Interest}
 */
ChronoDriveSync.prototype.heartbeat = function (interest) {
    console.log('heartbeat interest: ', interest);
    // TODO: A better heartbeat, once we have a cache of actual updates instead
    // of just file state
    this.sync.publishNextSequenceNo();
    this.fileInfoUpdate("UPDATE", this.fileInfo);
    // Making a timeout interest for heartbeat...
    var timeout = new ndn_js_1.Interest(new ndn_js_1.Name("/local/timeout"));
    timeout.setInterestLifetimeMilliseconds(60000);
    console.log('Interest: ' + timeout.getName().toUri());
    this.face.expressInterest(timeout, this.dummyOnData, this.heartbeat.bind(this));
};
/**
 * This is called after a timeout to check if the user with prefix has a newer sequence
 * number than the given temp_seq. If not, assume the user is idle and remove from the
 * roster and print a leave message.
 * This method has an interest argument because we use it as the onTimeout for
 * Face.expressInterest.
 * @param {Interest}
 * @param {int}
 * @param {string}
 * @param {int}
 * @param {string}
 */
ChronoDriveSync.prototype.alive = function (interest, temp_seq, name, session, prefix) {
    console.log('alive interest: ', interest);
    // NOTE: I'm not sure we need to do anything here on a timeout 
    // //console.log("check alive");
    // // NOTE: Session is a timestamp
    // var index_n = this.sync.digest_tree.find(prefix, session);
    // var n = this.roster.indexOf(name + session);
    // if (index_n != -1 && n != -1) {
    //   var seq = this.sync.digest_tree.digestnode[index_n].seqno.seq;
    //   if (temp_seq == seq) {
    //     this.roster.splice(n, 1);
    //     console.log(name + " leave");
    //     var d = new Date();
    //     var t = d.toLocaleTimeString();
    //     // records the time of leaving
    //   }
    // }
};
/**
 * @param {string}
 */
ChronoDriveSync.prototype.sendFiles = function (fileInfo) {
    if (fileInfo && fileInfo.path) {
        this.sync.publishNextSequenceNo();
        console.log('Publishing next sequence number...');
        console.log(this.sync.getSequenceNo());
        // TODO: Handle different file message types
        this.fileInfoUpdate("UPDATE", fileInfo);
    }
};
/**
 * Update the file information sync has
 */
ChronoDriveSync.prototype.fileInfoUpdate = function (fileMessageType, fileInfo) {
    // TODO: retool to store file states with checksums
    // TODO: Handle different file message types
    // QUESTION: How do we ensure that files that aren't created on one system, and therefore wouldn't have interests, are created?
    // Maybe we'll need a hierarchical structure instead of a map - again, maybe it WILL need to be the root FileElement
    // If so, this method will need to search through and edit that structure
    this.fileInfo = fileInfo;
};
ChronoDriveSync.prototype.getRandomString = function () {
    var seed = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM0123456789';
    var result = '';
    for (var i = 0; i < 10; i++) {
        var pos = Math.floor(Math.random() * seed.length);
        result += seed[pos];
    }
    return result;
};
//# sourceMappingURL=ChronoDriveSync.js.map