import { Component, OnInit } from '@angular/core';
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

  constructor() { }

  ngOnInit() {
    ipcRenderer.on('directory-update', (evt, msg) => {
      console.log(msg);
    })
  }

  login(user: string, pass: string): void {
    ipcRenderer.send('login', {user});
    this.username = user;
    this.loggedIn = true;
  }

  logOut() {
    if (this.loggedIn) {
      this.loggedIn = false;
      this.username = null;
    }
  }
}
