import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent {
  email = '';
  submitted = false;
  error: string | null = null;

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit(event?: Event) {
    if (event) event.preventDefault();
    this.submitted = true;
    this.error = null;

    const email = (this.email || '').trim();
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!email || !emailRegex.test(email)) {
      this.error = 'Enter a valid work email.';
      return;
    }

    console.log('Initiating password recovery for:', email);
    // try fetching user details to prefill the signup form
    this.auth.fetchUserByEmail(email).subscribe({
      next: (user) => {
        console.log('User found for email:', email, user);
        // navigate to signup with user data for recovery flow
        this.router.navigate(['/signup'], { state: { recovery: true, user } });
      },
      error: err => {
        console.error(err);
        this.error = 'No account found with that email. Please check and try again.';
        // fallback: still navigate with only username
        this.router.navigate(['/signup'], { state: { recovery: true, user: { username: email } } });
      }
    });

    // debug: no temporary direct fetch
  }
}
