import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { API_ENDPOINTS } from 'src/app/config/api-endpoints';

interface DashboardSummary {
  total?: number;
  dailySales?: number;
  todaySales?: number;
  lowStockCount?: number;
  expiringSoonCount?: number;
  change?: string;
  lowStockChange?: string;
  note?: string;
}

interface SalesTrendBar {
  height: number;
  label: string;
  value: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  // Card data
  dailySalesSummary: DashboardSummary | null = null;
  lowStockAlerts: any[] = [];
  expiringItems: any[] = [];
  salesTrends: any[] = [];
  salesHeights: number[] = [];
  salesTrendBars: SalesTrendBar[] = [];
  recentActivity: any[] = [];
  criticalInventory: any[] = [];

  loading = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadDashboardCards();
  }

  get dailySalesAmount(): number {
    if (!this.dailySalesSummary) {
      return 0;
    }

    const summary = this.dailySalesSummary;
    return Number(summary.dailySales ?? summary.todaySales ?? summary.total ?? 0) || 0;
  }

  get lowStockAlertCount(): number {
    if (this.lowStockAlerts.length > 0) {
      return this.lowStockAlerts.length;
    }

    return Number(this.dailySalesSummary?.lowStockCount ?? 0) || 0;
  }

  get expiringItemCount(): number {
    if (this.expiringItems.length > 0) {
      return this.expiringItems.length;
    }

    return Number(this.dailySalesSummary?.expiringSoonCount ?? 0) || 0;
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
        this.dailySalesSummary = (res.summary || null) as DashboardSummary | null;
        this.lowStockAlerts = Array.isArray(res.lowStock) ? res.lowStock : [];
        this.expiringItems = Array.isArray(res.expiring) ? res.expiring : [];

        this.salesTrends = Array.isArray(res.sales) ? res.sales : [];
        this.recentActivity = Array.isArray(res.recent) ? res.recent : [];
        this.criticalInventory = Array.isArray(res.inventory) ? res.inventory : [];

        // compute heights for simple bar chart representation
        try {
          const bars = this.salesTrends.map((s: any, index: number) => {
            if (s == null) {
              return {
                value: 0,
                label: `D${index + 1}`
              };
            }

            const value = Number(s.value ?? s.amount ?? s.total ?? 0) || 0;
            const label = this.formatTrendDateLabel(
              s.date ?? s.day ?? s.salesDate ?? s.txnDate ?? s.createdOn ?? s.label,
              index
            );

            return { value, label };
          });

          const values = bars.map((b) => b.value);
          const max = values.length ? Math.max(...values) : 1;
          this.salesHeights = values.map(v => Math.round((v / (max || 1)) * 100));
          this.salesTrendBars = bars.map((bar, idx) => ({
            value: bar.value,
            label: bar.label,
            height: this.salesHeights[idx] || 0
          }));
        } catch (e) {
          this.salesHeights = [];
          this.salesTrendBars = [];
        }

        this.loading = false;
      },
      error: () => {
        this.salesTrendBars = [];
        this.loading = false;
      }
    });
  }

  private formatTrendDateLabel(rawValue: unknown, index: number): string {
    if (rawValue == null || rawValue === '') {
      return `D${index + 1}`;
    }

    const text = String(rawValue).trim();
    if (!text) {
      return `D${index + 1}`;
    }

    const num = Number(text);
    if (Number.isFinite(num)) {
      const ms = num > 1e12 ? num : (num > 1e9 ? num * 1000 : num);
      const asDate = new Date(ms);
      if (!Number.isNaN(asDate.getTime())) {
        return asDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      }
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }

    return text;
  }
}
