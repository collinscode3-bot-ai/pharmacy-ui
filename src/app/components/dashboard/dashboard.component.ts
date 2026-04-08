import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_ENDPOINTS } from 'src/app/config/api-endpoints';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  // Card data
  dailySalesSummary: any = null;
  lowStockAlerts: any[] = [];
  expiringItems: any[] = [];
  salesTrends: any[] = [];
  salesHeights: number[] = [];
  recentActivity: any[] = [];
  criticalInventory: any[] = [];

  loading = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadDashboardCards();
  }

  private loadDashboardCards(): void {
    this.loading = true;

    const summary$ = this.http.get(API_ENDPOINTS.DASHBOARD.SUMMARY).pipe(catchError(() => of(null)));
    const lowStock$ = this.http.get(API_ENDPOINTS.DASHBOARD.LOW_STOCK).pipe(catchError(() => of([])));
    const expiring$ = this.http.get(API_ENDPOINTS.DASHBOARD.EXPIRING).pipe(catchError(() => of([])));
    const sales$ = this.http.get(API_ENDPOINTS.DASHBOARD.SALES_TRENDS).pipe(catchError(() => of([])));
    const recent$ = this.http.get(API_ENDPOINTS.DASHBOARD.RECENT_ACTIVITY).pipe(catchError(() => of([])));
    const inventory$ = this.http.get(API_ENDPOINTS.INVENTORY.LOW_STOCK).pipe(catchError(() => of([])));
    forkJoin({ summary: summary$, lowStock: lowStock$, expiring: expiring$, sales: sales$, recent: recent$, inventory: inventory$ }).subscribe({
      next: (res) => {
        this.dailySalesSummary = res.summary;
        this.lowStockAlerts = Array.isArray(res.lowStock) ? res.lowStock : [];
        this.expiringItems = Array.isArray(res.expiring) ? res.expiring : [];

        this.salesTrends = Array.isArray(res.sales) ? res.sales : [];
        this.recentActivity = Array.isArray(res.recent) ? res.recent : [];
        this.criticalInventory = Array.isArray(res.inventory) ? res.inventory : [];

        // compute heights for simple bar chart representation
        try {
          const values = this.salesTrends.map((s: any) => {
            if (s == null) return 0;
            return Number(s.value ?? s.amount ?? s.total ?? 0) || 0;
          });
          const max = values.length ? Math.max(...values) : 1;
          this.salesHeights = values.map(v => Math.round((v / (max || 1)) * 100));
        } catch (e) {
          this.salesHeights = [];
        }

        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
