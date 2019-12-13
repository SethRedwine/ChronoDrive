import { Name, ChronoSync2013, Interest, Data } from 'ndn-js';
import { FileInfo } from './src/app/types/DirectoryInfo';
import { writeFromFileInfo } from './main';
const ProtoBuf = require("protobufjs");

const fileProto = `
	syntax = "proto3";

	package com.fileMessage;

	enum FileMessageType {
		option allow_alias = true;
		ADD = 0;
 		UPDATE = 1;
  	DELETE = 2;
  	OTHER = 3;
	}

	message FileMessage {
		string user = 1;
		string filename = 2;
		string path = 3;
 		FileMessageType type = 4;
		int32 timestamp = 5;
 		string data = 6;
	}
`;

enum FileMessageType {
  ADD,
  UPDATE,
  DELETE,
  OTHER,
}

class FileMessage {
  user: string;
  filename: string;
  path: string;
  type: FileMessageType;
  timestamp: number;
  data: string;
}

class ManifestEntry {
  path: string;
  lastUpdated: number;
  checksum: string;
}

const fileMessageBuilder = ProtoBuf.protoFromString(fileProto);

// console.log('Protobuf: ', ProtoBuf);
// console.log('File Message Builder: ', fileMessageBuilder);

const HUB_PREFIX = "ndn/edu/unomaha/adhoc/pi";

const ChronoDriveSync = function (userName: string, fileInfo: FileInfo, userDirChecksum: string, hubPrefix: string, face, keyChain, certificateName, roster: string[]) {
  this.userName = userName;
  this.userDirChecksum = userDirChecksum;
  this.isRecoverySyncState = true;
  this.sync_lifetime = 15000.0;
  this.face = face;
  this.keyChain = keyChain;
  this.certificateName = certificateName;

  this.deviceId = this.getRandomString();
  this.sync_prefix = (new Name(hubPrefix)).append(this.userName).append(this.deviceId);
  console.log('Prefix: ', this.sync_prefix.toUri());

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

  //console.log("The local chat prefix " + this.sync_prefix.toUri() + " ***");
  this.FileMessage = fileMessageBuilder.build('com.fileMessage');
  console.log('FileMessage', this.FileMessage)

  // console.log(this.screen_name + ", welcome to chatroom " + this.chatroom + "!");
  this.sync = new ChronoSync2013(
    this.sendManifestInterest.bind(this),
    this.initial.bind(this),
    this.sync_prefix,
    (new Name("/ndn/broadcast/ChronoDrive-0.1")).append(this.userName),
    fileInfo.lastUpdate,
    face,
    keyChain,
    certificateName,
    this.sync_lifetime,
    this.onRegisterFailed.bind(this)
  );
  face.registerPrefix(this.sync_prefix, this.onInterest.bind(this), this.onRegisterFailed.bind(this));
};

/**
 * Send a data packet which contains the file manifest or file update
 * @param {Name} Interest name prefix
 * @param {Interest} The interest
 * @param {Face} The face
 * @param {number} interestFilterId
 * @param {InterestFilter} filter
 */
ChronoDriveSync.prototype.onInterest = function
  (prefix, interest, face, interestFilterId, filter) {
  console.log('onInterest interest: ', interest);
  const interestName = interest.getName().toUri()
  console.log('interest name: ', interestName);
  console.log('interest size: ', interest.getName().size());
  var syncPrefixSize = this.sync_prefix.size();
  console.log('syncPrefixSize: ', syncPrefixSize);

  // TODO: if there's ever a filepath containing manifest, this is gonna be borked
  if (interestName.indexOf('manifest') > -1) {
    console.log(`Preparing manifest for  ${this.userName}...`);
    const fileManifest = this.getFileManifestMessage(this.fileInfo);
    var str = new Uint8Array((new this.FileMessage.FileMessage(fileManifest)).toArrayBuffer());
    var co = new Data(interest.getName());
    co.setContent(str);
    this.keyChain.sign(co, this.certificateName, function () {
      try {
        face.putData(co);
        console.log('Sent manifest: ', JSON.parse(fileManifest.data));
      }
      catch (e) {
        console.log(e.toString());
      }
    });
  } else {
    const interestFilepath = parseInt(interest.getName().getSubName(syncPrefixSize).toEscapedString());
    console.log('interestFilepath: ', interestFilepath);
    const fileToSend = this.getContentsForFileUpdateMessage(this.fileInfo, interestFilepath);

    if (fileToSend) {
      console.log('Found ' + interestFilepath + ' for update');
      var str = new Uint8Array((new this.FileMessage.FileMessage(fileToSend)).toArrayBuffer());
      var co = new Data(interest.getName());
      co.setContent(str);
      this.keyChain.sign(co, this.certificateName, function () {
        try {
          face.putData(co);
          console.log('Sent response for ' + fileToSend.path + '...');
        }
        catch (e) {
          console.log(e.toString());
        }
      });
    } else {
      console.error('Error: Did not find requested file ' + interestFilepath)
    }
  }
};

