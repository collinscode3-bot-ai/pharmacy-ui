import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, EMPTY } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  // endpoints that do not require auth
  // allow unauthenticated access to these API paths
  private whitelist = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/forgot-password',
    '/users/by-email',
    // allow unauthenticated user management endpoints used during recovery
    '/api/users'
  ];

  constructor(private auth: AuthService, private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const url = req.url;

    const isWhitelisted = this.whitelist.some(p => url.includes(p));

    const token = this.auth.getToken();

    if (!isWhitelisted && !token) {
      // no token for a protected request -> redirect to login
      this.router.navigate(['/']);
      return EMPTY;
    }

    if (token) {
      const authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
      return next.handle(authReq);
    }

    return next.handle(req);
  }
}
