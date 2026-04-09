import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'pharmacy-ui';
  isDashboard = false;

  constructor(private router: Router) {
    this.checkRoute(this.router.url);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.checkRoute(e.urlAfterRedirects || e.url);
    });
  }

  private checkRoute(url: string) {
    // Show the app shell for authenticated/inside-app routes.
    // Public routes: root (login), signup, forgot-password
    if (!url) {
      this.isDashboard = false;
      return;
    }

    if (url === '/' || url === '' || url.startsWith('/signup') || url.startsWith('/forgot-password')) {
      this.isDashboard = false;
    } else {
      this.isDashboard = true;
    }
  }
}
