import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, SignupRequest } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent implements OnInit {
  error: string | null = null;
  fullName = '';
  role: string | null = null;
  password = '';
  confirm = '';
  submitted = false;
  username = '';
  successMessage: string | null = null;
  isRecoveryFlow = false;
  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    // read navigation state to detect recovery flow
    const nav = this.router.getCurrentNavigation?.();
    let state = nav?.extras?.state as any;
    // fallback to history.state which is available after navigation
    if (!state) {
      state = (history && (history.state as any)) || null;
    }
    if (state?.recovery && state.user) {
      this.isRecoveryFlow = true;
      const u = state.user;
      this.username = u.username || this.username;
      this.fullName = u.full_name || u.fullName || this.fullName;
      this.role = u.role || this.role;
    }
  }

  onSubmit(event?: Event) {
    if (event) event.preventDefault();
    this.submitted = true;
    this.error = null;

    if (!this.fullName || !this.fullName.trim() || !this.role || !this.password || !this.confirm || !this.username) {
      this.error = 'Please fill all mandatory fields with valid values.';
      return;
    }

    // validate email syntax
    const email = this.username.trim();
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      this.error = 'Work email must be a valid email address.';
      return;
    }

    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters.';
      return;
    }

    if (this.password !== this.confirm) {
      this.error = 'Password and confirmation do not match.';
      return;
    }

    const payload: SignupRequest = {
      username: this.username.trim(),
      password: this.password,
      full_name: this.fullName.trim(),
      role: this.role || null
    };

    if (this.isRecoveryFlow) {
      // update existing user
      this.auth.updateUser(payload.username, { full_name: payload.full_name, password: payload.password, role: payload.role }).subscribe({
        next: () => {
          this.successMessage = 'Account updated successfully.';
          setTimeout(() => this.router.navigate(['/']), 500);
        },
        error: err => {
          console.error(err);
          this.error = err?.error?.message || 'Account update failed. Please try again.';
        }
      });
    } else {
      this.auth.signup(payload).subscribe({
        next: () => {
          // show a brief success message then navigate to login
          this.successMessage = 'Account created successfully.';
          setTimeout(() => {
            this.router.navigate(['/']);
          }, 500);
        },
        error: err => {
          console.error(err);
          this.error = err?.error?.message || 'Signup failed. Please try again.';
        }
      });
    }
  }
}

