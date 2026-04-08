import { Component, HostListener, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnDestroy {
  userName = 'User';
  menuOpen = false;
  private destroy$ = new Subject<void>();

  constructor(private auth: AuthService) {
    this.auth.userName$.pipe(takeUntil(this.destroy$)).subscribe(name => {
      this.userName = name || 'User';
    });
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const clickedInside = !!target.closest('.user-block');
    if (!clickedInside) this.closeMenu();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
