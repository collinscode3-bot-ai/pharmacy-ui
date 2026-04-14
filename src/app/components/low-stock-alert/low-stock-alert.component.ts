import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { API_ENDPOINTS } from 'src/app/config/api-endpoints';

type MatchType = 'all' | 'contains' | 'exact' | 'starts_with';

interface LowStockItem {
  key: string;
  id: number | null;
  productName: string;
  subtitle: string;
  category: string;
  supplierId: number | null;
  supplier: string;
  unitCost: number;
  orderStatus: 'pending' | 'ordered' | 'not_ordered';
  quantity: number;
  status: 'low_stock' | 'out_of_stock';
}

interface StockReorderStatusDTO {
  productId?: number;
  productName?: string;
  currentQuantity?: number;
  supplierId?: number;
  supplierName?: string;
  currentStatus?: string;
  stockStatus?: string;
  previousOrderUnitPrice?: number;
  previousUnitPrice?: number;
  lastPurchasePrice?: number;
  purchasePrice?: number;
  unitPrice?: number;
  mrp?: number;
}

interface PurchaseOrderNavigationItem {
  productId: number | null;
  productName: string;
  sku: string;
  inStock: number;
  orderQty: number;
  unitCost: number;
  supplierId: number | null;
  supplierName: string;
}

@Component({
  selector: 'app-low-stock-alert',
  templateUrl: './low-stock-alert.component.html',
  styleUrls: ['./low-stock-alert.component.scss']
})
export class LowStockAlertComponent implements OnInit {
  loading = true;
  errorMessage = '';

  page = 0;
  readonly pageSize = 4;

  selectedCategory = 'all';
  keyword = '';
  matchType: MatchType = 'all';

  categories: string[] = [];

  allItems: LowStockItem[] = [];
  filteredItems: LowStockItem[] = [];
  pagedItems: LowStockItem[] = [];