ChronoDriveSync.prototype.getFileManifestMessage = function (dir: FileInfo): FileMessage {
  const manifest: ManifestEntry[] = [];
  for (const entry of dir.entries) {
    if (!entry.isDirectory) {
      manifest.push({
        path: entry.path,
        lastUpdated: entry.lastUpdate,
        checksum: entry.checksum
      });
    } else {
      manifest.concat(this.getFileManifestMessage(entry));
    }
  }
  return {
    user: this.userName,
    filename: '',
    path: '',
    type: FileMessageType.OTHER,
    timestamp: this.fileInfo.lastUpdate,
    data: JSON.stringify(manifest)
  };
}

ChronoDriveSync.prototype.getContentsForFileUpdateMessage = function (dir: FileInfo, interestFilepath: string): FileMessage {
  for (const entry of dir.entries) {
    if (!entry.isDirectory) {
      if (entry.path === interestFilepath) {
        return {
          user: this.userName,
          filename: '',
          path: entry.path,
          type: FileMessageType.UPDATE,
          timestamp: this.fileInfo.lastUpdate,
          data: JSON.stringify(entry)
        };
      }
    } else {
      return this.getContentsForFileUpdatesMessage(entry, interestFilepath);
    }
  }
  return null;
}

ChronoDriveSync.prototype.onRegisterFailed = function (prefix) { };

