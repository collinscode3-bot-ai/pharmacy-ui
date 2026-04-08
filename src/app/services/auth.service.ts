import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { API_ENDPOINTS } from '../config/api-endpoints';

interface LoginResponse {
  token: string;
  message: string;
  username: string;
  role: string;
  full_name: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  password: string;
  full_name: string;
  role?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private storageKey = 'pharmacy_auth_token';
  private nameKey = 'pharmacy_user_name';
  public userName$ = new BehaviorSubject<string | null>(this.getUserName());

  constructor(private http: HttpClient, private router: Router) {}

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(API_ENDPOINTS.AUTH.LOGIN, payload).pipe(
      tap(res => {
        this.setToken(res.token);
        this.setUserName(res.full_name);
      })
    );
  }

  signup(payload: SignupRequest): Observable<any> {
    // Post to relative /api path so dev proxy handles forwarding
    return this.http.post(API_ENDPOINTS.AUTH.SIGNUP, payload);
  }
  
  fetchUserByEmail(email: string): Observable<any> {
    const url = API_ENDPOINTS.AUTH.BY_EMAIL(email);
    console.log('Fetching user by email:', email, 'URL:', url);
    return this.http.get(url).pipe(
      tap({
        next: res => console.log('fetchUserByEmail response:', res),
        error: err => console.error('fetchUserByEmail error:', err)
      })
    );
  }
  
  updateUser(username: string, payload: { full_name?: string; password?: string; role?: string | null; }): Observable<any> {
    return this.http.put(API_ENDPOINTS.USERS.UPDATE(username), payload);
  }

  logout() {
    this.clear();
    this.router.navigate(['/']);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem(this.storageKey);
  }

  private setToken(token: string) {
    localStorage.setItem(this.storageKey, token);
  }

  getUserName(): string | null {
    return localStorage.getItem(this.nameKey);
  }

  public setUserName(name: string) {
    localStorage.setItem(this.nameKey, name);
    this.userName$.next(name);
  }

  private clear() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.nameKey);
    this.userName$.next(null);
  }
}
