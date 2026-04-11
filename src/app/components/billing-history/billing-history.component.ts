import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { API_ENDPOINTS } from 'src/app/config/api-endpoints';

interface Transaction {
  id: string;
  billNo: string;
  billDate: string;
  patientName: string;
  totalAmount: number;
}

interface SaleSearchResult {
  billNo?: string;
  id?: number | string;
  saleId?: number | string;
  saleNumber?: string;
  invoiceId?: number | string;
  billDate?: string;
  createdAt?: string;
  patientName?: string;
  customerName?: string;
  totalAmount?: number;
  grandTotalAmount?: number;
  [key: string]: any;
}

interface PagedSales {
  content?: SaleSearchResult[];
  items?: SaleSearchResult[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
}

@Component({
  selector: 'app-billing-history',
  templateUrl: './billing-history.component.html',
  styleUrls: ['./billing-history.component.scss']
})
export class BillingHistoryComponent implements OnInit {
  filterCategory = 'Bill No';
  searchKeyword = '';
  matchType = 'All';
  rowsPerPage = 5;
  readonly rowsPerPageOptions = [5, 10, 20];
  currentPage = 1;

  transactions: Transaction[] = [];
  totalElements = 0;
  totalPages = 0;
  loading = false;
  errorMessage = '';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.fetchTransactions({ billDate: this.getTodayForApi() }, 0);
  }

  get startRow(): number {
    if (!this.totalElements) {
      return 0;
    }

    return (this.currentPage - 1) * this.rowsPerPage + 1;
  }

  get endRow(): number {
    return Math.min(this.currentPage * this.rowsPerPage, this.totalElements);
  }

  viewTransaction(t: Transaction): void {
    const id = t.id || t.billNo;
    if (!id) {
      return;
    }
    this.router.navigate(['/process-return', id]);
  }

  applySearch(): void {
    const keyword = this.searchKeyword.trim();
    const params: Record<string, string> = {};

    if (keyword) {
      params[this.categoryToParam(this.filterCategory)] = keyword;
    }

    this.currentPage = 1;
    this.fetchTransactions(params, 0);
  }

  resetSearch(): void {
    this.filterCategory = 'Bill No';
    this.searchKeyword = '';
    this.matchType = 'All';
    this.currentPage = 1;
    this.fetchTransactions({ billDate: this.getTodayForApi() }, 0);
  }

  onRowsPerPageChange(): void {
    this.currentPage = 1;
    this.reloadCurrentSearch(0);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }

    this.currentPage = page;
    this.reloadCurrentSearch(page - 1);
  }

  private reloadCurrentSearch(apiPage: number): void {
    const keyword = this.searchKeyword.trim();
    const params: Record<string, string> = {};

    if (keyword) {
      params[this.categoryToParam(this.filterCategory)] = keyword;
    }

    this.fetchTransactions(params, apiPage);
  }

  private fetchTransactions(extraParams: Record<string, string>, apiPage: number): void {
    this.loading = true;
    this.errorMessage = '';

    let params = new HttpParams()
      .set('page', String(apiPage))
      .set('size', String(this.rowsPerPage))
      .set('sort', 'createdAt,desc');

    Object.keys(extraParams).forEach(key => {
      params = params.set(key, extraParams[key]);
    });

    this.http.get<PagedSales>(API_ENDPOINTS.SALES.SEARCH, { params })
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        this.loading = false;

        if (!res) {
          this.errorMessage = 'Failed to load transactions. Please try again.';
          this.transactions = [];
          this.totalElements = 0;
          this.totalPages = 0;
          return;
        }

        const items: SaleSearchResult[] = Array.isArray(res.content)
          ? res.content
          : Array.isArray(res.items) ? res.items : [];

        this.transactions = items.map(s => this.normalizeTransaction(s));
        this.totalElements = res.totalElements ?? this.transactions.length;
        this.totalPages = res.totalPages ?? Math.max(1, Math.ceil(this.totalElements / this.rowsPerPage));
      });
  }

  private normalizeTransaction(s: SaleSearchResult): Transaction {
    // Accept any common identifier the backend may use
    const resolvedId = s.id ?? s.saleId ?? s.saleNumber ?? s.invoiceId ?? s.billNo ?? null;
    return {
      id: resolvedId != null ? String(resolvedId) : '',
      billNo: s.billNo ?? String(resolvedId ?? ''),
      billDate: s.billDate ?? s.createdAt ?? '',
      patientName: s.patientName ?? s.customerName ?? '',
      totalAmount: Number(s.totalAmount ?? s.grandTotalAmount ?? 0)
    };
  }

  private categoryToParam(category: string): string {
    switch (category) {
      case 'Patient Name': return 'patientName';
      case 'Bill Date':    return 'billDate';
      case 'Bill No':
      default:             return 'billNo';
    }
  }

  private getTodayForApi(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
