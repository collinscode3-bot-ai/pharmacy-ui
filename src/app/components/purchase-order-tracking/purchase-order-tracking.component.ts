import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { API_ENDPOINTS } from 'src/app/config/api-endpoints';

type TrackingStatus = 'delivered' | 'in_transit' | 'pending' | 'delayed' | 'other';
type DateRangeFilter = '7' | '30' | '90' | 'all';
type CategoryFilter = 'all' | 'poNumber' | 'supplierName' | 'status';

interface PurchaseOrderTrackingRecord {
  poNumber: string;
  poDate: Date;
  supplierName: string;
  totalValue: number;
  statusKey: TrackingStatus;
  statusLabel: string;
}

@Component({
  selector: 'app-purchase-order-tracking',
  templateUrl: './purchase-order-tracking.component.html',
  styleUrls: ['./purchase-order-tracking.component.scss']
})
export class PurchaseOrderTrackingComponent implements OnInit {
  loading = false;
  statusMessage = '';
  lastUpdatedAt: Date = new Date();

  keyword = '';
  category: CategoryFilter = 'all';
  dateRange: DateRangeFilter = '30';

  readonly pageSize = 10;
  currentPage = 1;

  private allOrders: PurchaseOrderTrackingRecord[] = [];
  filteredOrders: PurchaseOrderTrackingRecord[] = [];
  pagedOrders: PurchaseOrderTrackingRecord[] = [];

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadPurchaseOrders();
  }

  get totalActivePos(): number {
    return this.filteredOrders.length;
  }

  get inTransitCount(): number {
    return this.filteredOrders.filter((order) => order.statusKey === 'in_transit').length;
  }

  get pendingApprovalCount(): number {
    return this.filteredOrders.filter((order) => order.statusKey === 'pending').length;
  }

  get monthlySpend(): number {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return this.filteredOrders
      .filter((order) => order.poDate.getMonth() === month && order.poDate.getFullYear() === year)
      .reduce((sum, order) => sum + order.totalValue, 0);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredOrders.length / this.pageSize));
  }

  get startOrderIndex(): number {
    if (!this.filteredOrders.length) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endOrderIndex(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredOrders.length);
  }

  get paginationTokens(): Array<number | string> {
    const total = this.totalPages;

    if (total <= 5) {
      return Array.from({ length: total }, (_, idx) => idx + 1);
    }

    if (this.currentPage <= 3) {
      return [1, 2, 3, '...', total];
    }

    if (this.currentPage >= total - 2) {
      return [1, '...', total - 2, total - 1, total];
    }

    return [1, '...', this.currentPage, '...', total];
  }

  get lastUpdatedLabel(): string {
    const now = Date.now();
    const diffMinutes = Math.max(1, Math.floor((now - this.lastUpdatedAt.getTime()) / 60000));

    return `Auto-updated ${diffMinutes} min${diffMinutes > 1 ? 's' : ''} ago`;
  }

  onSearch(): void {
    this.loadPurchaseOrders();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    this.updatePagedOrders();
  }

  trackByPoNumber(_index: number, order: PurchaseOrderTrackingRecord): string {
    return order.poNumber;
  }

  onViewOrder(order: PurchaseOrderTrackingRecord): void {
    this.router.navigate(['/inventory/purchase-order-tracking/receive-delivery', order.poNumber], {
      state: {
        poNumber: order.poNumber,
        poDate: order.poDate,
        supplierName: order.supplierName,
        statusLabel: order.statusLabel,
        statusKey: order.statusKey
      }
    });
  }

  private loadPurchaseOrders(): void {
    this.loading = true;
    this.statusMessage = '';
    const params = this.buildSearchParams();

    this.http.get<any>(API_ENDPOINTS.PURCHASES.SEARCH, { params }).subscribe({
      next: (res) => {
        const rows = this.extractRows(res);
        const normalized = rows
          .map((row: any, index: number) => this.normalizeOrder(row, index))
          .filter((row: PurchaseOrderTrackingRecord) => !!row.poNumber);

        this.setOrders(normalized);
        this.lastUpdatedAt = new Date();
        this.loading = false;
      },
      error: () => {
        this.setOrders(this.getFallbackOrders());
        this.lastUpdatedAt = new Date();
        this.statusMessage = 'Showing local preview data while order tracking service is unavailable.';
        this.loading = false;
      }
    });
  }

  private setOrders(rows: PurchaseOrderTrackingRecord[]): void {
    this.allOrders = rows;
    this.filteredOrders = [...rows];
    this.currentPage = 1;
    this.updatePagedOrders();
  }

  private updatePagedOrders(): void {
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedOrders = this.filteredOrders.slice(start, start + this.pageSize);
  }

  private buildSearchParams(): HttpParams {
    let params = new HttpParams().set('dateRange', this.mapDateRangeToApi(this.dateRange));
    const keyword = this.keyword.trim();

    if (!keyword) {
      return params;
    }

    if (this.category === 'poNumber') {
      return params.set('poNumber', keyword);
    }

    if (this.category === 'supplierName') {
      return params.set('supplierName', keyword);
    }

    if (this.category === 'status') {
      return params.set('poStatus', this.mapStatusToApi(keyword));
    }

    if (this.looksLikePoNumber(keyword)) {
      return params.set('poNumber', keyword);
    }

    return params.set('supplierName', keyword);
  }

  private mapDateRangeToApi(dateRange: DateRangeFilter): string {
    if (dateRange === '90') {
      return 'LAST_90';
    }

    if (dateRange === 'all') {
      return 'ALL';
    }

    if (dateRange === '7') {
      return 'LAST_7';
    }

    return 'LAST_30';
  }

  private mapStatusToApi(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, '_');
  }

  private looksLikePoNumber(value: string): boolean {
    const cleaned = value.trim();
    return /^\d{8,}$/.test(cleaned) || /^PO[-\d_]/i.test(cleaned);
  }

  private extractRows(res: any): any[] {
    if (Array.isArray(res)) {
      return res;
    }

    if (Array.isArray(res?.content)) {
      return res.content;
    }

    if (Array.isArray(res?.items)) {
      return res.items;
    }

    if (Array.isArray(res?.data)) {
      return res.data;
    }

    return [];
  }

  private normalizeOrder(row: any, index: number): PurchaseOrderTrackingRecord {
    const rawStatus = String(row?.orderStatus ?? row?.status ?? row?.state ?? 'pending');
    const status = this.normalizeStatus(rawStatus);
    const dateValue = row?.purchaseDate ?? row?.poDate ?? row?.createdAt ?? row?.date;
    const parsedDate = new Date(dateValue);

    return {
      poNumber: String(row?.poNumber ?? row?.purchaseOrderNo ?? row?.orderNo ?? `PO-${String(index + 1).padStart(3, '0')}`),
      poDate: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
      supplierName: String(row?.supplierName ?? row?.supplier?.supplierName ?? row?.vendorName ?? 'Supplier'),
      totalValue: this.toNumber(row?.estimatedAmount ?? row?.totalValue ?? row?.totalAmount ?? row?.amount ?? 0),
      statusKey: status,
      statusLabel: this.statusLabel(status)
    };
  }

  private normalizeStatus(status: string): TrackingStatus {
    const value = status.trim().toLowerCase().replace(/\s+/g, '_');

    if (value.includes('deliver')) {
      return 'delivered';
    }

    if (value.includes('transit') || value.includes('shipping') || value.includes('ship')) {
      return 'in_transit';
    }

    if (value.includes('delay') || value.includes('hold')) {
      return 'delayed';
    }

    if (value.includes('pending') || value.includes('approve')) {
      return 'pending';
    }

    return 'other';
  }

  private statusLabel(status: TrackingStatus): string {
    if (status === 'in_transit') {
      return 'In Transit';
    }

    if (status === 'delivered') {
      return 'Delivered';
    }

    if (status === 'delayed') {
      return 'Delayed';
    }

    if (status === 'pending') {
      return 'Pending';
    }

    return 'Active';
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getFallbackOrders(): PurchaseOrderTrackingRecord[] {
    const rows = [
      { poNumber: 'PO-2023-088', poDate: '2023-10-25', supplierName: 'Global Med Distribution', totalValue: 12450, status: 'delivered' },
      { poNumber: 'PO-2023-089', poDate: '2023-10-26', supplierName: 'Bio-Tech Solutions', totalValue: 8210.5, status: 'in_transit' },
      { poNumber: 'PO-2023-090', poDate: '2023-10-28', supplierName: 'Apex Pharmaceuticals', totalValue: 3890, status: 'pending' },
      { poNumber: 'PO-2023-091', poDate: '2023-10-29', supplierName: 'Global Med Distribution', totalValue: 15200, status: 'delayed' },
      { poNumber: 'PO-2023-092', poDate: '2023-10-30', supplierName: 'Sterling Life Care', totalValue: 6400, status: 'pending' },
      { poNumber: 'PO-2023-093', poDate: '2023-10-31', supplierName: 'CarePlus Wholesale', totalValue: 11480, status: 'in_transit' },
      { poNumber: 'PO-2023-094', poDate: '2023-11-02', supplierName: 'Apex Pharmaceuticals', totalValue: 5320, status: 'delivered' },
      { poNumber: 'PO-2023-095', poDate: '2023-11-04', supplierName: 'Global Med Distribution', totalValue: 9450, status: 'pending' },
      { poNumber: 'PO-2023-096', poDate: '2023-11-05', supplierName: 'Bio-Tech Solutions', totalValue: 12090, status: 'in_transit' },
      { poNumber: 'PO-2023-097', poDate: '2023-11-06', supplierName: 'Sterling Life Care', totalValue: 4860, status: 'pending' },
      { poNumber: 'PO-2023-098', poDate: '2023-11-08', supplierName: 'CarePlus Wholesale', totalValue: 17600, status: 'delivered' },
      { poNumber: 'PO-2023-099', poDate: '2023-11-10', supplierName: 'Apex Pharmaceuticals', totalValue: 7850, status: 'delayed' }
    ];

    return rows.map((row) => {
      const status = this.normalizeStatus(row.status);
      return {
        poNumber: row.poNumber,
        poDate: new Date(row.poDate),
        supplierName: row.supplierName,
        totalValue: row.totalValue,
        statusKey: status,
        statusLabel: this.statusLabel(status)
      };
    });
  }
}
