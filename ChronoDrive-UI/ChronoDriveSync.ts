import { Name, Face, ChronoSync2013, Interest, Data, Blob, UnixTransport, SafeBag, KeyChain } from 'ndn-js';
import { FileInfo } from './src/app/types/DirectoryInfo';
import { getLastUpdateMs, writeFromFileInfo, DEFAULT_RSA_PRIVATE_KEY_DER, DEFAULT_RSA_PUBLIC_KEY_DER } from './main';
// NOTE: this ts file won't work with protobufjs 5.0.3
// import { FileMessage } from './filebuf';
const ProtoBuf = require("protobufjs");
const fileMessageBuilder = ProtoBuf.loadProtoFile('./filebuf.proto');

// NOTE: Default ndn prefix
// const HUB_PREFIX = "ndn/edu/ucla/remap";
const HUB_PREFIX = "ndn/edu/unomaha/adhoc/pi";

const ChronoDriveSync = function (userName: string, fileInfo: FileInfo, userDirChecksum: string, hubPrefix: string, face, keyChain, certificateName, roster: string[]) {
  this.userName = userName;
  this.userDirChecksum = userDirChecksum;
  this.maxmsgcachelength = 100;
  this.isRecoverySyncState = true;
  this.sync_lifetime = 5000.0;
  this.face = face;
  this.keyChain = keyChain;
  this.certificateName = certificateName;

  // TODO: rename prefix - we're filing, not chatting
  this.chat_prefix = (new Name(hubPrefix)).append(this.userName).append(this.getRandomString());

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

  this.FileMessage = fileMessageBuilder.build('FileMessage');

  // console.log(this.screen_name + ", welcome to chatroom " + this.chatroom + "!");
  this.sync = new ChronoSync2013(this.sendInterest.bind(this), this.initial.bind(this), this.chat_prefix, (new Name("/ndn/broadcast/ChronoDrive-0.1")).append(this.userName), session, face, keyChain, certificateName, this.sync_lifetime, this.onRegisterFailed.bind(this));
  face.registerPrefix(this.chat_prefix, this.onInterest.bind(this), this.onRegisterFailed.bind(this));
};

/**
 * Send the data packet which contains the user's message
 * @param {Name} Interest name prefix
 * @param {Interest} The interest
 * @param {Face} The face
 * @param {number} interestFilterId
 * @param {InterestFilter} filter
 */
ChronoDriveSync.prototype.onInterest = function
  (prefix, interest, face, interestFilterId, filter) {
  // TODO: Figure out how to add checksum to incoming interest
  // TODO: Actually, here we should iterate through the fileInfo/grab the right file, then check the checksum and the timestamp and update if it's older
  // QUESTION: How do we ensure that files that aren't created on one system, and therefore wouldn't have interests are created?
  // Maybe we'll need a hierarchical structure instead of a map - again, maybe it WILL need to be the root FileElement
  let content = null;
  // chat_prefix should really be saved as a name, not a URI string.
  var chatPrefixSize = new Name(this.chat_prefix).size();
  const interestTimestamp = parseInt(interest.getName().get(chatPrefixSize + 1).toEscapedString());
  const lastLocalUpdate = getLastUpdateMs(this.fileInfo);
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
    var co = new Data(interest.getName());
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
  var timeout = new Interest(new Name("/local/timeout"));
  timeout.setInterestLifetimeMilliseconds(60000);

  this.face.expressInterest(timeout, this.dummyOnData, this.heartbeat.bind(this));

  // TODO: Implement the equivalent of below, if using the roster as a digest log
  // if (this.roster.indexOf(this.usrname) == -1) {
  //   this.roster.push(this.usrname);
  //   //console.log("*** Local member " + this.usrname + " joins. ***");
  //   this.messageCacheAppend('JOIN', 'xxx');
  // }
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

  var sendList = [];       // of String
  var sessionNoList = [];  // of number
  var sequenceNoList = []; // of number

  // NOTE: looks like chronochat was matching on sync states from other users
  // I *think* we'll want to match on state from the same user here, since 
  // others won't be updating their files
  // QUESTION: If note is right, do we need to ensure the state wasn't created by
  // the current device or will that be fine?
  for (var j = 0; j < syncStates.length; j++) {
    var syncState = syncStates[j];
    var nameComponents = new Name(syncState.getDataPrefix());
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
    var interest = new Interest(new Name(uri));
    interest.setInterestLifetimeMilliseconds(this.sync_lifetime);
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
      } else {
        l++;
      }
    }

    // QUESTION: Will this ever even get hit since we should have every one that has logged in on device?
    // If it does, does that mean we're catching updates we shouldn't, eg ChronoDrive updates for users that
    // never logged in here
    if (l == this.roster.length) {
      this.roster.push(name + session);
    }
    var timeout = new Interest(new Name("/local/timeout"));
    timeout.setInterestLifetimeMilliseconds(120000);
    this.face.expressInterest(timeout, this.dummyOnData, this.alive.bind(this, timeout, seqno, name, session, prefix));

    if (content.user === this.userName) {
      writeFromFileInfo(JSON.parse(content.data));
    } else {
      // Got non logged in user data, should probably write it
      console.log(content.user + ": " + content.data);
    }
  }
};

