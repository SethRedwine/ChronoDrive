import { Stats, Dirent } from 'fs';

class FileInfo {
    entry: Dirent;
    isDirectory: boolean;
    path: string;
    stats: Stats;
    entries: FileInfo[];
    fileContents: File;
    checksum: string;
    lastUpdate: number;
}

export { FileInfo }