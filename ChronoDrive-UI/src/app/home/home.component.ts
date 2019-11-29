import { Component, OnInit, NgZone } from '@angular/core';
import { FileElement } from '../types/FileElement';
import { FileService } from '../core/services/file/file.service';
import { Observable } from 'rxjs';
import { FileInfo } from '../types/DirectoryInfo';
const { ipcRenderer } = require('electron');

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  loggedIn = false;
  showMenu = true;
  username: string;

  public fileElements: Observable<FileElement[]>;
  currentRoot: FileElement;
  currentPath: string;
  canNavigateUp = false;

  constructor(public fileService: FileService, private zone: NgZone) { }

  ngOnInit() {
    ipcRenderer.on('directory-update', (evt, msg) => {
      this.fileService.clearFiles();
      this.zone.run(() => {
        this.createInitialDirectoryStructure(msg);
      });
    });
  }

  login(user: string, pass: string): void {
    // TODO: Handle passwords
    ipcRenderer.send('login', { user });
    this.username = user;
    this.loggedIn = true;
  }

  logOut() {
    this.fileService.clearFiles();
    this.loggedIn = false;
    this.username = null;
    this.currentPath = null;
  }

  createInitialDirectoryStructure(msg: FileInfo) {
    msg.entries.forEach(entry => this.addDirectoryOrFile(entry, 'root'));
    this.updateFileElementQuery();
  }

  addDirectoryOrFile(entry: FileInfo, parent: string) {
    const file = this.fileService.add({
      name: entry.entry.name,
      path: entry.path,
      isFolder: entry.isDirectory,
      parent: parent
    });
    if (entry.entries) {
      entry.entries.forEach(entry => this.addDirectoryOrFile(entry, file.id));
    }
  }

  addFolder(folder: { name: string }) {
    this.fileService.add({ isFolder: true, name: folder.name, parent: this.currentRoot ? this.currentRoot.id : 'root' });
    this.updateFileElementQuery();
  }

  removeElement(element: FileElement) {
    this.fileService.delete(element.id);
    this.updateFileElementQuery();
  }

  navigateToFolder(element: FileElement) {
    this.currentRoot = element;
    this.updateFileElementQuery();
    this.currentPath = this.pushToPath(this.currentPath, element.name);
    this.canNavigateUp = true;
  }

  navigateUp() {
    if (this.currentRoot && this.currentRoot.parent === 'root') {
      this.currentRoot = null;
      this.canNavigateUp = false;
      this.updateFileElementQuery();
    } else {
      this.currentRoot = this.fileService.get(this.currentRoot.parent);
      this.updateFileElementQuery();
    }
    this.currentPath = this.popFromPath(this.currentPath);
  }

  moveElement(event: { element: FileElement; moveTo: FileElement }) {
    this.fileService.update(event.element.id, { parent: event.moveTo.id });
    this.updateFileElementQuery();
  }

  renameElement(element: FileElement) {
    console.log(element);
    this.fileService.update(element.id, { name: element.name });
    this.updateFileElementQuery();
  }

  updateFileElementQuery() {
    this.fileElements = this.fileService.queryInFolder(this.currentRoot ? this.currentRoot.id : 'root');
  }

  pushToPath(path: string, folderName: string) {
    let p = path ? path : '';
    p += `${folderName}/`;
    return p;
  }

  popFromPath(path: string) {
    let p = path ? path : '';
    let split = p.split('/');
    split.splice(split.length - 2, 1);
    p = split.join('/');
    return p;
  }
}
