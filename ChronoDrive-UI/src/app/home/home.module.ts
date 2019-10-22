import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { HomeRoutingModule } from './home-routing.module';

import { HomeComponent } from './home.component';
import { SharedModule } from '../shared/shared.module';

import {
  MdcDrawerModule,
  MdcButtonModule,
  MdcIconModule,
  MdcListModule
} from '@angular-mdc/web';
import { MatInputModule } from '@angular/material/input';

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
    MdcListModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HomeModule { }