ChronoDriveSync.prototype.initial = function () {
  var timeout = new Interest(new Name("/local/timeout"));
  timeout.setInterestLifetimeMilliseconds(60000);
  console.log('Interest: /local/timeout')
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
 * Send a file interest to fetch files after the user gets the Sync data packet
 * @param {SyncStates[]} syncStates The array of sync states
 * @param {bool} isRecovery if it's in recovery state
 */
ChronoDriveSync.prototype.sendManifestInterest = function (syncStates, isRecovery) {
  // TODO: Cover the recovery state case
  this.isRecoverySyncState = isRecovery;

  console.log('sendManifestInterest syncStates: ', syncStates);

  // TODO: This whole thing needs to be rethought, we'll need to send an interest for each file
  // if we get a timestamp that is newer than the latest update we could send an interest for each file,
  // return a no-update message type if the file is up to date (based on hash of contents), return file update otherwise
  // It may be useful to sync a manifest from which to sync these files, this would solve the problem of knowing which files need to be requested
  // request the manifest from the most up-to-date node, then send out requests based on that manifest
  let uri;
  let biggestSession = 0;
  for (var j = 0; j < syncStates.length; j++) {
    var syncState = syncStates[j];
    var nameComponents = new Name(syncState.getDataPrefix());
    var tempName = nameComponents.get(-1).toEscapedString();
    var sessionNo = syncState.getSessionNo();

    console.log('Received sync state: ' + syncState.getDataPrefix() + ', ' + tempName + ', ' + sessionNo + ', ' + syncState.getSequenceNo());
    console.log('sync update: ', new Date(this.fileInfo.lastUpdate));
    console.log('last local update: ', new Date(this.fileInfo.lastUpdate));
    if (sessionNo > biggestSession) {
      biggestSession = sessionNo;
      uri = syncState.getDataPrefix() + "/manifest"; // + this.fileInfo.lastUpdate + "/" + syncState.getSequenceNo();
    }
  }

  console.log('sendManifestInterest Interest: ' + uri);
  if (uri) {
    var interest = new Interest(new Name(uri));
    interest.setInterestLifetimeMilliseconds(this.sync_lifetime);
    this.face.expressInterest(interest, this.onManifestData.bind(this), this.updateTimeout.bind(this));
  }
};

/**
 * Process the incoming file manifest data
 * @param {Interest} interest
 * @param {Data} co
 */
ChronoDriveSync.prototype.onManifestData = function (interest, co) { 
  console.log('onManifestData interest: ', interest.getName().toEscapedString());
  const arr = new Uint8Array(co.getContent().size());
  arr.set(co.getContent().buf());
  const content = this.FileMessage.decode(arr.buffer);
  console.log('Data packet: ', content);
  const interestSize = interest.getName().size();

  const manifest: ManifestEntry[] = JSON.parse(content.data);

  for(const entry of manifest) {
    const fileInterestPrefix = interest.getName().getSubName(0, interestSize - 1);
    const fileInterest = new Interest(fileInterestPrefix.append(entry.path));
    console.log('sending file interest: ', fileInterest.getName().toEscapedString());
    fileInterest.setInterestLifetimeMilliseconds(this.sync_lifetime);
    // TODO: bind a onFileManifest method here instead of onData, onData will get called from that method for each file requiring and update
    this.face.expressInterest(fileInterest, this.onFileData.bind(this), this.updateTimeout.bind(this));
  }
}

/**
 * Process the incoming file data
 * @param {Interest} interest
 * @param {Data} co
 */
ChronoDriveSync.prototype.onFileData = function (interest, co) {
  // TODO: here I think we need to store the user and the timestamp & checksum to the new 'roster'
  // and obviously update the files
  // TODO: Handle recovery state

  console.log('onFileData interest: ', interest.getName().toEscapedString());
  var arr = new Uint8Array(co.getContent().size());
  arr.set(co.getContent().buf());
  var content = this.FileMessage.decode(arr.buffer);
  console.log('Data packet: ', content);
  var temp = (new Date()).getTime();
  if (temp - content.timestamp < 120000) {
    var t = (new Date(content.timestamp)).toLocaleTimeString();
    var name = content.user;

    // sync_prefix should be saved as a name, not a URI string.
    var prefix = co.getName().getPrefix(-2).toUri();

    // NOTE: here it's grabbing the last two components of the data Name - need to store timestamp and checksum here probably
    // NOTE: Session is a timestamp
    // var session = parseInt((co.getName().get(-2)).toEscapedString());
    // var seqno = parseInt((co.getName().get(-1)).toEscapedString());
    // var l = 0;

    // update roster
    // while (l < this.roster.length) {
    //   var name_t = this.roster[l].substring(0, this.roster[l].length - name.length);
    //   var session_t = this.roster[l].substring(this.roster[l].length - name.length, this.roster[l].length);
    //   if (name === name_t && session > session_t) {
    //     this.roster[l] = name + session;
    //     break;
    //   } else {
    //     l++;
    //   }
    // }
    // console.log('onFileData - Updated roster: ', this.roster);

    // QUESTION: Will this ever even get hit since we should have every one that has logged in on device?
    // If it does, does that mean we're catching updates we shouldn't, eg ChronoDrive updates for users that
    // never logged in here
    // if (l == this.roster.length) {
    //   this.roster.push(name + session);
    // }
    var timeout = new Interest(new Name("/local/timeout"));
    timeout.setInterestLifetimeMilliseconds(120000);
    console.log('Interest: /local/timeout');
    this.face.expressInterest(timeout, this.dummyOnData, this.alive.bind(this)); //, timeout, seqno, name, session, prefix));

    if (content.user === this.userName) {
      writeFromFileInfo(JSON.parse(content.data));
    } else {
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
  console.log('updateTimeout interest: ', interest.getName().toUri());
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
  var timeout = new Interest(new Name("/local/timeout"));
  timeout.setInterestLifetimeMilliseconds(300000);

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
ChronoDriveSync.prototype.sendFiles = function (fileInfo: FileInfo) {
  if (fileInfo && fileInfo.path) {
    // TODO: Handle different file message types
    this.fileInfoUpdate("UPDATE", fileInfo);
    // this.sync.session = fileInfo.lastUpdate;
    this.sync.publishNextSequenceNo();
    console.log('Publishing next sequence number: ' + this.sync.getSequenceNo());
  }
}

/**
 * Update the file information sync has
 */
ChronoDriveSync.prototype.fileInfoUpdate = function (fileMessageType: string, fileInfo: FileInfo) {
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

export { ChronoDriveSync, HUB_PREFIX };