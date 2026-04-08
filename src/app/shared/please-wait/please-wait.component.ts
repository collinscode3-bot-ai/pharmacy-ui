import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-please-wait',
  templateUrl: './please-wait.component.html',
  styleUrls: ['./please-wait.component.scss']
})
export class PleaseWaitComponent {
  @Input() message: string = 'Please wait...';
}
