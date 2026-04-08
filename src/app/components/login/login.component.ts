import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  username = '';
  password = '';
  error: string | null = null;
  submitted = false;

  constructor(private router: Router, private auth: AuthService) {}

  onSubmit(event?: Event) {
    if (event) event.preventDefault();
    this.submitted = true;
    this.error = null;

    // Basic client-side validation matching @NotBlank
    if (!this.username || !this.username.trim() || !this.password || !this.password.trim()) {
      this.error = 'Username and password are required.';
      return;
    }

    const payload = { username: this.username.trim(), password: this.password };
    this.auth.login(payload).subscribe({
      next: res => {
        this.router.navigate(['/dashboard']);
      },
      error: err => {
        console.error(err);
        this.error = 'Login failed. Check your credentials.';
      }
    });
  }
}
