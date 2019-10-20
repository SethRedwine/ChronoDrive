import { Component, OnInit } from '@angular/core';
const { ipcRenderer } = require('electron');

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  loggedIn = false;
  user: string;

  constructor() { }

  ngOnInit() {
  }

  loginMenuClick() {
    if (this.loggedIn) {
      this.loggedIn = false;
      this.user = null;
    }
    ipcRenderer.send('login', 'username');
  }

}
