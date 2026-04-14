import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  inventoryExpanded = false;

  constructor(private auth: AuthService) {}

  toggleInventorySublinks(): void {
    this.inventoryExpanded = !this.inventoryExpanded;
  }

  logout() {
    this.auth.logout();
  }
}