  private selectedKeys = new Set<string>();

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadInventoryAlerts();
  }

  get totalItems(): number {
    return this.filteredItems.length;
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  get startItem(): number {
    if (!this.totalItems) {
      return 0;
    }

    return this.page * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min((this.page + 1) * this.pageSize, this.totalItems);
  }

  get pageNumbers(): number[] {
    if (!this.totalPages) {
      return [];
    }

    const maxVisible = 5;
    const start = Math.max(0, this.page - Math.floor(maxVisible / 2));
    const end = Math.min(this.totalPages, start + maxVisible);
    const pages: number[] = [];
    for (let i = start; i < end; i++) {
      pages.push(i);
    }

    return pages;
  }

  get selectedCount(): number {
    return this.selectedKeys.size;
  }

  get isAllVisibleSelected(): boolean {
    const selectableItems = this.pagedItems.filter((item) => this.isSelectable(item));
    return selectableItems.length > 0 && selectableItems.every((item) => this.selectedKeys.has(item.key));
  }

  get hasSelectableVisibleItems(): boolean {
    return this.pagedItems.some((item) => this.isSelectable(item));
  }

  get hasAnySelection(): boolean {
    return this.allItems.some((item) => this.isSelectable(item) && this.selectedKeys.has(item.key));
  }

  loadInventoryAlerts(): void {
    this.loading = true;
    this.errorMessage = '';

    this.http.get<any>(API_ENDPOINTS.DASHBOARD.STOCK_REORDER_STATUS).subscribe({
      next: (res) => {
        const rows = this.extractRows(res).map((row, index) => this.normalizeRow(row, index));
        this.allItems = rows;
        this.categories = this.buildCategoryList(rows);
        this.applyFilters(true);
        this.loading = false;
      },
      error: () => {
        this.allItems = [];
        this.filteredItems = [];
        this.pagedItems = [];
        this.categories = [];
        this.loading = false;
        this.errorMessage = 'Unable to load stock reorder status right now. Please try again.';
      }
    });
  }

  applyFilters(resetPage = false): void {
    const category = (this.selectedCategory || 'all').toLowerCase();
    const keyword = (this.keyword || '').trim().toLowerCase();

    this.filteredItems = this.allItems.filter((item) => {
      const categoryMatch = category === 'all' || item.category.toLowerCase() === category;
      if (!categoryMatch) {
        return false;
      }

      if (!keyword || this.matchType === 'all') {
        return true;
      }

      const haystack = `${item.productName} ${item.subtitle} ${item.supplier} ${item.category}`.toLowerCase();
      if (this.matchType === 'exact') {
        return haystack === keyword;
      }

      if (this.matchType === 'starts_with') {
        return haystack.startsWith(keyword);
      }

      return haystack.includes(keyword);
    });

    if (resetPage) {
      this.page = 0;
    } else {
      this.page = Math.min(this.page, Math.max(this.totalPages - 1, 0));
    }

    this.updatePagedItems();
  }

  search(): void {
    this.applyFilters(true);
  }

  clearFilters(): void {
    this.selectedCategory = 'all';
    this.keyword = '';
    this.matchType = 'all';
    this.applyFilters(true);
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) {
      return;
    }

    this.page = page;
    this.updatePagedItems();
  }

  prevPage(): void {
    this.goToPage(this.page - 1);
  }

  nextPage(): void {
    this.goToPage(this.page + 1);
  }

  onToggleSelectAll(checked: boolean): void {
    this.pagedItems.forEach((item) => {
      if (!this.isSelectable(item)) {
        this.selectedKeys.delete(item.key);
        return;
      }

      if (checked) {
        this.selectedKeys.add(item.key);
      } else {
        this.selectedKeys.delete(item.key);
      }
    });
  }

  onToggleItem(item: LowStockItem, checked: boolean): void {
    if (!this.isSelectable(item)) {
      this.selectedKeys.delete(item.key);
      return;
    }

    if (checked) {
      this.selectedKeys.add(item.key);
    } else {
      this.selectedKeys.delete(item.key);
    }
  }

  isSelected(item: LowStockItem): boolean {
    return this.selectedKeys.has(item.key);
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  purchaseSelected(): void {
    const selectedItems: PurchaseOrderNavigationItem[] = this.allItems
      .filter((item) => this.isSelectable(item) && this.selectedKeys.has(item.key))
      .map((item, index) => this.toPurchaseOrderItem(item, index));

    if (!selectedItems.length) {
      return;
    }

    this.router.navigate(['/purchase-order'], {
      state: { selectedItems }
    });
  }

  viewDetails(item: LowStockItem): void {
    if (item.id != null) {
      this.router.navigate(['/inventory/edit-product', item.id]);
      return;
    }

    this.router.navigate(['/medicine-catalog']);
  }

  statusClass(item: LowStockItem): string {
    return item.status === 'out_of_stock' ? 'out' : 'low';
  }

  statusLabel(item: LowStockItem): string {
    return item.status === 'out_of_stock' ? 'OUT OF STOCK' : 'LOW STOCK';
  }

  orderStatusClass(item: LowStockItem): string {
    if (item.orderStatus === 'ordered') {
      return 'ordered';
    }

    if (item.orderStatus === 'pending') {
      return 'pending';
    }

    return 'not-ordered';
  }

  orderStatusLabel(item: LowStockItem): string {
    if (item.orderStatus === 'ordered') {
      return 'ORDERED';
    }

    if (item.orderStatus === 'pending') {
      return 'PENDING';
    }

    return 'NOT ORDERED';
  }

  isSelectable(item: LowStockItem): boolean {
    return item.orderStatus !== 'ordered';
  }

  private updatePagedItems(): void {
    const start = this.page * this.pageSize;
    const end = start + this.pageSize;
    this.pagedItems = this.filteredItems.slice(start, end);
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

  private normalizeRow(row: StockReorderStatusDTO, index: number): LowStockItem {
    const id = this.toNumberOrNull(row?.productId);
    const supplierId = this.toNumberOrNull(row?.supplierId);
    const quantity = this.toNumber(row?.currentQuantity ?? 0);
    const explicitStatus = String(row?.stockStatus ?? '').toLowerCase();

    let status: 'low_stock' | 'out_of_stock' = 'low_stock';
    if (explicitStatus.includes('out') || quantity <= 0) {
      status = 'out_of_stock';
    }

    const productName = String(row?.productName ?? 'Unknown Product').trim();
    const subtitle = String(row?.stockStatus ?? '').trim();
    const unitCost = this.toNumber(
      row?.previousOrderUnitPrice ??
      row?.previousUnitPrice ??
      row?.lastPurchasePrice ??
      row?.purchasePrice ??
      row?.unitPrice ??
      row?.mrp ??
      0
    );
    const orderStatus = this.normalizeOrderStatus(row?.currentStatus, status);
    const category = status === 'out_of_stock' ? 'Out of Stock' : 'Low Stock';

    return {
      key: id != null ? String(id) : `${productName.toLowerCase().replace(/\s+/g, '-')}-${index}`,
      id,
      productName,
      subtitle,
      category,
      supplierId,
      supplier: String(row?.supplierName ?? 'Not Available').trim(),
      unitCost,
      orderStatus,
      quantity,
      status
    };
  }

  private normalizeOrderStatus(rawStatus: unknown, stockStatus: 'low_stock' | 'out_of_stock'): 'pending' | 'ordered' | 'not_ordered' {
    const text = String(rawStatus ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');

    // Handle negative statuses first so values like "ORDER NOT PLACED"
    // are never misclassified as ordered.
    if (
      text.includes('not placed') ||
      text.includes('not ordered') ||
      text.includes('order not placed') ||
      text.includes('unplaced')
    ) {
      return 'not_ordered';
    }

    if (text.includes('pending') || text.includes('in progress') || text.includes('awaiting') || text.includes('processing')) {
      return 'pending';
    }

    if (
      text.includes('order placed') ||
      text.includes('ordered') ||
      text.includes('completed') ||
      text.includes('received') ||
      text.includes('fulfilled')
    ) {
      return 'ordered';
    }

    if (stockStatus === 'out_of_stock') {
      return 'pending';
    }

    return 'not_ordered';
  }

  private buildCategoryList(items: LowStockItem[]): string[] {
    const unique = new Set(
      items
        .map((item) => item.category)
        .filter((category) => !!category)
    );

    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }

  private toPurchaseOrderItem(item: LowStockItem, index: number): PurchaseOrderNavigationItem {
    return {
      productId: item.id,
      productName: item.productName,
      sku: this.resolveSku(item, index),
      inStock: item.quantity,
      orderQty: 1,
      unitCost: item.unitCost,
      supplierId: item.supplierId,
      supplierName: item.supplier
    };
  }

  private resolveSku(item: LowStockItem, index: number): string {
    if (item.id != null) {
      return `PRD-${String(item.id).padStart(3, '0')}`;
    }

    return `PRD-${String(index + 1).padStart(3, '0')}`;
  }

  private toNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private toNumberOrNull(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
}