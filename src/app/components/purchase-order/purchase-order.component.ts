import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { API_ENDPOINTS } from 'src/app/config/api-endpoints';

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

interface PurchaseOrderItem extends PurchaseOrderNavigationItem {
  qtyPillClass: 'low' | 'ok';
}

interface SupplierOption {
  supplierId: number | null;
  supplierName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
}

interface MedicineOption {
  productId: number | null;
  productName: string;
  subtitle: string;
  sku: string;
  unitCost: number;
  previousUnitCost: number;
  inStock: number;
}

interface PurchaseItemCreateRequestDTO {
  medicineId: number;
  quantityOrdered: number;
  quantityReceived: number;
  costPerUnit: number;
  lineItemStatus: string;
}

interface PurchaseCreateRequestDTO {
  supplierId: number;
  purchaseDate: string;
  estimatedAmount: number;
  orderStatus: string;
  paymentStatus: string;
  isActive: boolean;
  items: PurchaseItemCreateRequestDTO[];
}

type StatusType = 'info' | 'success' | 'error';

@Component({
  selector: 'app-purchase-order',
  templateUrl: './purchase-order.component.html',
  styleUrls: ['./purchase-order.component.scss']
})
export class PurchaseOrderComponent implements OnInit, OnDestroy {
  orderItems: PurchaseOrderItem[] = [];

  supplierId: number | null = null;
  supplierName = '';
  supplierQuery = '';
  supplierOptions: SupplierOption[] = [];
  supplierSearchError = '';
  supplierSearching = false;
  hasSelectedSupplier = false;

  supplierEmail = '';
  supplierPhone = '';
  supplierContactPerson = '';
  supplierAddress = '';

  medicineQuery = '';
  medicineOptions: MedicineOption[] = [];
  medicineSearching = false;
  medicineSearchError = '';

  poNotes = '';
  statusMessage = '';
  statusType: StatusType = 'info';
  isCreatingPurchase = false;
  submitAttempted = false;