/**
 * No chat data coming back.
 * @param {Interest}
 */
ChronoDriveSync.prototype.updateTimeout = function (interest) { };

/**
 *
 * @param {Interest}
 */
ChronoDriveSync.prototype.heartbeat = function (interest) {
  // TODO: A better heartbeat, once we have a cache of actual updates instead
  // of just file state
  this.sync.publishNextSequenceNo();
  this.fileInfoUpdate("UPDATE", this.fileInfo);

  // Making a timeout interest for heartbeat...
  var timeout = new Interest(new Name("/local/timeout"));
  timeout.setInterestLifetimeMilliseconds(60000);

  //console.log("*** Chat heartbeat expressed interest with name: " + timeout.getName().toUri() + " ***");
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
ChronoDriveSync.prototype.sendFiles = function (fileInfo: FileInfo) {
  if (fileInfo && fileInfo.path) {
    this.sync.publishNextSequenceNo();
    // TODO: Handle different file message types
    this.fileInfoUpdate("UPDATE", fileInfo);
  }
}

/**
 * Append a new CachedMessage to msgcache, using given messageType and message,
 * the sequence number from this.sync.getSequenceNo() and the current time.
 * Also remove elements from the front of the cache as needed to keep the size to
 * this.maxmsgcachelength.
 */
// ChronoDriveSync.prototype.messageCacheAppend = function (messageType, message) {
ChronoDriveSync.prototype.fileInfoUpdate = function (fileMessageType: string, fileInfo: FileInfo) {
  // TODO: retool to store file states with checksums
  // TODO: Handle different file message types

  // chronochat code: adding to cache and removing old entries
  // var d = new Date();
  // var t = d.getTime();
  // this.msgcache.push(new ChronoDriveSync.CachedMessage(this.sync.usrseq, messageType, message, t));
  // while (this.msgcache.length > this.maxmsgcachelength) {
  //   this.msgcache.shift();
  // }

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

// Embedded class CachedMessage; defining class with its constructor
// QUESTION: Should we keep historical states for files? it seems
// like this approach would be very data intensive unless we did it with 
// some sort of diffs
// NOTE: until we start working down that path, this will pretty much be dead code
// ChronoDriveSync.CachedMessage = function (seqno, msgtype, msg, time) {
//   // TODO: define file states for cache and update get methods
//   // NOTE: Can call/create this on each file read

//   // NOTE: could store path and file data here to use to send updates for individual files
//   this.seqno = seqno;
//   this.msgtype = msgtype;
//   this.msg = msg;
//   // NOTE: time should probably be last modified time for each file 
//   this.time = time;
// };

// ChronoDriveSync.CachedMessage.prototype.getSequenceNo = function () {
//   return this.seqno;
// };

// ChronoDriveSync.CachedMessage.prototype.getMessageType = function () {
//   return this.msgtype;
// };

// ChronoDriveSync.CachedMessage.prototype.getMessage = function () {
//   return this.msg;
// };

// /**
//  * @return MillisecondsSince1970
//  */
// ChronoDriveSync.CachedMessage.prototype.getTime = function () {
//   return this.time;
// };

// function getRandomNameString() {
//   var seed = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM';
//   var result = '';
//   for (var i = 0; i < 3; i++) {
//     var pos = Math.floor(Math.random() * seed.length);
//     result += seed[pos];
//   }
//   return result;
// };

// initiateChat() also sends random chat messages so that we don't need input from node JS
// QUESTION: Do we need this?
// function initiateChat() {
//   // Silence the warning from Interest wire encode.
//   Interest.setDefaultCanBePrefix(true);

//   // TODO: Figure out if this is necessary; if we only initialize sync after login, we probably don't need it
//   // and if we do it before, I think we should be able to pull the names from ./AppData
//   var screenName = getRandomNameString();


//   // NOTE: don't need next two lines anymore, keeping for context now
//   // chatroom is the name inputted by the user
//   // var chatroom = "ndnchat";

//   var face = new Face(new UnixTransport());

//   // Set up the KeyChain.
//   var keyChain = new KeyChain("pib-memory:", "tpm-memory:");
//   // This puts the public key in the pibImpl used by the SelfVerifyPolicyManager.
//   keyChain.importSafeBag(new SafeBag
//     (new Name("/testname/KEY/123"),
//       new Blob(DEFAULT_RSA_PRIVATE_KEY_DER, false),
//       new Blob(DEFAULT_RSA_PUBLIC_KEY_DER, false)));

//   face.setCommandSigningInfo(keyChain, keyChain.getDefaultCertificateName());

//   // TODO: Set some okay defaults here
//   var chronoDriveSync = new ChronoDriveSync
//     (screenName, null, '', HUB_PREFIX, face, keyChain,
//       keyChain.getDefaultCertificateName(), []);

//   // Send random test chat message at a fixed interval
//   var num = 0;
//   setInterval(
//     function () {
//       var chatMsg = screenName + num;
//       chronoDriveSync.sendMessage(chatMsg);
//       console.log(screenName + ": " + chatMsg);
//       num++;
//     }, 2000);
// }

// TODO: Will probably need to call this in the main.ts
// initiateChat();

export { ChronoDriveSync, HUB_PREFIX };