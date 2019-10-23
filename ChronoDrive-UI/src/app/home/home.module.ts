import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { HomeRoutingModule } from './home-routing.module';
import { HomeComponent } from './home.component';
import { SharedModule } from '../shared/shared.module';
import { FileService } from '../core/services/file/file.service';

import {
  MdcDrawerModule,
  MdcButtonModule,
  MdcIconModule,
  MdcListModule
} from '@angular-mdc/web';

import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { FileManagerModule } from '../file-manager/file-manager.module';
import { FlexLayoutModule } from '@angular/flex-layout';

@NgModule({
  declarations: [HomeComponent],
  imports: [
    CommonModule,
    SharedModule,
    HomeRoutingModule,
    FormsModule,
    MdcDrawerModule,
    MdcIconModule,
    MdcButtonModule,
    MatInputModule,
    MdcListModule,
    MatCardModule,
    BrowserAnimationsModule,
    FileManagerModule,
    FlexLayoutModule,
    MatCardModule
  ],
  providers: [FileService],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HomeModule { }
