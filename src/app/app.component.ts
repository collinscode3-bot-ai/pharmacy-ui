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
    this.isDashboard = url.startsWith('/dashboard');
  }
}