  readonly shippingFee = 0;
  private supplierDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private medicineDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    this.initializeFromNavigationState();
  }

  ngOnDestroy(): void {
    if (this.supplierDebounceTimer) {
      clearTimeout(this.supplierDebounceTimer);
    }

    if (this.medicineDebounceTimer) {
      clearTimeout(this.medicineDebounceTimer);
    }
  }

  get selectedCount(): number {
    return this.orderItems.length;
  }

  get subtotal(): number {
    return this.orderItems.reduce((sum, item) => sum + this.getLineTotal(item), 0);
  }

  get grandTotal(): number {
    return this.subtotal + this.shippingFee;
  }

  get lowInventoryCount(): number {
    return this.orderItems.filter((item) => item.inStock <= 20).length;
  }

  get showSupplierRequiredError(): boolean {
    return this.submitAttempted && this.supplierId == null;
  }

  backToInventory(): void {
    this.router.navigate(['/inventory']);
  }

  setQuantity(item: PurchaseOrderItem, rawValue: string | number): void {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      item.orderQty = 1;
      return;
    }

    item.orderQty = Math.max(1, Math.floor(parsed));
  }

  removeOrderItem(itemToRemove: PurchaseOrderItem): void {
    this.orderItems = this.orderItems.filter((item) => item !== itemToRemove);

    if (!this.orderItems.length) {
      this.statusMessage = 'No selected products were found. Please choose items from Inventory Alert.';
    }
  }

  getLineTotal(item: PurchaseOrderItem): number {
    return item.orderQty * item.unitCost;
  }

  generatePurchaseOrder(): void {
    if (this.isCreatingPurchase) {
      return;
    }

    this.submitAttempted = true;

    if (!this.orderItems.length) {
      this.statusType = 'error';
      this.statusMessage = 'Select products from Inventory Alert before generating a purchase order.';
      return;
    }

    if (this.supplierId == null) {
      this.statusType = 'error';
      this.statusMessage = 'Please select a supplier before creating a purchase order.';
      return;
    }

    const invalidItem = this.orderItems.find((item) => item.productId == null);
    if (invalidItem) {
      this.statusType = 'error';
      this.statusMessage = `Unable to submit order. Missing medicine id for ${invalidItem.productName}.`;
      return;
    }

    const payload = this.buildPurchaseCreatePayload();
    this.isCreatingPurchase = true;
    this.statusType = 'info';
    this.statusMessage = '';

    this.http.post<any>(API_ENDPOINTS.PURCHASES.CREATE, payload).subscribe({
      next: (res) => {
        this.statusType = 'success';
        this.statusMessage = this.extractApiSuccessMessage(res) || 'Purchase order created successfully.';
      },
      error: (err) => {
        this.statusType = 'error';
        this.statusMessage = this.extractApiErrorMessage(err) || 'Unable to create purchase order. Please try again.';
      },
      complete: () => {
        this.isCreatingPurchase = false;
      }
    });
  }

  get statusBannerClass(): string {
    return `status-banner ${this.statusType}`;
  }

  trackBySku(_index: number, item: PurchaseOrderItem): string {
    return item.sku;
  }

  onSupplierQueryChange(rawValue: string): void {
    this.supplierQuery = rawValue;
    this.supplierSearchError = '';

    if (this.supplierDebounceTimer) {
      clearTimeout(this.supplierDebounceTimer);
    }

    const query = rawValue.trim();
    if (
      this.hasSelectedSupplier &&
      query.toLowerCase() !== this.supplierName.trim().toLowerCase()
    ) {
      this.clearSelectedSupplier(true);
    }

    if (!query) {
      this.supplierOptions = [];
      this.supplierSearching = false;
      this.clearSelectedSupplier();
      return;
    }

    this.supplierDebounceTimer = setTimeout(() => {
      this.searchSuppliers(query);
    }, 250);
  }

  selectSupplier(supplier: SupplierOption): void {
    this.supplierId = supplier.supplierId;
    this.supplierName = supplier.supplierName;
    this.supplierQuery = supplier.supplierName;
    this.supplierEmail = supplier.email;
    this.supplierPhone = supplier.phone;
    this.supplierContactPerson = supplier.contactPerson;
    this.supplierAddress = supplier.address;
    this.supplierOptions = [];
    this.hasSelectedSupplier = true;

    this.orderItems = this.orderItems.map((item) => ({
      ...item,
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName
    }));
  }

  private clearSelectedSupplier(keepQuery = false): void {
    this.hasSelectedSupplier = false;
    this.supplierId = null;
    this.supplierName = '';
    this.supplierEmail = '';
    this.supplierPhone = '';
    this.supplierContactPerson = '';
    this.supplierAddress = '';

    if (!keepQuery) {
      this.supplierQuery = '';
    }

    this.orderItems = this.orderItems.map((item) => ({
      ...item,
      supplierId: null,
      supplierName: ''
    }));
  }

  onMedicineQueryChange(rawValue: string): void {
    this.medicineQuery = rawValue;
    this.medicineSearchError = '';

    if (this.medicineDebounceTimer) {
      clearTimeout(this.medicineDebounceTimer);
    }

    const query = rawValue.trim();
    if (!query) {
      this.medicineOptions = [];
      this.medicineSearching = false;
      return;
    }

    this.medicineDebounceTimer = setTimeout(() => {
      this.searchMedicines(query);
    }, 250);
  }

  selectMedicine(option: MedicineOption): void {
    const existing = this.orderItems.find((item) => {
      if (item.productId != null && option.productId != null) {
        return item.productId === option.productId;
      }

      return item.productName.toLowerCase() === option.productName.toLowerCase();
    });

    if (existing) {
      existing.orderQty = 1;
      existing.unitCost = option.previousUnitCost > 0
        ? option.previousUnitCost
        : (option.unitCost > 0 ? option.unitCost : existing.unitCost);
      existing.inStock = option.inStock;
      existing.qtyPillClass = option.inStock <= 20 ? 'low' : 'ok';
      this.medicineQuery = '';
      this.medicineOptions = [];
      return;
    }

    this.orderItems = [
      ...this.orderItems,
      {
        productId: option.productId,
        productName: option.productName,
        sku: option.sku,
        inStock: option.inStock,
        orderQty: 1,
        unitCost: option.previousUnitCost > 0 ? option.previousUnitCost : option.unitCost,
        supplierId: this.supplierId,
        supplierName: this.supplierName,
        qtyPillClass: option.inStock <= 20 ? 'low' : 'ok'
      }
    ];

    this.medicineQuery = '';
    this.medicineOptions = [];
  }

  private initializeFromNavigationState(): void {
    const navState = this.router.getCurrentNavigation()?.extras?.state;
    const state = navState || history.state;
    const selectedItems = Array.isArray(state?.selectedItems) ? state.selectedItems : [];

    this.orderItems = selectedItems.map((raw: PurchaseOrderNavigationItem, index: number) => this.toOrderItem(raw, index));

    if (!this.orderItems.length) {
      this.statusMessage = 'No selected products were found. Please choose items from Inventory Alert.';
      return;
    }

    this.hydrateMissingUnitCosts();
  }

  private searchSuppliers(query: string): void {
    this.supplierSearching = true;
    this.supplierSearchError = '';

    this.http.get<any>(API_ENDPOINTS.SUPPLIERS.HELP_TEXT(query)).subscribe({
      next: (res) => {
        const rows = this.extractRows(res);
        this.supplierOptions = rows
          .map((row: any, index: number) => this.normalizeSupplier(row, index))
          .filter((s: SupplierOption) => !!s.supplierName);
        this.supplierSearching = false;
      },
      error: () => {
        this.supplierOptions = [];
        this.supplierSearching = false;
        this.supplierSearchError = 'Unable to fetch suppliers right now.';
      }
    });
  }

  private searchMedicines(query: string): void {
    this.medicineSearching = true;
    this.medicineSearchError = '';
    const params = new HttpParams().set('startsWith', query);

    this.http.get<any>(API_ENDPOINTS.MEDICINES.ALPHA, { params }).subscribe({
      next: (res) => {
        const rows = this.extractRows(res);
        this.medicineOptions = rows
          .map((row: any, index: number) => this.normalizeMedicine(row, index))
          .filter((m: MedicineOption) => !!m.productName);
        this.medicineSearching = false;
      },
      error: () => {
        this.medicineOptions = [];
        this.medicineSearching = false;
        this.medicineSearchError = 'Unable to search medicines at the moment.';
      }
    });
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

  private normalizeSupplier(row: any, index: number): SupplierOption {
    const supplierName = String(
      row?.supplierName ?? row?.name ?? row?.companyName ?? row?.vendorName ?? `Supplier ${index + 1}`
    ).trim();
    const fallbackEmail = `orders@${supplierName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'supplier'}.com`;

    return {
      supplierId: this.toNullableNumber(row?.supplierId ?? row?.id),
      supplierName,
      contactPerson: String(row?.contactPerson ?? row?.contactName ?? 'Not Available').trim(),
      email: String(row?.emailAddress ?? row?.email ?? row?.contactEmail ?? fallbackEmail).trim(),
      phone: String(row?.phoneNumber ?? row?.phone ?? row?.contactPhone ?? row?.mobile ?? 'Not Available').trim(),
      address: String(row?.address ?? 'Not Available').trim()
    };
  }

  private normalizeMedicine(row: any, index: number): MedicineOption {
    const inventoryEntry = this.extractInventoryEntry(row);
    const productId = this.toNullableNumber(row?.medicineId ?? row?.id);
    const productName = String(row?.name ?? row?.medicineName ?? `Medicine ${index + 1}`).trim();
    const dosage = String(row?.dosageForm ?? row?.form ?? '').trim();
    const strength = String(row?.strength ?? '').trim();
    const previousUnitCost = this.toNumber(
      row?.previousOrderUnitPrice ??
      row?.previousUnitPrice ??
      row?.lastPurchasePrice ??
      row?.previousPurchasePrice ??
      inventoryEntry?.previousOrderUnitPrice ??
      inventoryEntry?.lastPurchasePrice ??
      inventoryEntry?.purchasePrice ??
      row?.purchasePrice ??
      0
    );
    const unitCost = this.toNumber(
      row?.price ??
      row?.sellingPrice ??
      row?.unitPrice ??
      row?.mrp ??
      inventoryEntry?.sellingPrice ??
      inventoryEntry?.unitPrice ??
      inventoryEntry?.mrp ??
      row?.purchasePrice ??
      0
    );
    const inStock = this.toNumber(
      row?.inStock ??
      row?.currentQuantity ??
      row?.stockOnHand ??
      row?.quantityOnHand ??
      row?.quantity ??
      row?.stock ??
      row?.availableQty ??
      inventoryEntry?.quantityOnHand ??
      inventoryEntry?.availableQty ??
      inventoryEntry?.quantity ??
      inventoryEntry?.stock ??
      row?.units ??
      0
    );

    return {
      productId,
      productName,
      subtitle: [dosage, strength].filter((part) => !!part).join(' • '),
      sku: String(row?.sku ?? row?.skuCode ?? `MED-${String(index + 1).padStart(3, '0')}`),
      unitCost,
      previousUnitCost,
      inStock
    };
  }

  private extractInventoryEntry(row: any): any {
    if (Array.isArray(row?.inventories) && row.inventories.length > 0) {
      const preferred = row.inventories.find((inv: any) => this.toNumber(inv?.quantityOnHand ?? inv?.quantity ?? inv?.stock) > 0);
      return preferred ?? row.inventories[0];
    }

    if (row?.inventory && typeof row.inventory === 'object') {
      return row.inventory;
    }

    return null;
  }

  private hydrateMissingUnitCosts(): void {
    const rowsToHydrate = this.orderItems.filter((item) => item.productId != null && this.toNumber(item.unitCost) <= 0);

    if (!rowsToHydrate.length) {
      return;
    }

    rowsToHydrate.forEach((item) => {
      this.http.get<any>(API_ENDPOINTS.MEDICINES.DETAILS(item.productId as number)).subscribe({
        next: (details) => {
          const resolvedPrice = this.resolveUnitPriceFromMedicineDetails(details);
          if (resolvedPrice > 0) {
            item.unitCost = resolvedPrice;
            this.orderItems = [...this.orderItems];
          }
        },
        error: () => {
          // Keep current value when details call fails.
        }
      });
    });
  }

  private resolveUnitPriceFromMedicineDetails(details: any): number {
    const preferredInventory = this.extractInventoryEntry(details);

    const directPrice = this.toNumber(
      details?.previousOrderUnitPrice ??
      details?.previousUnitPrice ??
      details?.lastPurchasePrice ??
      details?.previousPurchasePrice ??
      details?.purchasePrice ??
      details?.sellingPrice ??
      details?.unitPrice ??
      details?.price ??
      details?.mrp ??
      preferredInventory?.previousOrderUnitPrice ??
      preferredInventory?.lastPurchasePrice ??
      preferredInventory?.purchasePrice ??
      preferredInventory?.sellingPrice ??
      preferredInventory?.unitPrice ??
      preferredInventory?.mrp ??
      0
    );

    if (directPrice > 0) {
      return directPrice;
    }

    if (Array.isArray(details?.inventories)) {
      for (const inv of details.inventories) {
        const candidate = this.toNumber(
          inv?.previousOrderUnitPrice ??
          inv?.lastPurchasePrice ??
          inv?.purchasePrice ??
          inv?.sellingPrice ??
          inv?.unitPrice ??
          inv?.mrp ??
          0
        );

        if (candidate > 0) {
          return candidate;
        }
      }
    }

    return 0;
  }

  private buildPurchaseCreatePayload(): PurchaseCreateRequestDTO {
    return {
      supplierId: this.supplierId as number,
      purchaseDate: this.currentLocalDate(),
      estimatedAmount: this.round2(this.grandTotal),
      orderStatus: 'PENDING',
      paymentStatus: 'PENDING',
      isActive: true,
      items: this.orderItems
        .filter((item) => item.productId != null)
        .map((item) => ({
          medicineId: item.productId as number,
          quantityOrdered: this.toInt(item.orderQty),
          quantityReceived: 0,
          costPerUnit: this.round2(item.unitCost),
          lineItemStatus: 'PENDING'
        }))
    };
  }

  private extractApiSuccessMessage(res: any): string {
    return String(
      res?.message ??
      res?.statusMessage ??
      res?.data?.message ??
      ''
    ).trim();
  }

  private extractApiErrorMessage(err: any): string {
    const raw =
      err?.error?.message ??
      err?.error?.statusMessage ??
      err?.error?.error ??
      err?.message ??
      '';

    if (typeof raw === 'string') {
      return raw.trim();
    }

    return '';
  }

  private round2(value: unknown): number {
    return Math.round(this.toNumber(value) * 100) / 100;
  }

  private currentLocalDate(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toInt(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.max(0, Math.floor(parsed));
  }

  private toOrderItem(raw: PurchaseOrderNavigationItem, index: number): PurchaseOrderItem {
    const unitCost = Number(raw?.unitCost ?? 0);
    const inStock = Number(raw?.inStock ?? 0);

    return {
      productId: this.toNullableNumber(raw?.productId),
      productName: String(raw?.productName || `Product ${index + 1}`),
      sku: String(raw?.sku || `PRD-${String(index + 1).padStart(3, '0')}`),
      inStock: Number.isFinite(inStock) ? inStock : 0,
      orderQty: 1,
      unitCost: Number.isFinite(unitCost) ? unitCost : 0,
      supplierId: this.toNullableNumber(raw?.supplierId),
      supplierName: String(raw?.supplierName || 'Preferred Supplier'),
      qtyPillClass: inStock <= 20 ? 'low' : 'ok'
    };
  }

  private toNullableNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}