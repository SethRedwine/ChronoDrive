import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { NewFolderDialogComponent } from '../shared/modals/newFolderDialog/newFolderDialog.component';
import { RenameDialogComponent } from '../shared/modals/renameDialog/renameDialog.component';
import { FileElement } from '../types/FileElement';
const { shell } = require('electron')

@Component({
  selector: 'file-manager',
  templateUrl: './file-manager.component.html',
  styleUrls: ['./file-manager.component.scss']
})
export class FileManagerComponent implements OnChanges {
  constructor(public dialog: MatDialog) { }

  @Input() fileElements: FileElement[];
  @Input() canNavigateUp: string;
  @Input() path: string;

  @Output() folderAdded = new EventEmitter<{ name: string }>();
  @Output() elementRemoved = new EventEmitter<FileElement>();
  @Output() elementRenamed = new EventEmitter<FileElement>();
  @Output() navigatedDown = new EventEmitter<FileElement>();
  @Output() elementMoved = new EventEmitter<{ element: FileElement; moveTo: FileElement }>();
  @Output() navigatedUp = new EventEmitter();

  isSingleClick = false;
  fileElementsCopy: FileElement[];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.fileElements && this.fileElements.length) {
      this.fileElementsCopy = JSON.parse(JSON.stringify(this.fileElements));
    }
  }

  deleteElement(element: FileElement) {
    this.elementRemoved.emit(element);
  }

  navigate(element: FileElement) {
    this.isSingleClick = true;
    setTimeout(() => {
      if (this.isSingleClick && element.isFolder) {
        this.navigatedDown.emit(element);
      }
    }, 250);
  }

  openFile(element: FileElement) {
    this.isSingleClick = false;
    if (!element.isFolder) {
      console.log('Opening: ' + element.path);
      shell.openItem(element.path);
      // For some reason, the fileElements list is getting clear on openItem so we have to repopulate
      setTimeout(() => {
        this.fileElements = JSON.parse(JSON.stringify(this.fileElementsCopy));
      }, 350);
    } else {
      this.navigatedDown.emit(element);
    }
  }

  navigateUp() {
    this.navigatedUp.emit();
  }

  moveElement(element: FileElement, moveTo: FileElement) {
    this.elementMoved.emit({ element: element, moveTo: moveTo });
  }

  openNewFolderDialog() {
    let dialogRef = this.dialog.open(NewFolderDialogComponent);
    dialogRef.afterClosed().subscribe(res => {
      if (res) {
        this.folderAdded.emit({ name: res });
      }
    });
  }

  openRenameDialog(element: FileElement) {
    let dialogRef = this.dialog.open(RenameDialogComponent);
    dialogRef.afterClosed().subscribe(res => {
      if (res) {
        element.name = res;
        this.elementRenamed.emit(element);
      }
    });
  }

  openMenu(event: MouseEvent, element: FileElement, viewChild: MatMenuTrigger) {
    event.preventDefault();
    viewChild.openMenu();
  }
}
